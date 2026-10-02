import { LIMITS } from "@/config/site";
import { EXAMPLE_INPUT } from "./exampleReport";
import { buildQuestionnaireReport, isOutOfReferenceRange, type QuestionnaireInput, type ReportResults } from "./reportCore";
import type { BodyState } from "./stats";

// Simulation « Essayez » de l'accueil : pur, sans réseau, sans stockage, sans dépendance serveur (utilisable dans le navigateur).
// Aucun calcul propre à la simulation : les résultats viennent de `buildQuestionnaireReport`, les mêmes fonctions que le rapport réel,
// après les mêmes contrôles que le questionnaire (bornes de saisie, plage plausible).

/** Bornes des curseurs : celles du questionnaire (LIMITS), pas de 0,1 cm. */
export const TRY_BOUNDS = {
  length: { min: LIMITS.length.min, max: LIMITS.length.max },
  girth: { min: LIMITS.girth.min, max: LIMITS.girth.max },
  step: 0.1,
} as const;

/** Valeurs de départ : celles du rapport d'exemple (fictives). */
export const TRY_DEFAULTS: Pick<QuestionnaireInput, "state" | "length" | "girth"> = {
  state: EXAMPLE_INPUT.state,
  length: EXAMPLE_INPUT.length,
  girth: EXAMPLE_INPUT.girth,
};

export type TryValues = { state: BodyState; length: number; girth: number };

/** Ramène une valeur dans les bornes du questionnaire, au pas de 0,1 (évite les décimales parasites du curseur). */
export function snap(dim: "length" | "girth", v: number): number {
  const { min, max } = TRY_BOUNDS[dim];
  if (!Number.isFinite(v)) return TRY_DEFAULTS[dim];
  return Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
}

export type TryOutcome = { kind: "ok"; input: QuestionnaireInput; results: ReportResults } | { kind: "outOfRange"; input: QuestionnaireInput };

/**
 * Même chaîne que le questionnaire : bornes de saisie, plage plausible (MAX_SIGMA), puis `buildQuestionnaireReport`.
 * La courbure est celle de l'exemple : elle n'influe ni sur les percentiles ni sur les repères affichés ici.
 */
export function simulate(v: TryValues): TryOutcome {
  const input: QuestionnaireInput = {
    state: v.state,
    length: snap("length", v.length),
    girth: snap("girth", v.girth),
    curvature: EXAMPLE_INPUT.curvature,
    direction: EXAMPLE_INPUT.direction,
  };
  if (isOutOfReferenceRange(input)) return { kind: "outOfRange", input };
  return { kind: "ok", input, results: buildQuestionnaireReport(input) };
}
