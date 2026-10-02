import { z } from "zod";
import { LIMITS } from "@/config/site";
import type { QuestionnaireInput } from "./reportCore";

// Les calculs du rapport vivent dans reportCore.ts (pur, sans zod : utilisable aussi dans le navigateur) ; ils sont ré-exportés ici
// pour que les imports existants (`@/lib/report`) continuent de fonctionner. Ce fichier ajoute le schéma de validation du formulaire.
export * from "./reportCore";

export const questionnaireSchema = z.object({
  state: z.enum(["rest", "erect"]),
  length: z.number().min(LIMITS.length.min).max(LIMITS.length.max),
  girth: z.number().min(LIMITS.girth.min).max(LIMITS.girth.max),
  curvature: z.enum(["none", "light", "marked"]),
  direction: z.enum(["none", "left", "right", "up", "down"]),
});

// Garde de type : le schéma et le type partagé décrivent exactement la même forme (une divergence ne compile plus).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const schemaMatchesInput: Same<z.infer<typeof questionnaireSchema>, QuestionnaireInput> = true;
