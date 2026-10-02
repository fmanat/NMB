import { z } from "zod";
import type { ReperageNorm } from "../measure";

// Réponse STANDARDISÉE du moteur d'analyse (bloc 6 de la session de nuit 4) : un schéma VERSIONNÉ, identique pour chaque analyse.
// Trois réponses JSON strictes du modèle, chacune marquée de la version du schéma :
//   1. recevabilité : { schemaVersion, recevable, motif } (liste fermée de motifs) ;
//   2. repérage : { schemaVersion, coins_carte, base, extremite, ligne_mediane, bords } (coordonnées normalisées, le modèle ne mesure rien) ;
//   3. commentaire : { schemaVersion, observations: [3 phrases courtes], verdict: 1 phrase } (texte seul, chiffres calculés en entrée, AUCUN chiffre en sortie).
// Les mesures (longueur, circonférence…) sont TOUJOURS calculées par le code à partir des points (src/lib/pose.ts) : aucun nombre fourni
// par le modèle n'est jamais affiché. Changer de version : créer "photo-report/2" ici ET un fichier de prompts correspondant.

export const PHOTO_REPORT_SCHEMA_VERSION = "photo-report/1";

// ---------- Contraintes du commentaire (constantes exposées, testées) ----------

/** Nombre exact d'observations courtes. */
export const OBSERVATION_COUNT = 3;
/** Longueur maximale d'une observation, en caractères. */
export const OBSERVATION_MAX_CHARS = 140;
/** Longueur minimale d'une observation (évite les réponses vides ou tronquées). */
export const OBSERVATION_MIN_CHARS = 12;
/** Longueur maximale du verdict (une seule phrase), en caractères. */
export const VERDICT_MAX_CHARS = 200;
export const VERDICT_MIN_CHARS = 12;

/**
 * Termes interdits dans le commentaire (mots entiers, insensibles à la casse et aux accents composés) : vulgarité et anatomie,
 * dénigrement ou éloge de la personne, promesse ou vocabulaire médical, unités de mesure (un nombre « en lettres » accompagné d'une unité
 * serait une mesure déguisée). Le commentaire ne porte que sur la qualité de la photo, le cadrage, la cohérence des mesures estimées et la
 * position statistique générale.
 */
export const FORBIDDEN_TERMS: readonly string[] = [
  // vulgarité, argot, anatomie
  "bite", "bites", "zob", "queue", "sexe", "sexuel", "sexuelle", "verge", "pénis", "penis", "kiki", "nouille", "chibre", "engin", "bander", "burne", "couille", "couilles",
  "corps", "organe", "peau", "gland", "érection", "repos", "membre", "virilité", "viril", "virile",
  // dénigrement ou éloge de la personne
  "petit", "petite", "petits", "minuscule", "micro", "mini", "nain", "court", "courte", "faible", "nul", "nulle", "pauvre", "maigre", "chétif", "chétive",
  "insuffisant", "insuffisante", "déficient", "raté", "ratée", "honte", "honteux", "ridicule", "complexe", "gros", "grosse", "énorme", "géant", "monstre", "monstrueux",
  "impressionnant", "impressionnante", "remarquable", "exceptionnel", "exceptionnelle", "parfait", "parfaite", "idéal", "idéale", "champion", "record",
  "médiocre", "mauvais", "mauvaise", "défaut", "anormal", "anormale", "normal", "normale", "norme", "fier", "fierté", "félicitations", "bravo", "dommage", "hélas",
  "performance", "performances",
  // promesses ou vocabulaire médical
  "santé", "médical", "médicale", "médecin", "diagnostic", "guérir", "soigner", "traitement", "pathologie", "maladie", "symptôme", "consulter", "consultation",
  "urologue", "dysfonction", "peyronie", "garanti", "garantie",
  // unités de mesure (une mesure ne doit jamais apparaître, même en lettres)
  "cm", "centimètre", "centimètres", "mm", "millimètre", "millimètres", "pouce", "pouces", "degré", "degrés", "%", "pourcent", "pourcents",
];

/** Motifs de non-recevabilité (liste fermée, identique à celle du code existant). */
export const RECEVABILITE_MOTIFS = [
  "ok",
  "visage_visible",
  "plusieurs_personnes",
  "sujet_non_conforme",
  "carte_absente_ou_illisible",
  "image_non_originale",
  "doute_majorite",
] as const;

// ---------- Schémas JSON envoyés à l'API (mode « sortie structurée », strict) ----------

