import { ESTIMATE_LIMITS, GIRTH_FROM, LIMITS, MIN_CONFIDENCE, PHOTO_LIMITS, RATE_LIMIT, DECLARED_GAP_WARN_PCT, type FormulaId } from "@/config/site";
import { confidenceIndex, type ReperageNorm } from "./measure";
import { DIRECTION_FROM_MODEL, computeIndicators, favourableIndicators, type MorphoIndicators } from "./morpho";
import { estimateMeasuresPose } from "./pose";
import { ImageError, prepareImage } from "./image";
import { buildMorphoResults, buildPartialResults, newReportNumber } from "./photoReport2";
import type { CaptchaProvider, ImageScreeningProvider } from "./providers/types";
import { isOutOfReferenceRange, type ReportResults } from "./report";
import { countAttemptsByIp, createReport, finishAttempt, hashIp, saveCalibrationPair, startAttempt, type CalibrationPair } from "./repo";
import type { BodyState } from "./stats";
import { PROMPT_VERSION } from "./vision/prompts";
import { checkReportText, type ReportText } from "./vision/reportText";
import { PHOTO_REPORT_V2, validateVisionV2, type EstimationsV2, type ObservationsV2, type VisionV2 } from "./vision/schema2";
import { VisionError, type Usage, type VisionProvider } from "./vision/types";
import { dbSpendGate, usageCostMicros, type Reservation, type SpendGate } from "./xaiSpend";

// Flux d'analyse d'une photo, version 2 (photo-report/2, formule B ; la formule C ajoute la comparaison avec les mesures déclarées).
//   1. Contrôles (âge, consentements, mesures déclarées, captcha, limite par adresse, plafond de dépense), réencodage, filtrage.
//   2. Appel vision (avec la photo) : recevabilité, estimations, observations, points. JSON validé, une relance.
//   3. Calculs par le code : mesure calibrée sur la carte si elle est présente et exploitable (sinon estimations du modèle),
//      percentiles, indices, typicité, score.
//   4. Appel texte (sans la photo) : rapport rédigé, vérifié par le code (interdits), une relance.
// Refus de recevabilité : aucun rapport, message neutre. Échec technique : rapport PARTIEL sur les valeurs de référence.
// Les observations brutes du modèle et la photo ne sont jamais stockées ni journalisées.

export type { CalibrationPair };

export type StepId = "recevabilite" | "calibration" | "indicateurs" | "redaction";

export const STEP_LABELS: Record<StepId, string> = {
  recevabilite: "Contrôle de recevabilité et estimation morphométrique",
  calibration: "Calibration sur la carte de référence",
  indicateurs: "Calcul des percentiles et des indices",
  redaction: "Rédaction du rapport",
};

export type FlowEvent =
  | { type: "step"; id: StepId; label: string }
  | { type: "refused"; message: string }
  | { type: "error"; code: "age" | "consent" | "declared" | "captcha" | "rate" | "cap" | "image"; message: string }
  | { type: "ready"; reportId: string; partial?: boolean };

