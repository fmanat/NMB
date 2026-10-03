import { MEDICAL_ADVICE_ANGLE, MORPHO } from "@/config/site";
import { clampPercentile } from "./reportCore";
import { globalScore, percentile, referenceFor, straightness, type BodyState } from "./stats";

// Calculs du rapport morphométrique photo, version 2 (photo-report/2). Fonctions pures : aucun accès serveur, base ou réseau.
// Le modèle d'analyse ne calcule rien : il fournit des estimations (ou des points, si la carte de référence est présente),
// et tout ce qui est affiché comme chiffre dérivé (percentiles, indices, typicité, score) est calculé ici.

export type Direction = "none" | "left" | "right" | "up" | "down";

export const DIRECTION_FROM_MODEL: Record<"aucune" | "gauche" | "droite" | "haut" | "bas", Direction> = {
  aucune: "none",
  gauche: "left",
  droite: "right",
  haut: "up",
  bas: "down",
};

/** Indicateurs du tableau, dans l'ordre d'affichage. */
export const INDICATOR_KEYS = ["longueur", "circonference", "courbure", "rectitude", "symetrie", "conicite", "typicite"] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  longueur: "Longueur",
  circonference: "Circonférence",
  courbure: "Courbure",
  rectitude: "Indice de rectitude axiale",
  symetrie: "Coefficient de symétrie bilatérale",
  conicite: "Index de conicité distale",
  typicite: "Indice de typicité",
};

export type TypicalityLabel = "morphotype classique" | "morphotype distinctif" | "morphotype singulier";

