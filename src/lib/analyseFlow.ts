import { ESTIMATE_LIMITS, GIRTH_FROM, LIMITS, MIN_CONFIDENCE, PHOTO_LIMITS, RATE_LIMIT, type FormulaId } from "@/config/site";
import { confidenceIndex, type ReperageNorm } from "./measure";
import { estimateMeasuresPose } from "./pose";
import { ImageError, prepareImage } from "./image";
import { buildPhotoReport } from "./photoReport";
import type { CaptchaProvider, ImageScreeningProvider } from "./providers/types";
import { isOutOfReferenceRange, type StandardComment } from "./report";
import { countAttemptsByIp, createReport, finishAttempt, hashIp, startAttempt } from "./repo";
import type { BodyState } from "./stats";
import { PROMPT_VERSION } from "./vision/prompts";
import { PHOTO_REPORT_SCHEMA_VERSION, validateCommentaire, validateRecevabilite, validateReperage } from "./vision/schema";
import { VisionError, type Motif, type Usage, type VisionProvider, type VisionResult } from "./vision/types";
import { dbSpendGate, usageCostMicros, type Reservation, type SpendGate } from "./xaiSpend";

export type StepId = "recevabilite" | "calibration" | "percentiles" | "redaction";

export const STEP_LABELS: Record<StepId, string> = {
  recevabilite: "Contrôle de recevabilité et extraction de la ligne médiane",
  calibration: "Calibration sur la carte de référence",
  percentiles: "Calcul des percentiles",
  redaction: "Rédaction des observations",
};

export type FlowEvent =
  | { type: "step"; id: StepId; label: string }
  | { type: "refused"; message: string }
  | { type: "error"; code: "age" | "consent" | "declared" | "captcha" | "rate" | "cap" | "image" | "provider"; message: string }
  | { type: "ready"; reportId: string };

export type FlowInput = {
  formula: Extract<FormulaId, "B" | "C">;
  state: BodyState;
  consents: { adult: boolean; mine: boolean; sensitive: boolean };
  ageTokenValid: boolean;
  captchaToken: string | null;
  ip: string;
  /** Octets de la photo reçue. Jamais écrits sur disque, en base ni dans les journaux. */
  photo: Buffer | null;
  declared?: { length: number; girth: number };
  /** Bêta gratuite de la formule photo : le rapport est débloqué sans paiement (marqué bêta). */
  freeBeta?: boolean;
};

/**
 * Accès aux données du flux (limite par adresse, tentatives, création du rapport). Par défaut : la base du site.
 * Injectable pour l'outil de test local (scripts/photo-test.mts, option « sans base ») : même chaîne, aucune écriture en base.
 */
export type FlowStore = {
  hashIp(ip: string): string;
  countAttemptsByIp(ipHash: string): Promise<number>;
  startAttempt(ipHash: string | null, formula: "B" | "C"): Promise<number>;
  finishAttempt: (id: number, r: { outcome: "ok" | "refused" | "blocked" | "error"; motif?: string; visionMs?: number; tokensIn?: number; tokensOut?: number }) => Promise<void>;
  createReport: (args: Parameters<typeof createReport>[0]) => Promise<string>;
};

export const dbStore: FlowStore = { hashIp, countAttemptsByIp, startAttempt, finishAttempt, createReport };

export type FlowDeps = { vision: VisionProvider; screening: ImageScreeningProvider; captcha: CaptchaProvider; spend?: SpendGate; store?: FlowStore };

// Messages volontairement neutres : ils ne détaillent jamais le motif (en particulier un doute sur l'âge).
export const NEUTRAL_REFUSAL =
  "Cette image n'a pas pu être analysée. Reprenez la photo en suivant les consignes (carte de référence entière et visible, bonne lumière, aucun visage ni élément identifiant).";
/** Réponse du modèle invalide deux fois de suite (après une relance) : on invite à reprendre la photo, sans promettre de remboursement. */
export const UNREADABLE_MESSAGE =
  "Nous n'avons pas pu analyser cette photo. Reprenez-la en suivant les conseils (carte de référence entière et bien visible, bonne lumière, cadrage net), puis réessayez.";