export type FlowInput = {
  formula: Extract<FormulaId, "B" | "C">;
  /** État déclaré par l'utilisateur : sert au rapport partiel (le rapport complet utilise l'état observé par le modèle). */
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
 * Accès aux données du flux (limite par adresse, tentatives, création du rapport, paires de calibration). Par défaut : la base du site.
 * Injectable pour l'outil de test local (scripts/photo-test.mts, option « sans base ») : même chaîne, aucune écriture en base.
 */
export type FlowStore = {
  hashIp(ip: string): string;
  countAttemptsByIp(ipHash: string): Promise<number>;
  startAttempt(ipHash: string | null, formula: "B" | "C"): Promise<number>;
  finishAttempt: (id: number, r: { outcome: "ok" | "refused" | "blocked" | "error"; motif?: string; visionMs?: number; tokensIn?: number; tokensOut?: number }) => Promise<void>;
  createReport: (args: Parameters<typeof createReport>[0]) => Promise<string>;
  saveCalibrationPair: (p: CalibrationPair) => Promise<void>;
};

export const dbStore: FlowStore = { hashIp, countAttemptsByIp, startAttempt, finishAttempt, createReport, saveCalibrationPair };

export type FlowDeps = { vision: VisionProvider; screening: ImageScreeningProvider; captcha: CaptchaProvider; spend?: SpendGate; store?: FlowStore };

// Messages volontairement neutres : ils ne détaillent jamais le motif (en particulier un doute sur l'âge).
export const NEUTRAL_REFUSAL =
  "Cette image n'a pas pu être analysée. Reprenez la photo en suivant les consignes (sujet entier et net, bonne lumière, aucun visage ni élément identifiant).";
/** Plafond de dépense xAI du jour atteint : aucun appel au modèle, la tentative ne compte pas dans la limite par adresse. */
export const CAP_MESSAGE = "Capacité du jour atteinte, revenez demain.";

/** Versions de la réponse standardisée, inscrites dans chaque rapport et chaque ligne de journal. */
export const STANDARD_VERSIONS = { schemaVersion: PHOTO_REPORT_V2, promptVersion: PROMPT_VERSION } as const;

type Validated<T> = { ok: true; value: T } | { ok: false; motif: string };

/**
 * Appelle le modèle, valide sa réponse ; réponse invalide : UNE SEULE relance, puis échec.
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

type VisionOutcome = { refused: true } | { refused: false; value: VisionV2 };

/** Validation de la réponse de l'appel vision contre le schéma photo-report/2. */
export function validateVision(r: { refused: boolean; json: unknown }): Validated<VisionOutcome> {
  if (r.refused) return { ok: true, value: { refused: true } };
  const v = validateVisionV2(r.json);
  return v ? { ok: true, value: { refused: false, value: v } } : { ok: false, motif: "vision_invalide" };
}

/** Mesure calibrée sur la carte : longueur et circonférence géométriques, ou la raison pour laquelle elle est écartée. */
export function calibratedMeasure(reperage: ReperageNorm, width: number, height: number): { ok: true; lengthCm: number; girthCm: number } | { ok: false; reason: string } {
  let est;
  try {
    est = estimateMeasuresPose(reperage, width, height);
  } catch {
    return { ok: false, reason: "calcul_impossible" };
  }
  if (est.tiltDeg > PHOTO_LIMITS.maxTiltDeg) return { ok: false, reason: "inclinaison_trop_forte" };
  if (est.cardLongEdgePx < PHOTO_LIMITS.minCardFraction * Math.max(width, height)) return { ok: false, reason: "carte_trop_petite" };
  if (confidenceIndex(reperage) < MIN_CONFIDENCE * 100) return { ok: false, reason: "confiance_faible" };
  const girth = GIRTH_FROM === "max" ? est.girthFromMaxCm : est.girthFromMeanCm;
  if (!withinEstimateLimits(est.lengthCm, girth)) return { ok: false, reason: "mesure_invraisemblable" };
  return { ok: true, lengthCm: est.lengthCm, girthCm: girth };
}

const withinEstimateLimits = (length: number, girth: number) =>
  length >= ESTIMATE_LIMITS.length.min && length <= ESTIMATE_LIMITS.length.max && girth >= ESTIMATE_LIMITS.girth.min && girth <= ESTIMATE_LIMITS.girth.max;

/**
 * Rédaction vérifiée : un premier appel ; s'il viole une règle (stricte ou souple), une relance qui transmet les règles violées.
 * Après la relance : la meilleure rédaction sans violation STRICTE est retenue (écarts souples tolérés : la relance, sinon la première) ;
 * aucune : échec.
 */
async function writeCheckedReport(
  vision: VisionProvider,
  args: { indicators: MorphoIndicators; method: "visuelle" | "calibree"; observations: ObservationsV2 },
  onUsage: (u: Usage) => void,
): Promise<{ ok: true; text: ReportText; soft: string[] } | { ok: false; motif: string }> {
  const allowedHighlights = favourableIndicators(args.indicators);
  const ctx = { indicators: args.indicators, allowedHighlights };
  let previous: string[] | undefined;
  let lastMotif = "redaction_invalide";
  let fallback: { text: ReportText; soft: string[] } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await vision.writeReport({ ...args, allowedHighlights, previousViolations: previous });
    onUsage(r.usage);
    if (r.refused) {
      lastMotif = "redaction_refusee";
      previous = undefined;
      continue;
    }
    const check = checkReportText(r.json, ctx);
    if (check.ok && (check.soft.length === 0 || attempt === 1)) return { ok: true, text: check.value, soft: check.soft };
    if (check.ok) fallback = { text: check.value, soft: check.soft };
    previous = check.ok ? check.soft : [...check.hard, ...check.soft];
    lastMotif = check.ok ? "redaction_ecarts" : "redaction_interdits";
  }
  return fallback ? { ok: true, ...fallback } : { ok: false, motif: lastMotif };
}

