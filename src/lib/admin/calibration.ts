import type { CalibrationPair } from "../repo";

// Calibration du moteur photo (photo-report/2) : comparaison des paires (mesure par la carte de référence, estimation du modèle
// sans la carte). Fonctions pures, testées. But : voir si le modèle RAMÈNE SES ESTIMATIONS VERS LA MOYENNE, c'est-à-dire s'il
// surestime les petites tailles et sous-estime les grandes. Signes : écart moyen positif dans les tranches basses, négatif dans les
// tranches hautes, et pente de la droite des moindres carrés (estimation en fonction de la mesure) nettement inférieure à 1.

/** Bornes des tranches de taille (cm), d'après la mesure par la carte. Une tranche contient sa borne basse. */
export const CALIBRATION_BANDS = {
  length: [11, 13, 15, 17],
  girth: [10, 11.5, 13, 14.5],
} as const;

export type Dim = "length" | "girth";

export type BandStat = {
  label: string;
  n: number;
  /** Écart moyen estimation − mesure, en cm et en % de la mesure (null si la tranche est vide). */
  meanGapCm: number | null;
  meanGapPct: number | null;
};

export type DimSummary = {
  n: number;
  points: { card: number; model: number }[];
  bands: BandStat[];
  /** Écart moyen et écart absolu moyen, en % de la mesure. */
  meanGapPct: number | null;
  meanAbsGapPct: number | null;
  /** Pente des moindres carrés (estimation = a + pente × mesure). 1 : pas de retour vers la moyenne. Null sous 3 paires ou sans dispersion. */
  slope: number | null;
};

const fr = (n: number) => String(n).replace(".", ",");

function bandLabels(bounds: readonly number[]): string[] {
  const out = [`moins de ${fr(bounds[0])} cm`];
  for (let i = 0; i + 1 < bounds.length; i++) out.push(`${fr(bounds[i])} à ${fr(bounds[i + 1])} cm`);
  out.push(`${fr(bounds[bounds.length - 1])} cm et plus`);
  return out;
}

const bandIndex = (bounds: readonly number[], v: number) => bounds.filter((b) => v >= b).length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function summarizeDim(pairs: CalibrationPair[], dim: Dim): DimSummary {
  const points = pairs.map((p) => (dim === "length" ? { card: p.cardLengthCm, model: p.modelLengthCm } : { card: p.cardGirthCm, model: p.modelGirthCm }));
  const bounds = CALIBRATION_BANDS[dim];
  const labels = bandLabels(bounds);
  const groups: { card: number; model: number }[][] = labels.map(() => []);
  for (const pt of points) groups[bandIndex(bounds, pt.card)].push(pt);
  const bands: BandStat[] = groups.map((g, i) => ({
    label: labels[i],
    n: g.length,
    meanGapCm: mean(g.map((p) => p.model - p.card)),
    meanGapPct: mean(g.map((p) => ((p.model - p.card) / p.card) * 100)),
  }));
  let slope: number | null = null;
  if (points.length >= 3) {
    const mx = mean(points.map((p) => p.card))!;
    const my = mean(points.map((p) => p.model))!;
    const sxx = points.reduce((s, p) => s + (p.card - mx) ** 2, 0);
    const sxy = points.reduce((s, p) => s + (p.card - mx) * (p.model - my), 0);
    slope = sxx > 1e-9 ? sxy / sxx : null;
  }
  return {
    n: points.length,
    points,
    bands,
    meanGapPct: mean(points.map((p) => ((p.model - p.card) / p.card) * 100)),
    meanAbsGapPct: mean(points.map((p) => (Math.abs(p.model - p.card) / p.card) * 100)),
    slope,
  };
}

export function calibrationSummary(pairs: CalibrationPair[]): Record<Dim, DimSummary> {
  return { length: summarizeDim(pairs, "length"), girth: summarizeDim(pairs, "girth") };
}
