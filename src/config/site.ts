// Configuration centrale : prix, pondérations, score, références.
// Pour modifier un prix ou une pondération, changez la valeur ici.

import { COMPANY } from "./company";

export const SITE = {
  name: "Bitomètre",
  domain: "bitometre.com",
  tagline: "Laboratoire d'analyse biométrique",
  contactEmail: COMPANY.contactEmail,
} as const;

// Durée minimale pendant laquelle un rapport payé reste accessible (en années). Reportée dans les CGV, le paiement et la FAQ.
// Le rapport reste téléchargeable en PDF à tout moment. Si vous changez cette valeur, mettez aussi à jour content/seo/faq.md (un test le vérifie).
export const REPORT_ACCESS = { minYears: 3 } as const;

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

// Citation de la source des références ci-dessus, telle qu'elle apparaît dans le bandeau défilant de l'accueil.
export const REFERENCE_SOURCE = "Veale et al., BJU Int., 2015";

export const TICKER = {
  // Bandeau défilant de l'accueil : le compteur d'analyses et le score moyen n'apparaissent qu'AU-DELÀ de ce seuil
  // (strictement plus : 500 analyses ne les affichent pas, 501 les affichent).
  analysesThreshold: 500,
  // Durée de conservation en mémoire des chiffres lus en base (millisecondes), et délai maximal d'attente de la base
  // (au-delà, ou en cas d'erreur, le bandeau s'affiche sans ces deux éléments : il ne bloque jamais la page).
  statsCacheMs: 60_000,
  statsFailureCacheMs: 30_000,
  statsTimeoutMs: 1_500,
} as const;

export const AGE_GATE = {
  minAge: 18,
  storageKey: "bitometre-age-ok",
} as const;

export function formatEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

// Plages plausibles acceptées pour les mesures déclarées (cm).
// Formule A : les valeurs au-delà de ce nombre d'écarts-types de la moyenne Veale sont refusées.
export const MAX_SIGMA = 4;

export const LIMITS = {
  length: { min: 2, max: 30 },
  girth: { min: 3, max: 25 },
} as const;

// Angle retenu pour la courbure déclarée (formule A), en degrés.
export const CURVATURE_ANGLE = { none: 0, light: 15, marked: 35 } as const;
// Au-delà de cet angle (degrés), le commentaire suggère un avis médical.
export const MEDICAL_ADVICE_ANGLE = 30;
// Rectitude : 100 % à 0°, 0 % à partir de cet angle.
export const STRAIGHTNESS_ZERO_ANGLE = 45;

export const RATE_LIMIT = { maxPerWindow: 5, windowHours: 24 } as const;

// Rapports non payés effacés après ce délai.
export const UNPAID_TTL_HOURS = 24;

// Objets du quotidien (longueur en cm).
export const EVERYDAY_OBJECTS = [
  { label: "Carte bancaire", cm: 8.56 },
  { label: "Canette de 33 cl", cm: 11.5 },
  { label: "Smartphone", cm: 15 },
] as const;

// Mesures de référence publiques (hauteur en mètres).
export const LANDMARKS = [
  { label: "Tour Eiffel", m: 330 },
  { label: "Burj Khalifa", m: 828 },
  { label: "Mont Blanc", m: 4805 },
] as const;

// ---------- Formules photo (B et C) ----------

export const UPLOAD = {
  maxBytes: 8 * 1024 * 1024, // taille maximale acceptée après réencodage navigateur
  maxPx: 1600, // plus grand côté de l'image envoyée à l'analyse
  maxInputPixels: 40_000_000, // garde-fou contre les images piégées (décompression)
} as const;

// Durée de validité du jeton « majeur : oui » (minutes).
export const AGE_TOKEN_MINUTES = 30;

// Marge d'erreur par mesure (en %) : max(plancher, racine de la somme des carrés de trois termes) :
//  - confiance : (1 - confiance moyenne du repérage) × perConfidencePct ;
//  - taille de la carte : sizeCoefficient × markerNoisePx / largeur de la carte en pixels. L'erreur due à l'imprécision de
//    repérage est inversement proportionnelle à la taille de la carte dans l'image (relevé par simulation :
//    `npm run geometry:report`) ; markerNoisePx est l'imprécision SUPPOSÉE de chaque point repéré (à régler après la
//    calibration sur de vraies photos) ;
//  - inclinaison : tiltPctAt45 pour une photo prise à 45°, proportionnel.
export const MARGIN = {
  floorPct: 10,
  perConfidencePct: 50,
  markerNoisePx: 2,
  sizeCoefficient: 1350,
  tiltPctAt45: 3,
} as const;

// Cas refusés faute de précision suffisante (mesurés par simulation) :
//  - inclinaison de l'appareil supérieure à maxTiltDeg (au-delà de 55°, l'erreur peut dépasser 17 %) ;
//  - carte de référence trop petite : grand côté de la carte inférieur à minCardFraction × grand côté de l'image.
export const PHOTO_LIMITS = { maxTiltDeg: 50, minCardFraction: 0.15 } as const;

// En dessous de cette confiance moyenne des points repérés (0 à 1), l'analyse est jugée illisible.
export const MIN_CONFIDENCE = 0.5;

// Formule C : au-delà de cet écart (en %) entre mesure déclarée et estimée, un avertissement est affiché.
export const DECLARED_GAP_WARN_PCT = 20;

// Plages plausibles pour des mesures ESTIMÉES (cm). En dehors : analyse jugée illisible.
export const ESTIMATE_LIMITS = {
  length: { min: 2, max: 30 },
  girth: { min: 3, max: 25 },
} as const;

// Circonférence estimée = π × largeur maximale (essais : meilleur que la largeur moyenne).
export const GIRTH_FROM: "max" | "mean" = "max";

// ---------- Administration (étape 6) ----------

// Finances. Les prix affichés sont TTC. Revenu net = prix TTC − TVA − commission du prestataire de paiement.
export const FINANCE = {
  vatRate: 0.2, // TVA française par défaut
  paymentFeeRate: 0.155, // commission du prestataire de paiement : valeur PROVISOIRE (15,5 % = tarif public du compte Basic de Verotel, décision du propriétaire le 02/10/2026), à remplacer par le tarif réel du contrat
  paymentFeeFixedCents: 0, // frais fixes par transaction, en centimes (certains prestataires en facturent)
} as const;

export const ADMIN = {
  sessionHours: 8,
  maxFailures: 5, // tentatives de connexion échouées tolérées...
  windowMinutes: 15, // ... par période de cette durée
} as const;

// Webhook quotidien : un groupe de moins de N rapports n'est jamais détaillé (aucune donnée individuelle).
export const WEBHOOK = { minGroup: 5, timeoutMs: 15_000 } as const;

// Tarif du modèle d'analyse (dollars par million de jetons), modifiable dans .env. Défaut : grok-4.7.
export function aiPricing(): { inPerM: number; outPerM: number } {
  return { inPerM: Number(process.env.XAI_PRICE_IN_PER_M ?? 2), outPerM: Number(process.env.XAI_PRICE_OUT_PER_M ?? 6) };
}

// ---------- Caméra supposée pour l'estimation avec pose (src/lib/pose.ts) ----------

// Focale supposée = focalFactor × grand côté de l'image, point principal au centre. 0,9 correspond à l'objectif principal
// d'un smartphone courant (champ d'environ 68° en diagonale). Les métadonnées de la photo étant supprimées, la focale réelle
// est inconnue : l'erreur qui en résulte est mesurée par `npm run geometry:report` et incluse dans la marge.
export const CAMERA = { focalFactor: 0.9 } as const;
