// Configuration centrale : prix, pondérations, score, références.
// Pour modifier un prix ou une pondération, changez la valeur ici.

export const SITE = {
  name: "Bitomètre",
  domain: "bitometre.com",
  tagline: "Laboratoire d'analyse biométrique",
  contactEmail: "________", // à compléter
} as const;

export const FORMULAS = {
  A: { id: "A", label: "Questionnaire", priceEur: 2.99, needsPhoto: false },
  B: { id: "B", label: "Photo", priceEur: 4.99, needsPhoto: true },
  C: { id: "C", label: "Photo + mesures", priceEur: 6.99, needsPhoto: true },
} as const;

export type FormulaId = keyof typeof FORMULAS;

export const SCORE = {
  // Score global = floor + span * P^exponent, puis borné entre floor et ceiling.
  floor: 40,
  span: 58,
  exponent: 0.85,
  ceiling: 98,
  // Pondérations de P (moyenne pondérée, chaque composante ramenée entre 0 et 1). Somme = 1.
  weights: { length: 0.35, girth: 0.35, symmetry: 0.15, straightness: 0.15 },
} as const;

// Références Veale et al., BJU International, 2015 (moyenne, écart-type, cm).
// À vérifier sur l'article avant mise en ligne.
export const REFERENCES = {
  flaccid: { length: { mean: 9.16, sd: 1.57 }, girth: { mean: 9.31, sd: 0.9 } },
  erect: { length: { mean: 13.12, sd: 1.66 }, girth: { mean: 11.66, sd: 1.1 } },
} as const;

export const TICKER = {
  // Le bandeau reste masqué tant que le total d'analyses est inférieur à ce seuil.
  minAnalysesToShow: 500,
} as const;

export const AGE_GATE = {
  minAge: 18,
  storageKey: "bitometre-age-ok",
} as const;

export function formatEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}
