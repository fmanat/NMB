import {
  CURVATURE_ANGLE,
  REFERENCES,
  SCORE,
  STRAIGHTNESS_ZERO_ANGLE,
} from "@/config/site";

export type BodyState = "rest" | "erect";
export type Curvature = keyof typeof CURVATURE_ANGLE;

// Fonction d'erreur, approximation d'Abramowitz et Stegun 7.1.26 (erreur max ~1,5e-7).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Fonction de répartition de la loi normale centrée réduite. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Percentile (0 à 100) d'une valeur pour une loi normale (moyenne, écart-type). */
export function percentile(value: number, mean: number, sd: number): number {
  return normalCdf((value - mean) / sd) * 100;
}

export function referenceFor(state: BodyState, dim: "length" | "girth") {
  return REFERENCES[state === "rest" ? "flaccid" : "erect"][dim];
}

/** Rectitude entre 0 et 1 : 1 à 0°, 0 à partir de STRAIGHTNESS_ZERO_ANGLE. */
export function straightness(angleDeg: number): number {
  return Math.min(1, Math.max(0, 1 - Math.abs(angleDeg) / STRAIGHTNESS_ZERO_ANGLE));
}

export type ScoreComponents = {
  length?: number; // 0 à 1
  girth?: number;
  symmetry?: number;
  straightness?: number;
};

/**
 * Score global : floor + span × P^exponent, borné entre floor et ceiling.
 * P = moyenne pondérée des composantes disponibles (poids renormalisés si l'une manque).
 */
export function globalScore(c: ScoreComponents): number {
  const w = SCORE.weights;
  let sum = 0;
  let weight = 0;
  for (const key of ["length", "girth", "symmetry", "straightness"] as const) {
    const v = c[key];
    if (v === undefined) continue;
    sum += w[key] * Math.min(1, Math.max(0, v));
    weight += w[key];
  }
  if (weight === 0) throw new Error("Aucune composante de score");
  const p = sum / weight;
  const raw = SCORE.floor + SCORE.span * Math.pow(p, SCORE.exponent);
  return Math.round(Math.min(SCORE.ceiling, Math.max(SCORE.floor, raw)));
}
