// Statistiques de calibration : comparer mesures estimées et mesures réelles sur un lot de photos de référence.

export type CalibrationPoint = { real: number; est: number; marginPct: number };

export type CalibrationSummary = {
  n: number;
  /** Biais moyen en % (positif : l'estimation surestime). */
  meanSignedPct: number;
  meanAbsPct: number;
  medianAbsPct: number;
  p80AbsPct: number;
  p90AbsPct: number;
  /** Part des mesures (0 à 1) dont l'écart est au plus de 10 %. */
  within10: number;
  /** Part des mesures (0 à 1) dont l'écart reste dans la marge affichée. */
  withinMargin: number;
};

export const errorPct = (est: number, real: number) => ((est - real) / real) * 100;

/** Percentile par interpolation linéaire sur des valeurs déjà triées. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(points: CalibrationPoint[]): CalibrationSummary | null {
  if (points.length === 0) return null;
  const signed = points.map((p) => errorPct(p.est, p.real));
  const abs = signed.map(Math.abs).sort((a, b) => a - b);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    n: points.length,
    meanSignedPct: mean(signed),
    meanAbsPct: mean(abs),
    medianAbsPct: quantile(abs, 0.5),
    p80AbsPct: quantile(abs, 0.8),
    p90AbsPct: quantile(abs, 0.9),
    within10: signed.filter((e) => Math.abs(e) <= 10).length / points.length,
    withinMargin: points.filter((p, i) => Math.abs(signed[i]) <= p.marginPct).length / points.length,
  };
}

/** Nombre minimal de mesures avant de tirer une conclusion sur la marge d'erreur. */
export const MIN_SAMPLES_FOR_MARGIN = 15;

/** Marge suggérée : le 90e percentile de l'écart absolu, arrondi à l'entier supérieur, jamais sous le plancher. */
export function suggestedMargin(s: CalibrationSummary, floorPct: number): number | null {
  if (s.n < MIN_SAMPLES_FOR_MARGIN) return null;
  return Math.max(floorPct, Math.ceil(s.p90AbsPct));
}