/** Plafond de dépense xAI du jour atteint : aucun appel au modèle, la tentative ne compte pas dans la limite par adresse. */
export const CAP_MESSAGE = "Capacité du jour atteinte, revenez demain.";

/** Versions de la réponse standardisée, inscrites dans chaque rapport et chaque ligne de journal. */
export const STANDARD_VERSIONS = { schemaVersion: PHOTO_REPORT_SCHEMA_VERSION, promptVersion: PROMPT_VERSION } as const;

type Validated<T> = { ok: true; value: T } | { ok: false; motif: string };

/**
 * Appelle le modèle, valide sa réponse contre le schéma ; réponse invalide : UNE SEULE relance (même schéma), puis échec.
 * La consommation de chaque appel est comptée même en cas d'échec.
 */
export async function withOneRetry<R, V>(call: () => Promise<R>, validate: (raw: R) => Validated<V>, onUsage: (u: Usage) => void, usageOf: (raw: R) => Usage): Promise<Validated<V>> {
  let last: Validated<V> = { ok: false, motif: "reponse_invalide" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call();
    onUsage(usageOf(raw));
    last = validate(raw);
    if (last.ok) return last;
  }
  return last;
}

type Analysed = { refused: true } | { refused: false; recevable: false; motif: Motif } | { refused: false; recevable: true; reperage: ReperageNorm };

/** Validation des deux réponses de vision (recevabilité, repérage) contre le schéma versionné. */
export function validateAnalyse(r: VisionResult): Validated<Analysed> {
  if (r.refused) return { ok: true, value: { refused: true } };
  const rec = validateRecevabilite(r.recevabilite);
  if (!rec) return { ok: false, motif: "recevabilite_invalide" };
  if (!rec.recevable) return { ok: true, value: { refused: false, recevable: false, motif: rec.motif } };
  const reperage = validateReperage(r.reperage);
  if (!reperage) return { ok: false, motif: "reperage_incomplet" };
  return { ok: true, value: { refused: false, recevable: true, reperage } };
}

/** Validation du commentaire standardisé (trois observations, un verdict, aucun chiffre ni terme interdit). */
export function validateComment(r: { json: unknown }): Validated<StandardComment> {
  const c = validateCommentaire(r.json);
  if (!c) return { ok: false, motif: "commentaire_invalide" };
  return { ok: true, value: { ...STANDARD_VERSIONS, observations: c.observations as StandardComment["observations"], verdict: c.verdict } };
}

/**
 * Déroule l'analyse d'une photo, dans l'ordre : âge, consentements, mesures déclarées, captcha, limite de débit, plafond de dépense,
 * réencodage, filtrage d'empreintes, recevabilité + repérage (validés, une relance), calculs, rédaction (validée, une relance),
 * création du rapport. Produit des événements que l'interface affiche en direct : uniquement des étapes réellement exécutées.
 */
export async function* runAnalysis(input: FlowInput, deps: FlowDeps): AsyncGenerator<FlowEvent> {
  try {
    yield* runAnalysisSteps(input, deps);
  } finally {
    input.photo = null; // la photo reçue est abandonnée dans tous les cas (succès, refus, erreur, interruption)
  }
}

