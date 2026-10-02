import { buildQuestionnaireReport, type QuestionnaireInput, type ReportResults } from "./report";

/**
 * Rapport d'EXEMPLE FICTIF de l'accueil : des mesures inventées pour illustrer, passées dans les vraies fonctions de calcul du site
 * (percentiles, score, repères de taille), donc cohérentes avec ce qu'un visiteur obtiendra. Jamais présenté comme un résultat réel.
 */
export const EXAMPLE_INPUT: QuestionnaireInput = { state: "erect", length: 13.8, girth: 11.9, curvature: "light", direction: "left" };

export function exampleReport(): ReportResults {
  return buildQuestionnaireReport(EXAMPLE_INPUT);
}
