/** Nombre à une décimale, virgule française (14,2). */
export const f1 = (n: number): string => String(Math.round(n * 10) / 10).replace(".", ",");

/** « Au-dessus de 66 % de la population de référence » : partie entière (jamais arrondi à la hausse, jamais flatté). */
export const aboveText = (percentile: number): string => `Au-dessus de ${Math.floor(percentile)} % de la population de référence`;

/**
 * Rang en toutes lettres : partie entière du percentile (jamais arrondi à la hausse, comme `aboveText`).
 * Aux extrémités : « sous le 1er percentile », « au-delà du 99e percentile » (le rapport borne les percentiles entre 0,1 et 99,9).
 */
export function rankLabel(percentile: number): string {
  if (percentile >= 99.9) return "au-delà du 99e percentile";
  const n = Math.floor(Math.min(99.9, Math.max(0.1, Math.round(percentile * 10) / 10)));
  if (n < 1) return "sous le 1er percentile";
  return n === 1 ? "1er percentile" : `${n}e percentile`;
}
