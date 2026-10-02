/** Nombre à une décimale, virgule française (14,2). */
export const f1 = (n: number): string => String(Math.round(n * 10) / 10).replace(".", ",");

/** « Au-dessus de 66 % de la population de référence » : partie entière (jamais arrondi à la hausse, jamais flatté). */
export const aboveText = (percentile: number): string => `Au-dessus de ${Math.floor(percentile)} % de la population de référence`;