/**
 * Déroule l'analyse d'une photo. Produit des événements que l'interface affiche en direct : uniquement des étapes réellement exécutées.
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

const modelState = (e: EstimationsV2): BodyState => (e.etat === "repos" ? "rest" : "erect");

async function* analyseWithReservation(input: FlowInput, deps: FlowDeps, store: FlowStore, ipHash: string, onUsage: (u: Usage) => void): AsyncGenerator<FlowEvent> {
  const attemptId = await store.startAttempt(ipHash, input.formula);
  const versions = STANDARD_VERSIONS;
  const numero = newReportNumber();

  let jpeg: Buffer;
  let width = 1;
  let height = 1;
  try {
    if (!input.photo) throw new ImageError("absente");
    ({ jpeg, width, height } = await prepareImage(input.photo));
  } catch (e) {
    await store.finishAttempt(attemptId, { outcome: "error", motif: "image_invalide" });
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
    await store.finishAttempt(attemptId, { outcome: "blocked", motif: "empreinte_connue" });
    console.info(JSON.stringify({ event: "analysis_blocked", motif: "empreinte_connue" }));
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }

  const t0 = Date.now();
  const tokens = { tokensIn: 0, tokensOut: 0 };
  const count = (u: Usage) => {
    tokens.tokensIn += u.tokensIn;
    tokens.tokensOut += u.tokensOut;
    onUsage(u);
  };
  const usageSoFar = () => ({ visionMs: Date.now() - t0, tokensIn: tokens.tokensIn, tokensOut: tokens.tokensOut });

  const refuse = async (motif: string) => {
    await store.finishAttempt(attemptId, { outcome: "refused", motif, ...usageSoFar() });
    console.info(JSON.stringify({ event: "analysis_refused", motif, ...versions })); // le motif seulement, jamais l'image
  };

  /** Échec technique : rapport partiel sur les valeurs de référence et l'état déclaré, sans aucune mesure. */
  const partial = async (cause: string): Promise<FlowEvent> => {
    const results = buildPartialResults({ formula: input.formula, state: input.state, numero, versions });
    const reportId = await store.createReport({
      formula: input.formula,
      input: { state: input.state, declared: input.declared ?? null } as never,
      results,
      ipHash,
      freeBeta: input.freeBeta === true,
      log: false,
    });
    await store.finishAttempt(attemptId, { outcome: "error", motif: `partiel_${cause}`, ...usageSoFar() });
    console.info(JSON.stringify({ event: "analysis_partial", motif: cause, ...versions }));
    return { type: "ready", reportId, partial: true };
  };

  // ---- 1. Appel vision ----
  yield { type: "step", id: "recevabilite", label: STEP_LABELS.recevabilite };
  let analysed: Validated<VisionOutcome>;
  try {
    analysed = await withOneRetry(() => deps.vision.analyse(buf), validateVision, count, (r) => r.usage);
  } catch (e) {
    yield await partial(`fournisseur_${e instanceof VisionError ? e.kind : "invalid"}`);
    return;
  }
  if (!analysed.ok) {
    yield await partial(analysed.motif); // réponse non conforme deux fois de suite
    return;
  }
  if (analysed.value.refused) {
    await refuse("refus_prestataire");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  const vision = analysed.value.value;
  if (!vision.recevable) {
    if (vision.motif === "qualite_insuffisante") {
      yield await partial("qualite_insuffisante"); // photo difficile à lire : échec technique, pas un refus
      return;
    }
    await refuse(vision.motif);
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  const est = vision.estimations;
  if (!withinEstimateLimits(est.longueur_cm, est.circonference_cm)) {
    yield await partial("estimation_invraisemblable");
    return;
  }

  // ---- 2. Calibration sur la carte (si présente et lisible), sinon estimations du modèle ----
  let method: "visuelle" | "calibree" = "visuelle";
  let lengthCm = est.longueur_cm;
  let girthCm = est.circonference_cm;
  if (vision.reperage) {
    yield { type: "step", id: "calibration", label: STEP_LABELS.calibration };
    const m = calibratedMeasure(vision.reperage, width, height);
    if (m.ok) {
      method = "calibree";
      lengthCm = m.lengthCm;
      girthCm = m.girthCm;
      // Paire de calibration : mesure par la carte et estimation du modèle SANS la carte. Rien d'autre.
      if (withinEstimateLimits(est.longueur_sans_carte_cm, est.circonference_sans_carte_cm)) {
        try {
          await store.saveCalibrationPair({ cardLengthCm: lengthCm, modelLengthCm: est.longueur_sans_carte_cm, cardGirthCm: girthCm, modelGirthCm: est.circonference_sans_carte_cm });
        } catch (e) {
          console.warn(JSON.stringify({ event: "calibration_pair_failed", detail: String((e as Error).message ?? e).slice(0, 120) }));
        }
      }
    } else {
      console.info(JSON.stringify({ event: "calibration_skipped", motif: m.reason })); // la taille reste estimée visuellement
    }
  }

  // ---- 3. Calculs par le code ----
  yield { type: "step", id: "indicateurs", label: STEP_LABELS.indicateurs };
  const indicators = computeIndicators({
    state: modelState(est),
    lengthCm,
    girthCm,
    curvatureDeg: est.courbure_degres,
    direction: DIRECTION_FROM_MODEL[est.courbure_direction],
    symmetry: est.symetrie,
    glansRatio: est.rapport_gland,
    taperRatio: est.conicite,
  });

  // ---- 4. Rédaction (texte seul, sans la photo), vérifiée par le code ----
  yield { type: "step", id: "redaction", label: STEP_LABELS.redaction };
  let written;
  try {
    written = await writeCheckedReport(deps.vision, { indicators, method, observations: vision.observations }, count);
  } catch (e) {
    yield await partial(`fournisseur_${e instanceof VisionError ? e.kind : "invalid"}`);
    return;
  }
  if (!written.ok) {
    yield await partial(written.motif);
    return;
  }

  const results: ReportResults = buildMorphoResults({ formula: input.formula, indicators, method, text: written.text, numero, versions });
  if (input.formula === "C" && input.declared) {
    const d = input.declared;
    const lengthGapPct = Math.round(((indicators.longueurCm - d.length) / d.length) * 1000) / 10;
    const girthGapPct = Math.round(((indicators.circonferenceCm - d.girth) / d.girth) * 1000) / 10;
    results.declared = {
      declaredLength: d.length,
      declaredGirth: d.girth,
      lengthGapPct,
      girthGapPct,
      flagged: Math.abs(lengthGapPct) > DECLARED_GAP_WARN_PCT || Math.abs(girthGapPct) > DECLARED_GAP_WARN_PCT,
    };
  }

  const reportId = await store.createReport({
    formula: input.formula,
    input: { state: input.state, declared: input.declared ?? null } as never,
    results,
    ipHash,
    freeBeta: input.freeBeta === true,
  });
  await store.finishAttempt(attemptId, { outcome: "ok", ...usageSoFar() });
  console.info(JSON.stringify({ event: "analysis_ok", motif: "ok", methode: method, ecarts_redaction: written.soft.length, ...versions }));
  yield { type: "ready", reportId };
}
