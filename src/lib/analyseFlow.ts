import { ESTIMATE_LIMITS, GIRTH_FROM, LIMITS, MEDICAL_ADVICE_ANGLE, MIN_CONFIDENCE, RATE_LIMIT, type FormulaId } from "@/config/site";
import { confidenceIndex, estimateMeasures } from "./measure";
import { ImageError, prepareImage } from "./image";
import { buildPhotoReport } from "./photoReport";
import type { CaptchaProvider, ImageScreeningProvider } from "./providers/types";
import { isOutOfReferenceRange } from "./report";
import { addAttemptTokens, countAttemptsByIp, createReport, finishAttempt, hashIp, startAttempt, updateComment } from "./repo";
import type { BodyState } from "./stats";
import { VisionError, type VisionProvider } from "./vision/types";
import { validateReperage } from "./vision/validate";

export type StepId = "recevabilite" | "calibration" | "percentiles";

export const STEP_LABELS: Record<StepId, string> = {
  recevabilite: "Contrôle de recevabilité et extraction de la ligne médiane",
  calibration: "Calibration sur la carte de référence",
  percentiles: "Calcul des percentiles",
};

export type FlowEvent =
  | { type: "step"; id: StepId; label: string }
  | { type: "refused"; message: string }
  | { type: "error"; code: "age" | "consent" | "declared" | "captcha" | "rate" | "image" | "provider"; message: string }
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
};

export type FlowDeps = { vision: VisionProvider; screening: ImageScreeningProvider; captcha: CaptchaProvider };

// Message volontairement neutre : il ne détaille jamais le motif (en particulier un doute sur l'âge).
export const NEUTRAL_REFUSAL =
  "Cette image n'a pas pu être analysée. Reprenez la photo en suivant les consignes (carte de référence entière et visible, bonne lumière, aucun visage ni élément identifiant).";

/** Commentaire rédigé par le modèle : accepté seulement s'il respecte la longueur attendue. */
export function acceptComment(text: string | null, curvatureDeg: number): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  if (words < 100 || words > 220) return null;
  let out = text.trim();
  if (curvatureDeg >= MEDICAL_ADVICE_ANGLE && !/avis médical/i.test(out)) {
    out += " La courbure estimée est marquée : en cas de gêne ou de douleur, un avis médical est recommandé.";
  }
  return out;
}

/**
 * Déroule l'analyse d'une photo, dans l'ordre : âge, consentements, mesures déclarées, captcha, limite de débit,
 * réencodage, filtrage d'empreintes, recevabilité + repérage, calculs, création du rapport (non payé).
 * Produit des événements que l'interface affiche en direct : uniquement des étapes réellement exécutées.
 */
export async function* runAnalysis(input: FlowInput, deps: FlowDeps): AsyncGenerator<FlowEvent> {
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

  const ipHash = hashIp(input.ip);
  if ((await countAttemptsByIp(ipHash)) >= RATE_LIMIT.maxPerWindow) {
    yield { type: "error", code: "rate", message: `Limite atteinte : ${RATE_LIMIT.maxPerWindow} analyses par période de ${RATE_LIMIT.windowHours} h.` };
    return;
  }
  const attemptId = await startAttempt(ipHash, input.formula);

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
  const screened = await deps.screening.screen(buf);
  if (screened.blocked) {
    await finishAttempt(attemptId, { outcome: "blocked", motif: "empreinte_connue" });
    console.info(JSON.stringify({ event: "analysis_blocked", motif: "empreinte_connue" }));
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }

  yield { type: "step", id: "recevabilite", label: STEP_LABELS.recevabilite };
  let vision;
  try {
    vision = await deps.vision.analyse(buf);
  } catch (e) {
    const kind = e instanceof VisionError ? e.kind : "invalid";
    await finishAttempt(attemptId, { outcome: "error", motif: `fournisseur_${kind}` });
    console.info(JSON.stringify({ event: "analysis_error", motif: `fournisseur_${kind}` }));
    yield { type: "error", code: "provider", message: "Le service d'analyse est momentanément indisponible. Réessayez dans quelques minutes." };
    return;
  }
  const usage = { visionMs: vision.usage.ms, tokensIn: vision.usage.tokensIn, tokensOut: vision.usage.tokensOut };

  const refuse = async (motif: string) => {
    await finishAttempt(attemptId, { outcome: "refused", motif, ...usage });
    console.info(JSON.stringify({ event: "analysis_refused", motif })); // le motif seulement, jamais l'image
  };

  if (!vision.recevable) {
    await refuse(vision.motif);
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }
  const reperage = validateReperage(vision.reperage);
  if (!reperage) {
    await refuse("reperage_incomplet");
    yield { type: "refused", message: NEUTRAL_REFUSAL };
    return;
  }

  yield { type: "step", id: "calibration", label: STEP_LABELS.calibration };
  let est;
  try {
    // Le calcul utilise les dimensions réelles de l'image réencodée.
    est = estimateMeasures(reperage, width, height);
  } catch {
    await refuse("calcul_impossible");
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
  const reportId = await createReport({
    formula: input.formula,
    input: { state: input.state, declared: input.declared ?? null } as never,
    results,
    ipHash,
  });
  await finishAttempt(attemptId, { outcome: "ok", ...usage });
  yield { type: "ready", reportId };

  // Suite après l'aperçu : le commentaire rédigé remplace le commentaire de repli dès qu'il est prêt.
  try {
    const comment = await deps.vision.writeComment({
      formula: input.formula,
      state: input.state,
      score: results.score,
      lengthPercentile: results.length.percentile,
      girthPercentile: results.girth.percentile,
      lengthMarginPct: results.length.marginPct ?? 0,
      symmetry: results.symmetry ?? 0,
      curvatureDeg: results.curvature.angleDeg,
      confidence: results.confidence ?? 0,
      declaredGapFlagged: results.declared?.flagged ?? false,
    });
    await addAttemptTokens(attemptId, comment.usage.tokensIn, comment.usage.tokensOut);
    const accepted = acceptComment(comment.text, results.curvature.angleDeg);
    if (accepted) await updateComment(reportId, accepted);
  } catch {
    // le commentaire de repli reste en place
  }
}
