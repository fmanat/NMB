// Profils morphologiques : une grille 3 × 3 selon deux percentiles RÉELLEMENT calculés par le rapport (longueur et circonférence).
// Module pur (aucun accès serveur, base ou zod), réutilisable par les rapports du questionnaire et, plus tard, par les rapports photo.
//
// Règles de rédaction (vérifiées par tests/profiles.test.ts) : noms sobres et faussement scientifiques, ton pince-sans-rire de laboratoire ;
// aucune case n'est meilleure ou moins bonne qu'une autre ; une seule phrase par profil, sans chiffre, sans promesse médicale, sans
// comparaison avec une « norme » à atteindre ; aucune statistique sur la fréquence des profils (il n'y en a pas, et on n'en invente pas).

/** Seuil bas : un percentile STRICTEMENT inférieur à cette valeur est dans la classe « bas » (0 à 33 exclu). */
export const LOW_BELOW = 33;
/** Seuil haut : un percentile supérieur ou ÉGAL à cette valeur est dans la classe « haut » (67 inclus à 100). */
export const HIGH_FROM = 67;
// Règle unique, appliquée de la même façon aux deux axes : chaque classe contient sa borne basse.
//   bas   : percentile < 33
//   moyen : 33 <= percentile < 67
//   haut  : percentile >= 67
// Le percentile est d'abord arrondi à une décimale, comme dans le rapport (clampPercentile) : le profil correspond à ce qui est affiché.

export type ProfileClass = "low" | "mid" | "high";
/** Rang d'une classe (ligne ou colonne de la grille, de 1 à 3). */
export type ClassRank = 1 | 2 | 3;
/** Identifiant stable d'un profil : « l » + rang de la longueur, « c » + rang de la circonférence (ex. l2c3). Ne change jamais. */
export type ProfileId = `l${ClassRank}c${ClassRank}`;

export type Profile = {
  id: ProfileId;
  lengthClass: ProfileClass;
  girthClass: ProfileClass;
  /** Nom du profil (français, sobre). */
  name: string;
  /** Une seule phrase, sans chiffre. */
  description: string;
};

export const CLASSES: readonly ProfileClass[] = ["low", "mid", "high"] as const;
export const RANK: Record<ProfileClass, ClassRank> = { low: 1, mid: 2, high: 3 };

/** Libellés des classes (grille de la page méthode). Les bornes viennent des constantes ci-dessus : une seule source. */
export const CLASS_LABEL: Record<ProfileClass, string> = {
  low: `percentile inférieur à ${LOW_BELOW}`,
  mid: `percentile de ${LOW_BELOW} (inclus) à ${HIGH_FROM} (exclu)`,
  high: `percentile de ${HIGH_FROM} ou plus`,
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Classe d'un percentile (0 à 100). Valeur non finie : erreur. Valeur hors de 0 à 100 : classée comme la borne la plus proche. */
export function classOf(percentile: number): ProfileClass {
  if (!Number.isFinite(percentile)) throw new RangeError("Percentile invalide.");
  const p = round1(percentile);
  if (p < LOW_BELOW) return "low";
  if (p < HIGH_FROM) return "mid";
  return "high";
}

const profile = (lengthClass: ProfileClass, girthClass: ProfileClass, name: string, description: string): Profile => ({
  id: `l${RANK[lengthClass]}c${RANK[girthClass]}`,
  lengthClass,
  girthClass,
  name,
  description,
});

/**
 * Les neuf profils, en lignes (longueur : bas, moyen, haut) puis en colonnes (circonférence : bas, moyen, haut).
 * Chaque description est une phrase unique, sans chiffre ni nombre écrit en lettres.
 */
export const PROFILES: readonly Profile[] = [
  profile("low", "low", "L'Épuré", "Un profil dépouillé, qui se lit d'un coup d'œil et que le laboratoire consigne avec plaisir."),
  profile("low", "mid", "Le Compact", "Un profil ramassé et cohérent, que le laboratoire classe volontiers dans la catégorie « se retient facilement »."),
  profile("low", "high", "Le Concentré", "Un profil concentré, qui fait tenir l'essentiel dans un format resserré : l'équivalent d'une note de synthèse."),
  profile("mid", "low", "L'Élancé", "Un profil élancé, dont le laboratoire apprécie la ligne nette, comme sur un graphique bien tracé."),
  profile("mid", "mid", "Le Centré", "Un profil centré, qui se tient dans la partie médiane du graphique, là où le laboratoire n'a jamais besoin de modifier l'échelle."),
  profile("mid", "high", "L'Ample", "Un profil ample, qui occupe volontiers la largeur de la page : le laboratoire prévoit simplement une marge confortable."),
  profile("high", "low", "Le Longiligne", "Un profil longiligne, qui s'étire sur toute la hauteur du tableau et que le laboratoire reproduit en pleine page."),
  profile("high", "mid", "L'Étendu", "Un profil étendu, qui prend ses aises sur l'axe des longueurs, ce que le laboratoire note avec la plus grande neutralité."),
  profile("high", "high", "Le Panoramique", "Un profil panoramique, à grand angle sur tous les axes : le laboratoire recommande simplement un peu de recul pour en apprécier l'ensemble."),
];

const BY_ID = new Map<string, Profile>(PROFILES.map((p) => [p.id, p]));

/** Profil d'un identifiant, ou `undefined` si l'identifiant est inconnu (carte ancienne ou donnée altérée : on n'affiche rien). */
export function profileById(id: unknown): Profile | undefined {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

/**
 * Profil morphologique correspondant aux percentiles de longueur et de circonférence (ceux du rapport, de 0 à 100).
 * Fonction pure : le même couple donne toujours le même profil, et rien d'autre n'entre en compte.
 */
export function profileFor(lengthPercentile: number, girthPercentile: number): Profile {
  const l = classOf(lengthPercentile);
  const c = classOf(girthPercentile);
  return BY_ID.get(`l${RANK[l]}c${RANK[c]}`)!;
}
