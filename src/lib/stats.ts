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

/**
 * Quantile de la loi normale centrée réduite (inverse de `normalCdf`), algorithme d'Acklam (erreur relative < 1,2e-9).
 * `p` strictement entre 0 et 1.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error("normalQuantile : p doit être strictement entre 0 et 1");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Valeur (cm) sous laquelle se trouve `pct` % de la population de référence (loi normale de moyenne `mean`, écart-type `sd`). */
export function valueAtPercentile(pct: number, mean: number, sd: number): number {
  return mean + sd * normalQuantile(pct / 100);
}
