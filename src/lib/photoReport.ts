import {
  DECLARED_GAP_WARN_PCT,
  EVERYDAY_OBJECTS,
  GIRTH_FROM,
  LANDMARKS,
  MARGIN,
  MEDICAL_ADVICE_ANGLE,
} from "@/config/site";
import { confidenceIndex, marginPct, type Estimates, type ReperageNorm } from "./measure";
import { clampPercentile, type DeclaredComparison, type Measure, type ReportResults } from "./report";
import { globalScore, percentile, referenceFor, straightness, type BodyState } from "./stats";

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n)).replace(".", ",");

function measure(state: BodyState, dim: "length" | "girth", value: number, margin: number): Measure {
  const ref = referenceFor(state, dim);
  return {
    value,
    percentile: clampPercentile(percentile(value, ref.mean, ref.sd)),
    referenceMedian: ref.mean,
    marginPct: margin,
  };
}

function categoryFor(angle: number): "none" | "light" | "marked" {
  if (angle < 10) return "none";
  if (angle < MEDICAL_ADVICE_ANGLE) return "light";
  return "marked";
}

/** Commentaire déterministe de repli, utilisé tant que le commentaire rédigé par le modèle n'est pas disponible. */
export function templateComment(r: Pick<ReportResults, "state" | "score" | "length" | "girth" | "curvature" | "symmetry" | "confidence">): string {
  const stateLabel = r.state === "rest" ? "au repos" : "en érection";
  let text =
    `L'analyse de l'image, ${stateLabel}, estime la longueur à ${fmt(r.length.value)} cm (percentile ${Math.round(r.length.percentile)}, ` +
    `marge ± ${r.length.marginPct} %) et la circonférence à ${fmt(r.girth.value)} cm (percentile ${Math.round(r.girth.percentile)}, ` +
    `marge ± ${r.girth.marginPct} %). La symétrie ressort à ${Math.round(r.symmetry ?? 0)}/100 pour un indice de confiance de ${Math.round(r.confidence ?? 0)}/100. ` +
    `Le score composite est de ${r.score}/100 ; c'est une note de présentation calibrée de façon indulgente, seuls les percentiles situent une mesure dans la population. ` +
    `Ces valeurs sont des estimations issues d'une photographie et doivent être interprétées avec prudence.`;
  if (r.curvature.angleDeg >= MEDICAL_ADVICE_ANGLE) {
    text += " La courbure estimée est marquée : en cas de gêne ou de douleur, un avis médical est recommandé.";
  }
  return text;
}

/** Assemble les résultats d'un rapport de formule B ou C à partir des mesures estimées. */
export function buildPhotoReport(args: {
  est: Estimates;
  reperage: ReperageNorm;
  state: BodyState;
  formula: "B" | "C";
  declared?: { length: number; girth: number };
}): ReportResults {
  const { est, reperage, state, formula, declared } = args;
  const confidence = confidenceIndex(reperage);
  const margin = marginPct(confidence, est.cardSkew, MARGIN);

  const lengthValue = round1(est.lengthCm);
  const girthValue = round1(GIRTH_FROM === "max" ? est.girthFromMaxCm : est.girthFromMeanCm);
  const length = measure(state, "length", lengthValue, margin);
  const girth = measure(state, "girth", girthValue, margin);

  const angle = Math.abs(est.curvatureSignedDeg);
  const direction = angle < 5 ? "none" : est.curvatureSignedDeg > 0 ? "right" : "left";
  const symmetry = round1(est.symmetry);

  const score = globalScore({
    length: length.percentile / 100,
    girth: girth.percentile / 100,
    symmetry: symmetry / 100,
    straightness: straightness(angle),
  });

  let comparison: DeclaredComparison | undefined;
  if (formula === "C" && declared) {
    const lengthGapPct = round1(((lengthValue - declared.length) / declared.length) * 100);
    const girthGapPct = round1(((girthValue - declared.girth) / declared.girth) * 100);
    comparison = {
      declaredLength: declared.length,
      declaredGirth: declared.girth,
      lengthGapPct,
      girthGapPct,
      flagged: Math.abs(lengthGapPct) > DECLARED_GAP_WARN_PCT || Math.abs(girthGapPct) > DECLARED_GAP_WARN_PCT,
    };
  }

  const results: ReportResults = {
    formula,
    state,
    score,
    length,
    girth,
    curvature: { category: categoryFor(angle), angleDeg: Math.round(angle), direction },
    everyday: EVERYDAY_OBJECTS.map((o) => ({ label: o.label, times: round1(o.cm / lengthValue) })),
    landmarks: LANDMARKS.map((l) => ({ label: l.label, times: Math.round((l.m * 100) / lengthValue) })),
    comment: "",
    confidence: Math.round(confidence),
    symmetry,
    taper: Math.round(est.taper * 100) / 100,
    declared: comparison,
  };
  results.comment = templateComment(results);
  return results;
}