const versionProp = { schemaVersion: { type: "string", enum: [PHOTO_REPORT_SCHEMA_VERSION] } } as const;

const point = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "confiance"],
  properties: { x: { type: "number" }, y: { type: "number" }, confiance: { type: "number" } },
} as const;

export const RECEVABILITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "recevable", "motif"],
  properties: {
    ...versionProp,
    recevable: { type: "boolean" },
    motif: { type: "string", enum: [...RECEVABILITE_MOTIFS] },
  },
} as const;

export const REPERAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "coins_carte", "base", "extremite", "ligne_mediane", "bords"],
  properties: {
    ...versionProp,
    coins_carte: { type: "array", items: point },
    base: point,
    extremite: point,
    ligne_mediane: { type: "array", items: point },
    bords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hauteur", "gauche", "droite"],
        properties: {
          hauteur: { type: "string", enum: ["base", "25", "50", "75", "sous_gland"] },
          gauche: point,
          droite: point,
        },
      },
    },
  },
} as const;

export const COMMENTAIRE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "observations", "verdict"],
  properties: {
    ...versionProp,
    observations: { type: "array", items: { type: "string" } },
    verdict: { type: "string" },
  },
} as const;

// ---------- Validation stricte (zod) des réponses ----------

const version = z.literal(PHOTO_REPORT_SCHEMA_VERSION);

// Les coordonnées légèrement hors de 0 à 1 (arrondis du modèle) sont ramenées dans l'intervalle.
const coord = z
  .number()
  .min(-0.05)
  .max(1.05)
  .transform((v) => Math.min(1, Math.max(0, v)));
const zPoint = z.object({ x: coord, y: coord, confiance: z.number().min(0).max(1) });

export const recevabiliteSchema = z.object({ schemaVersion: version, recevable: z.boolean(), motif: z.enum(RECEVABILITE_MOTIFS) });

export const reperageSchema = z.object({
  schemaVersion: version,
  coins_carte: z.array(zPoint).length(4),
  base: zPoint,
  extremite: zPoint,
  ligne_mediane: z.array(zPoint).min(8).max(12),
  bords: z
    .array(z.object({ hauteur: z.enum(["base", "25", "50", "75", "sous_gland"]), gauche: zPoint, droite: zPoint }))
    .length(5),
});

const hasWord = (text: string, word: string) =>
  /^[\p{L}]+$/u.test(word) ? new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "iu").test(text) : text.toLowerCase().includes(word);

/** Problèmes d'un texte du commentaire (liste vide = conforme) : chiffres, termes interdits. */
export function textViolations(text: string): string[] {
  const out: string[] = [];
  if (/\d/.test(text)) out.push("chiffre");
  for (const w of FORBIDDEN_TERMS) if (hasWord(text, w)) out.push(`terme interdit : ${w}`);
  return out;
}

const cleanText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((t) => textViolations(t).length === 0, { message: "chiffre ou terme interdit" });

/** Une seule phrase : se termine par un signe final, et aucun signe final suivi d'un autre mot à l'intérieur. */
const oneSentence = (t: string) => /[.!?…]$/.test(t) && !/[.!?…]\s+\S/.test(t);

export const commentaireSchema = z.object({
  schemaVersion: version,
  observations: z.array(cleanText(OBSERVATION_MIN_CHARS, OBSERVATION_MAX_CHARS)).length(OBSERVATION_COUNT),
  verdict: cleanText(VERDICT_MIN_CHARS, VERDICT_MAX_CHARS).refine(oneSentence, { message: "une seule phrase" }),
});

export type Recevabilite = z.infer<typeof recevabiliteSchema>;
export type Commentaire = z.infer<typeof commentaireSchema>;

/** Validation d'une réponse de recevabilité. `null` si elle n'est pas conforme au schéma. */
export function validateRecevabilite(raw: unknown): Recevabilite | null {
  const r = recevabiliteSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Validation du repérage brut du modèle (renvoie les points normalisés, sans la version). `null` si incomplet ou incohérent. */
export function validateReperage(raw: unknown): ReperageNorm | null {
  const r = reperageSchema.safeParse(raw);
  if (!r.success) return null;
  const { schemaVersion: _v, ...points } = r.data;
  void _v;
  return points;
}

/** Validation du commentaire : exactement trois observations courtes et un verdict d'une phrase, sans chiffre ni terme interdit. */
export function validateCommentaire(raw: unknown): Commentaire | null {
  const r = commentaireSchema.safeParse(raw);
  return r.success ? r.data : null;
}