async function* runAnalysisSteps(input: FlowInput, deps: FlowDeps): AsyncGenerator<FlowEvent> {
  if (!input.ageTokenValid) {
    yield { type: "error", code: "age", message: "Vérification d'âge requise avant l'envoi d'une photo." };
    return;
  }
  const c = input.consents;
  if (!c.adult || !c.mine || !c.sensitive) {
    yield { type: "error", code: "consent", message: "Les trois cases de confirmation sont obligatoires." };
    return;
  }
  if (input.formula === "C") {
    const d = input.declared;
    const ok =
      d &&
      d.length >= LIMITS.length.min &&
      d.length <= LIMITS.length.max &&
      d.girth >= LIMITS.girth.min &&
      d.girth <= LIMITS.girth.max &&
      !isOutOfReferenceRange({ state: input.state, length: d.length, girth: d.girth });
    if (!ok) {
      yield { type: "error", code: "declared", message: "Vérifiez vos mesures déclarées (en centimètres, état correctement indiqué)." };
      return;
    }
  }
  if (!(await deps.captcha.verify(input.captchaToken, input.ip))) {
    yield { type: "error", code: "captcha", message: "La vérification anti-robot a échoué. Réessayez." };
    return;
  }

  const store = deps.store ?? dbStore;
  const ipHash = store.hashIp(input.ip);
  if ((await store.countAttemptsByIp(ipHash)) >= RATE_LIMIT.maxPerWindow) {
    yield { type: "error", code: "rate", message: `Limite atteinte : ${RATE_LIMIT.maxPerWindow} analyses par période de ${RATE_LIMIT.windowHours} h.` };
    return;
  }

  // Plafond de dépense du jour : réservation AVANT toute tentative (refusée : aucun appel, rien n'est compté, ni ici ni par adresse).
  const gate = deps.spend ?? dbSpendGate;
  const reservation: Reservation = await gate.reserve();
  if (!reservation.ok) {
    console.warn(JSON.stringify({ event: "analysis_cap_reached", day: reservation.day }));
    yield { type: "error", code: "cap", message: CAP_MESSAGE };
    return;
  }
  const spent = { costMicros: 0, calls: 0 };
  try {
    yield* analyseWithReservation(input, deps, store, ipHash, (u) => {
      spent.costMicros += usageCostMicros(u);
      spent.calls += u.calls;
    });
  } finally {
    try {
      await gate.settle(reservation, spent);
    } catch (e) {
      console.warn(JSON.stringify({ event: "analysis_spend_settle_failed", detail: String((e as Error).message ?? e).slice(0, 120) }));
    }
  }
}

