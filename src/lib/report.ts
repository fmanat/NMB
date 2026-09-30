import { z } from "zod";
import {
  CURVATURE_ANGLE,
  EVERYDAY_OBJECTS,
  LANDMARKS,
  LIMITS,
  MAX_SIGMA,
  MEDICAL_ADVICE_ANGLE,
} from "@/config/site";
import { globalScore, percentile, referenceFor, straightness, type BodyState } from "./stats";

export const questionnaireSchema = z.object({
  state: z.enum(["rest", "erect"]),
  length: z.number().min(LIMITS.length.min).max(LIMITS.length.max),
  girth: z.number().min(LIMITS.girth.min).max(LIMITS.girth.max),
  curvature: z.enum(["none", "light", "marked"]),
  direction: z.enum(["none", "left", "right", "up", "down"]),
});
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;

/** Vrai si une mesure déclarée dépasse MAX_SIGMA écarts-types de la moyenne de référence de son état. */
export function isOutOfReferenceRange(input: Pick<QuestionnaireInput, "state" | "length" | "girth">): boolean {
  return (["length", "girth"] as const).some((dim) => {
    const ref = referenceFor(input.state, dim);
    return Math.abs(input[dim] - ref.mean) / ref.sd > MAX_SIGMA;
  });
}

export type Measure = {
  value: number;
  percentile: number;
  referenceMedian: number;
  /** Marge d'erreur en % (formules photo uniquement ; les valeurs déclarées n'ont pas de marge). */
  marginPct?: number;
};

export type DeclaredComparison = {
  declaredLength: number;
  declaredGirth: number;
  /** Écart estimé par rapport au déclaré, en % (positif : l'estimation est plus grande). */
  lengthGapPct: number;
  girthGapPct: number;
  flagged: boolean;
};

export type ReportResults = {
  formula: "A" | "B" | "C";
  state: BodyState;
  score: number;
  length: Measure;
  girth: Measure;
  curvature: { category: QuestionnaireInput["curvature"]; angleDeg: number; direction: QuestionnaireInput["direction"] };
  everyday: { label: string; times: number }[];
  landmarks: { label: string; times: number }[];
  comment: string;
  /** Formules photo : indice de confiance (0 à 100), symétrie (0 à 100), conicité. */
  confidence?: number;
  symmetry?: number;
  taper?: number;
  /** Formule C : comparaison déclaré / estimé. */
  declared?: DeclaredComparison;
};

export const DIRECTION_FR = {
  none: "",
  left: "vers la gauche",
  right: "vers la droite",
  up: "vers le haut",
  down: "vers le bas",
} as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Un percentile n'est jamais affiché à 0 ou 100 : on borne à 0,1 et 99,9. */
export const clampPercentile = (p: number) => Math.min(99.9, Math.max(0.1, round1(p)));
const fmt = (n: number) => String(round1(n)).replace(".", ",");

function measure(state: BodyState, dim: "length" | "girth", value: number): Measure {
  const ref = referenceFor(state, dim);
  return { value, percentile: clampPercentile(percentile(value, ref.mean, ref.sd)), referenceMedian: ref.mean };
}

export function buildQuestionnaireReport(input: QuestionnaireInput): ReportResults {
  const length = measure(input.state, "length", input.length);
  const girth = measure(input.state, "girth", input.girth);
  const angleDeg = CURVATURE_ANGLE[input.curvature];
  const score = globalScore({
    length: length.percentile / 100,
    girth: girth.percentile / 100,
    straightness: straightness(angleDeg),
  });

  const stateLabel = input.state === "rest" ? "au repos" : "en érection";
  let comment =
    `Les mesures déclarées ${stateLabel} placent la longueur au percentile ${Math.round(length.percentile)} ` +
    `(${fmt(length.value)} cm, médiane de référence ${fmt(length.referenceMedian)} cm) et la circonférence au percentile ` +
    `${Math.round(girth.percentile)} (${fmt(girth.value)} cm, médiane de référence ${fmt(girth.referenceMedian)} cm). ` +
    `Le score composite ressort à ${score}/100. ` +
    `Ce score est une note de présentation calibrée de façon indulgente : pour situer une mesure dans la population, ` +
    `seuls les percentiles font foi. Ces résultats reposent sur des valeurs déclarées et n'ont pas été vérifiés.`;
  if (angleDeg >= MEDICAL_ADVICE_ANGLE) {
    comment += " La courbure déclarée est marquée : en cas de gêne ou de douleur, un avis médical est recommandé.";
  }

  return {
    formula: "A",
    state: input.state,
    score,
    length,
    girth,
    curvature: { category: input.curvature, angleDeg, direction: input.direction },
    everyday: EVERYDAY_OBJECTS.map((o) => ({ label: o.label, times: round1(o.cm / input.length) })),
    landmarks: LANDMARKS.map((l) => ({ label: l.label, times: Math.round((l.m * 100) / input.length) })),
    comment,
  };
}