export type MorphoIndicators = {
  state: BodyState;
  longueurCm: number;
  circonferenceCm: number;
  /** Percentile de longueur : en érection seulement (au repos, aucun percentile de longueur n'est donné). */
  percentileLongueur: number | null;
  percentileCirconference: number;
  medianeLongueurCm: number;
  medianeCirconferenceCm: number;
  courbureDeg: number;
  courbureDirection: Direction;
  /** Indices sur 100. */
  rectitude: number;
  symetrie: number;
  conicite: number;
  typicite: number;
  typiciteLibelle: TypicalityLabel;
  /** Rapports bruts estimés (servent au texte, jamais recalculés par le modèle). */
  ratioConicite: number;
  rapportGland: number;
  /** Score global (même formule que les autres rapports, section 5.3 du cahier des charges). */
  score: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp100 = (n: number) => Math.min(100, Math.max(0, n));

/** Indice de typicité : moyenne de 100 − 2 × |percentile − 50| sur les percentiles disponibles, arrondie à l'entier. */
export function typicality(percentiles: number[]): number {
  if (percentiles.length === 0) throw new RangeError("Aucun percentile disponible.");
  const parts = percentiles.map((p) => 100 - 2 * Math.abs(p - 50));
  return Math.round(clamp100(parts.reduce((s, x) => s + x, 0) / parts.length));
}

export function typicalityLabel(index: number): TypicalityLabel {
  if (index >= MORPHO.typicality.classicFrom) return "morphotype classique";
  if (index >= MORPHO.typicality.distinctiveFrom) return "morphotype distinctif";
  return "morphotype singulier";
}

/** Indice de rectitude axiale sur 100 : 100 à 0°, 0 à partir de l'angle de rectitude nulle (même règle que le score). */
export const rectitudeIndex = (angleDeg: number): number => Math.round(100 * straightness(angleDeg));

/** Index de conicité distale sur 100, à partir du rapport largeur sous le gland / largeur à la base. */
export const conicityIndex = (ratio: number): number => Math.round(clamp100(100 * (1 - Math.abs(ratio - 1) / MORPHO.conicity.zeroAtDeviation)));

/** Calcule tous les indicateurs à partir des valeurs retenues (mesure calibrée ou estimation) et des estimations de forme. */
export function computeIndicators(args: {
  state: BodyState;
  lengthCm: number;
  girthCm: number;
  curvatureDeg: number;
  direction: Direction;
  symmetry: number;
  glansRatio: number;
  taperRatio: number;
}): MorphoIndicators {
  const { state } = args;
  const lenRef = referenceFor(state, "length");
  const girthRef = referenceFor(state, "girth");
  const longueurCm = round1(args.lengthCm);
  const circonferenceCm = round1(args.girthCm);
  // Au repos : aucun percentile de longueur, seule la circonférence est positionnée.
  const percentileLongueur = state === "erect" ? clampPercentile(percentile(longueurCm, lenRef.mean, lenRef.sd)) : null;
  const percentileCirconference = clampPercentile(percentile(circonferenceCm, girthRef.mean, girthRef.sd));
  const courbureDeg = Math.round(Math.max(0, args.curvatureDeg));
  const courbureDirection = courbureDeg < 5 ? "none" : args.direction;
  const symetrie = Math.round(clamp100(args.symmetry));
  const typicite = typicality(percentileLongueur === null ? [percentileCirconference] : [percentileLongueur, percentileCirconference]);
  const score = globalScore({
    ...(percentileLongueur === null ? {} : { length: percentileLongueur / 100 }),
    girth: percentileCirconference / 100,
    symmetry: symetrie / 100,
    straightness: straightness(courbureDeg),
  });
  return {
    state,
    longueurCm,
    circonferenceCm,
    percentileLongueur,
    percentileCirconference,
    medianeLongueurCm: lenRef.mean,
    medianeCirconferenceCm: girthRef.mean,
    courbureDeg,
    courbureDirection,
    rectitude: rectitudeIndex(courbureDeg),
    symetrie,
    conicite: conicityIndex(args.taperRatio),
    typicite,
    typiciteLibelle: typicalityLabel(typicite),
    ratioConicite: round2(args.taperRatio),
    rapportGland: round2(args.glansRatio),
    score,
  };
}

/** Valeur « de force » d'un indicateur sur 100, ou null s'il n'est pas classable (courbure : portée par la rectitude ; longueur au repos). */
export function strengthOf(ind: MorphoIndicators, key: IndicatorKey): number | null {
  switch (key) {
    case "longueur":
      return ind.percentileLongueur;
    case "circonference":
      return ind.percentileCirconference;
    case "courbure":
      return null;
    case "rectitude":
      return ind.rectitude;
    case "symetrie":
      return ind.symetrie;
    case "conicite":
      return ind.conicite;
    case "typicite":
      return ind.typicite;
  }
}

/**
 * Indicateurs favorables, du plus fort au moins fort (à égalité : ordre du tableau). Si moins de trois indicateurs atteignent le seuil,
 * la liste est complétée par les meilleurs suivants, pour que les trois points remarquables portent toujours sur les plus favorables.
 * Les deux premiers ouvrent la synthèse.
 */
export function favourableIndicators(ind: MorphoIndicators): IndicatorKey[] {
  const ranked = INDICATOR_KEYS.map((k, i) => ({ k, i, v: strengthOf(ind, k) }))
    .filter((x): x is { k: IndicatorKey; i: number; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v || a.i - b.i);
  const favourable = ranked.filter((x) => x.v >= MORPHO.favourableFrom);
  const list = favourable.length >= 3 ? favourable : ranked.slice(0, Math.max(3, favourable.length));
  return list.map((x) => x.k);
}

/** Valeurs basses (percentile sous le seuil) : longueur et circonférence seulement. Le texte les désigne au plus une fois par « gabarit compact ». */
export function lowIndicators(ind: MorphoIndicators): IndicatorKey[] {
  const out: IndicatorKey[] = [];
  if (ind.percentileLongueur !== null && ind.percentileLongueur < MORPHO.lowPercentileBelow) out.push("longueur");
  if (ind.percentileCirconference < MORPHO.lowPercentileBelow) out.push("circonference");
  return out;
}

/** Une phrase suggérant un avis médical est exigée dans « Axe et courbure » à partir de cet angle. */
export const needsMedicalSentence = (ind: Pick<MorphoIndicators, "courbureDeg">): boolean => ind.courbureDeg >= MEDICAL_ADVICE_ANGLE;

// ---------- Mise en forme (une seule source pour la page, le PDF, le kit de test et le prompt de rédaction) ----------

/** Nombre à la française, une décimale au plus (14,2 ; 13). */
export const frNum = (n: number, decimals = 1): string => {
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f).replace(".", ",");
};

const DIRECTION_TEXT: Record<Direction, string> = { none: "", left: "vers la gauche", right: "vers la droite", up: "vers le haut", down: "vers le bas" };

/** Valeur affichée de chaque indicateur (colonne « Valeur » du tableau). */
export function indicatorValue(ind: MorphoIndicators, key: IndicatorKey): string {
  switch (key) {
    case "longueur":
      return `${frNum(ind.longueurCm)} cm${ind.percentileLongueur !== null ? ` · percentile ${Math.round(ind.percentileLongueur)}` : ""}`;
    case "circonference":
      return `${frNum(ind.circonferenceCm)} cm · percentile ${Math.round(ind.percentileCirconference)}`;
    case "courbure":
      return ind.courbureDirection === "none" ? `${ind.courbureDeg}°` : `${ind.courbureDeg}° ${DIRECTION_TEXT[ind.courbureDirection]}`;
    case "rectitude":
      return `${ind.rectitude} / 100`;
    case "symetrie":
      return `${ind.symetrie} / 100`;
    case "conicite":
      return `${ind.conicite} / 100`;
    case "typicite":
      return `${ind.typicite} / 100 · ${ind.typiciteLibelle}`;
  }
}

export const directionText = (d: Direction): string => DIRECTION_TEXT[d];
