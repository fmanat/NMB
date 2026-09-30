import { z } from "zod";
import type { ReperageNorm } from "../measure";

// Les coordonnées légèrement hors de 0 à 1 (arrondis du modèle) sont ramenées dans l'intervalle.
const coord = z
  .number()
  .min(-0.05)
  .max(1.05)
  .transform((v) => Math.min(1, Math.max(0, v)));

const point = z.object({ x: coord, y: coord, confiance: z.number().min(0).max(1) });

export const reperageSchema = z.object({
  coins_carte: z.array(point).length(4),
  base: point,
  extremite: point,
  ligne_mediane: z.array(point).min(8).max(12),
  bords: z
    .array(z.object({ hauteur: z.enum(["base", "25", "50", "75", "sous_gland"]), gauche: point, droite: point }))
    .length(5),
});

/** Valide le repérage brut du modèle. Renvoie null si la structure est incomplète ou incohérente. */
export function validateReperage(raw: unknown): ReperageNorm | null {
  const r = reperageSchema.safeParse(raw);
  return r.success ? r.data : null;
}