async function* analyseWithReservation(input: FlowInput, deps: FlowDeps, store: FlowStore, ipHash: string, onUsage: (u: Usage) => void): AsyncGenerator<FlowEvent> {
  const { finishAttempt, createReport } = store;
  const attemptId = await store.startAttempt(ipHash, input.formula);
  const versions = STANDARD_VERSIONS;

  let jpeg: Buffer;
  let width = 1;
  let height = 1;
  try {
    if (!input.photo) throw new ImageError("absente");
    ({ jpeg, width, height } = await prepareImage(input.photo));
  } catch (e) {
    await finishAttempt(attemptId, { outcome: "error", motif: "image_invalide" });
    const detail = e instanceof ImageError ? e.message : "illisible";
    console.info(JSON.stringify({ event: "analysis_error", motif: "image_invalide", detail }));
    yield { type: "error", code: "image", message: "Image invalide : envoyez une photo JPEG ou PNG d'au plus 8 Mo." };
    return;
  }
  const buf = jpeg;

  // Filtrage par empreintes : images déjà répertoriées uniquement. Une image reconnue est détruite sans analyse.
  // Prestataire absent : avertissement journalisé par le fournisseur « none », sans blocage (voir src/lib/providers).
  const screened = await deps.screening.screen(buf);
  if (screened.blocked) {
    await finishAttempt(attemptId, { outcome: "blocked", motif: "empreinte_connue" });
    console.info(JSON.stringify({ event: "analysis_blocked", motif: "empreinte_connue" }));
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }

  yield { type: "step", id: "recevabilite", label: STEP_LABELS.recevabilite };
  const t0 = Date.now();
  const tokens = { tokensIn: 0, tokensOut: 0 };
  const count = (u: Usage) => {
    tokens.tokensIn += u.tokensIn;
    tokens.tokensOut += u.tokensOut;
    onUsage(u);
  };
  const usageSoFar = () => ({ visionMs: Date.now() - t0, tokensIn: tokens.tokensIn, tokensOut: tokens.tokensOut });

  let analysed: Validated<Analysed>;
  try {
    analysed = await withOneRetry(() => deps.vision.analyse(buf), validateAnalyse, count, (r) => r.usage);
  } catch (e) {
    const kind = e instanceof VisionError ? e.kind : "invalid";
    await finishAttempt(attemptId, { outcome: "error", motif: `fournisseur_${kind}`, ...usageSoFar() });
    console.info(JSON.stringify({ event: "analysis_error", motif: `fournisseur_${kind}`, ...versions }));
    yield { type: "error", code: "provider", message: "Le service d'analyse est momentanément indisponible. Réessayez dans quelques minutes." };
    return;
  }

  const refuse = async (motif: string) => {
    await finishAttempt(attemptId, { outcome: "refused", motif, ...usageSoFar() });
    console.info(JSON.stringify({ event: "analysis_refused", motif, ...versions })); // le motif seulement, jamais l'image
  };

  if (!analysed.ok) {
    // Réponse non conforme au schéma deux fois de suite : message neutre, invitation à reprendre la photo.
    await refuse(analysed.motif);
    yield { type: "refused", message: UNREADABLE_MESSAGE };
    return;
  }
  const v = analysed.value;
  if (v.refused) {
    await refuse("sujet_non_conforme");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  if (!v.recevable) {
    await refuse(v.motif);
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  const reperage = v.reperage;

  yield { type: "step", id: "calibration", label: STEP_LABELS.calibration };
  let est;
  try {
    // Le calcul utilise les dimensions réelles de l'image réencodée.
    est = estimateMeasuresPose(reperage, width, height);
  } catch {
    await refuse("calcul_impossible");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  // Cas trop imprécis pour afficher une marge honnête : refusés (seuils mesurés par simulation, voir PHOTO_LIMITS).
  if (est.tiltDeg > PHOTO_LIMITS.maxTiltDeg) {
    await refuse("inclinaison_trop_forte");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  if (est.cardLongEdgePx < PHOTO_LIMITS.minCardFraction * Math.max(width, height)) {
    await refuse("carte_trop_petite");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  if (confidenceIndex(reperage) < MIN_CONFIDENCE * 100) {
    await refuse("confiance_faible");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  const girth = GIRTH_FROM === "max" ? est.girthFromMaxCm : est.girthFromMeanCm;
  if (
    est.lengthCm < ESTIMATE_LIMITS.length.min ||
    est.lengthCm > ESTIMATE_LIMITS.length.max ||
    girth < ESTIMATE_LIMITS.girth.min ||
    girth > ESTIMATE_LIMITS.girth.max
  ) {
    await refuse("mesure_invraisemblable");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }

  yield { type: "step", id: "percentiles", label: STEP_LABELS.percentiles };
  const results = buildPhotoReport({ est, reperage, state: input.state, formula: input.formula, declared: input.declared });

  // Rédaction : texte seul, indicateurs calculés (jamais la photo), réponse JSON validée, une relance. Le modèle de rapport est fixe :
  // sans commentaire conforme, pas de rapport.
  yield { type: "step", id: "redaction", label: STEP_LABELS.redaction };
  let comment: Validated<StandardComment>;
  try {
    comment = await withOneRetry(
      () =>
        deps.vision.writeComment({
          formula: input.formula,
          state: input.state,
          score: results.score,
          lengthPercentile: results.length.percentile,
          girthPercentile: results.girth.percentile,
          marginPct: results.length.marginPct ?? 0,
          symmetry: results.symmetry ?? 0,
          curvatureDeg: results.curvature.angleDeg,
          confidence: results.confidence ?? 0,
          cardFraction: est.cardLongEdgePx / Math.max(width, height),
          tiltDeg: est.tiltDeg,
          declaredGapFlagged: results.declared?.flagged ?? false,
        }),
      validateComment,
      count,
      (r) => r.usage,
    );
  } catch (e) {
    const kind = e instanceof VisionError ? e.kind : "invalid";
    await finishAttempt(attemptId, { outcome: "error", motif: `fournisseur_${kind}`, ...usageSoFar() });
    console.info(JSON.stringify({ event: "analysis_error", motif: `fournisseur_${kind}`, ...versions }));
    yield { type: "error", code: "provider", message: "Le service d'analyse est momentanément indisponible. Réessayez dans quelques minutes." };
    return;
  }
  if (!comment.ok) {
    await refuse(comment.motif);
    yield { type: "refused", message: UNREADABLE_MESSAGE };
    return;
  }
  results.standard = comment.value;
  results.comment = [...comment.value.observations, comment.value.verdict].join(" ");

  const reportId = await createReport({
    formula: input.formula,
    input: { state: input.state, declared: input.declared ?? null } as never,
    results,
    ipHash,
    freeBeta: input.freeBeta === true,
  });
  await finishAttempt(attemptId, { outcome: "ok", ...usageSoFar() });
  console.info(JSON.stringify({ event: "analysis_ok", motif: "ok", ...versions }));
  yield { type: "ready", reportId };
}
