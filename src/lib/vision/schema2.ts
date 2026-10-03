import { z } from "zod";
import type { ReperageNorm } from "../measure";

// Réponse STANDARDISÉE du moteur d'analyse, VERSION 2 (« photo-report/2 », formule B). Deux appels au modèle :
//   1. appel vision (avec la photo), JSON strict : recevabilité, estimations, observations factuelles, points de repérage
//      (utilisés seulement si une carte de référence est présente et lisible) ;
//   2. appel texte (sans la photo), JSON strict : le rapport rédigé, une clé par rubrique (schéma et contrôles : reportText.ts).
// Tous les calculs (percentiles, indices, typicité, score, profil) sont faits par le code (src/lib/morpho.ts).
// Les observations brutes du modèle ne sont jamais stockées ni journalisées : elles ne servent qu'à l'appel texte.

export const PHOTO_REPORT_V2 = "photo-report/2";

/** Motifs de non-recevabilité (liste fermée). « qualite_insuffisante » n'est pas un refus : il mène au rapport partiel. */
export const RECEVABILITE_MOTIFS_V2 = [
  "ok",
  "visage_visible",
  "plusieurs_personnes",
  "sujet_non_conforme",
  "image_non_originale",
  "doute_majorite",
  "qualite_insuffisante",
] as const;
export type MotifV2 = (typeof RECEVABILITE_MOTIFS_V2)[number];

export const DIRECTIONS_V2 = ["aucune", "gauche", "droite", "haut", "bas"] as const;

/** Rubriques des observations factuelles (forme et proportions uniquement), transmises telles quelles à l'appel texte. */
export const OBSERVATION_KEYS = ["forme_generale", "gland_couronne", "axe", "symetrie", "surface"] as const;
export type ObservationKey = (typeof OBSERVATION_KEYS)[number];

// ---------- Schéma JSON envoyé à l'API (mode « sortie structurée », strict) ----------

const point = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "confiance"],
  properties: { x: { type: "number" }, y: { type: "number" }, confiance: { type: "number" } },
} as const;

export const VISION_SCHEMA_V2 = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "recevabilite", "estimations", "observations", "reperage"],
  properties: {
    schemaVersion: { type: "string", enum: [PHOTO_REPORT_V2] },
    recevabilite: {
      type: "object",
      additionalProperties: false,
      required: ["recevable", "motif"],
      properties: { recevable: { type: "boolean" }, motif: { type: "string", enum: [...RECEVABILITE_MOTIFS_V2] } },
    },
    estimations: {
      type: "object",
      additionalProperties: false,
      required: [
        "etat",
        "carte_presente",
        "carte_lisible",
        "longueur_cm",
        "circonference_cm",
        "longueur_sans_carte_cm",
        "circonference_sans_carte_cm",
        "courbure_degres",
        "courbure_direction",
        "symetrie",
        "rapport_gland",
        "conicite",
      ],
      properties: {
        etat: { type: "string", enum: ["repos", "erection"] },
        carte_presente: { type: "boolean" },
        carte_lisible: { type: "boolean" },
        longueur_cm: { type: "number" },
        circonference_cm: { type: "number" },
        longueur_sans_carte_cm: { type: "number" },
        circonference_sans_carte_cm: { type: "number" },
        courbure_degres: { type: "number" },
        courbure_direction: { type: "string", enum: [...DIRECTIONS_V2] },
        symetrie: { type: "number" },
        rapport_gland: { type: "number" },
        conicite: { type: "number" },
      },
    },
    observations: {
      type: "object",
      additionalProperties: false,
      required: [...OBSERVATION_KEYS],
      properties: Object.fromEntries(OBSERVATION_KEYS.map((k) => [k, { type: "string" }])),
    },
    reperage: {
      type: "object",
      additionalProperties: false,
      required: ["coins_carte", "base", "extremite", "ligne_mediane", "bords"],
      properties: {
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
    },
  },
} as const;

// ---------- Validation stricte (zod) ----------

const recevabiliteV2 = z.object({ recevable: z.boolean(), motif: z.enum(RECEVABILITE_MOTIFS_V2) });

const finite = z.number().finite();
const estimationsV2 = z.object({
  etat: z.enum(["repos", "erection"]),
  carte_presente: z.boolean(),
  carte_lisible: z.boolean(),
  longueur_cm: finite,
  circonference_cm: finite,
  longueur_sans_carte_cm: finite,
  circonference_sans_carte_cm: finite,
  courbure_degres: finite.min(0).max(90),
  courbure_direction: z.enum(DIRECTIONS_V2),
  symetrie: finite.min(0).max(100),
  rapport_gland: finite.min(0.05).max(0.6),
  conicite: finite.min(0.3).max(1.6),
});

const observationText = z.string().trim().min(3).max(600);
const observationsV2 = z.object(Object.fromEntries(OBSERVATION_KEYS.map((k) => [k, observationText])) as Record<ObservationKey, typeof observationText>);

// Points : mêmes règles que la version 1 (coordonnées légèrement hors de 0 à 1 ramenées dans l'intervalle).
const coord = z
  .number()
  .min(-0.05)
  .max(1.05)
  .transform((v) => Math.min(1, Math.max(0, v)));
const zPoint = z.object({ x: coord, y: coord, confiance: z.number().min(0).max(1) });
const reperageV2 = z.object({
  coins_carte: z.array(zPoint).length(4),
  base: zPoint,
  extremite: zPoint,
  ligne_mediane: z.array(zPoint).min(8).max(12),
  bords: z
    .array(z.object({ hauteur: z.enum(["base", "25", "50", "75", "sous_gland"]), gauche: zPoint, droite: zPoint }))
    .length(5),
});

export type EstimationsV2 = z.infer<typeof estimationsV2>;
export type ObservationsV2 = Record<ObservationKey, string>;

/** Réponse de l'appel vision, validée. */
export type VisionV2 =
  | { recevable: false; motif: Exclude<MotifV2, "ok"> }
  | { recevable: true; estimations: EstimationsV2; observations: ObservationsV2; reperage: ReperageNorm | null };

/**
 * Validation de la réponse de l'appel vision. `null` si la réponse n'est pas conforme (le flux relance une fois).
 * Photo non recevable : seuls la recevabilité et son motif comptent (le reste est ignoré, jamais lu).
 * Recevable : estimations et observations obligatoires ; les points de repérage ne sont retenus que si la carte est déclarée
 * présente et lisible ET que les points sont complets (sinon `reperage: null`, et la taille reste estimée visuellement).
 */
export function validateVisionV2(raw: unknown): VisionV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== PHOTO_REPORT_V2) return null;
  const rec = recevabiliteV2.safeParse(o.recevabilite);
  if (!rec.success) return null;
  if (!rec.data.recevable || rec.data.motif !== "ok") {
    // Incohérence « recevable mais motif de refus » : traitée comme un refus (prudence).
    const motif = rec.data.motif === "ok" ? "sujet_non_conforme" : rec.data.motif;
    return { recevable: false, motif };
  }
  const est = estimationsV2.safeParse(o.estimations);
  const obs = observationsV2.safeParse(o.observations);
  if (!est.success || !obs.success) return null;
  let reperage: ReperageNorm | null = null;
  if (est.data.carte_presente && est.data.carte_lisible) {
    const r = reperageV2.safeParse(o.reperage);
    if (r.success) reperage = r.data;
  }
  return { recevable: true, estimations: est.data, observations: obs.data as ObservationsV2, reperage };
}
