import { CURVATURE_ANGLE, EVERYDAY_OBJECTS, LANDMARKS, MAX_SIGMA, MEDICAL_ADVICE_ANGLE } from "@/config/site";
import { globalScore, percentile, referenceFor, straightness, type BodyState, type Curvature } from "./stats";
import type { MorphoIndicators } from "./morpho";
import type { ReportText } from "./morphoText";

// Calculs du rapport « questionnaire » (formule A) : fonctions pures, sans zod, sans accès serveur ni base.
// Ce module est partagé par le serveur (rapport réel, validation du formulaire) et par le navigateur (simulation « Essayez » de l'accueil) :
// les deux appellent exactement les mêmes fonctions. `report.ts` ajoute le schéma de validation (zod) et ré-exporte tout ceci.

export type QuestionnaireInput = {
  state: BodyState;
  length: number;
  girth: number;
  curvature: Curvature;
  direction: "none" | "left" | "right" | "up" | "down";
};

/** Message affiché quand une valeur sort de la plage traitable (le même au questionnaire et dans la simulation de l'accueil). */
export const OUT_OF_RANGE_MESSAGE =
  "Une des valeurs saisies sort de la plage que ce protocole peut traiter. Vérifiez votre mesure (en centimètres, état correctement indiqué) et réessayez.";

/** Vrai si une mesure déclarée dépasse MAX_SIGMA écarts-types de la moyenne de référence de son état. */
export function isOutOfReferenceRange(input: Pick<QuestionnaireInput, "state" | "length" | "girth">): boolean {
  return (["length", "girth"] as const).some((dim) => {
    const ref = referenceFor(input.state, dim);
    return Math.abs(input[dim] - ref.mean) / ref.sd > MAX_SIGMA;
  });
}

export type Measure = {
  value: number;
  /** Absent seulement pour la longueur d'un rapport photo version 2 au repos (aucun percentile de longueur au repos). */
  percentile?: number;
  referenceMedian: number;
  /** Marge d'erreur en % (formules photo uniquement ; les valeurs déclarées n'ont pas de marge). */
  marginPct?: number;
};

export type DeclaredComparison = {
  declaredLength: number;
  declaredGirth: number;
  /** Écart estimé par rapport au déclaré, en % (positif : l'estimation est plus grande). */
  lengthGapPct: number;
  girthGapPct: number;
  flagged: boolean;
};

/**
 * Commentaire STANDARDISÉ des rapports photo (bloc 6) : trois observations courtes et un verdict d'une phrase, rédigés par le modèle
 * à partir d'indicateurs calculés (jamais de la photo), validés contre un schéma versionné (aucun chiffre, aucun terme interdit).
 */
export type StandardComment = {
  schemaVersion: string;
  promptVersion: string;
  observations: [string, string, string];
  verdict: string;
};

export type ReportResults = {
  formula: "A" | "B" | "C";
  state: BodyState;
  score: number;
  length: Measure;
  girth: Measure;
  curvature: { category: QuestionnaireInput["curvature"]; angleDeg: number; direction: QuestionnaireInput["direction"] };
  everyday: { label: string; times: number }[];
  landmarks: { label: string; times: number }[];
  comment: string;
  /** Formules photo : indice de confiance (0 à 100), symétrie (0 à 100), conicité. */
  confidence?: number;
  symmetry?: number;
  taper?: number;
  /** Formule C : comparaison déclaré / estimé. */
  declared?: DeclaredComparison;
  /** Formules photo : commentaire standardisé (le champ `comment` en est la version texte, observations puis verdict). */
  standard?: StandardComment;
  /** Formule photo, version 2 : rapport d'analyse morphométrique complet (en-tête, indicateurs, rubriques rédigées). */
  morpho?: MorphoReport;
};

/**
 * Rapport morphométrique photo, version 2 (photo-report/2). Les indicateurs sont calculés par le code ; le texte est rédigé par le modèle
 * (appel texte, sans la photo) puis vérifié par le code, ou, pour un rapport partiel, construit par le code sur les valeurs de référence.
 * Les observations brutes du modèle de vision n'y figurent jamais.
 */
export type MorphoReport = {
  schemaVersion: string;
  promptVersion: string;
  /** Numéro du rapport, 5 chiffres, généré par le code (décoratif). */
  numero: string;
  /** « visuelle » : estimation visuelle ; « calibree » : mesure calibrée sur la carte (badge « Taille calibrée ») ; « reference » : rapport partiel. */
  methode: "visuelle" | "calibree" | "reference";
  /** Rapport partiel (échec technique) : construit sur les valeurs de référence et l'état déclaré, sans aucune mesure. */
  partielle: boolean;
  /** Indicateurs calculés ; null pour un rapport partiel (aucune mesure). */
  indicateurs: MorphoIndicators | null;
  /** Rapport partiel : valeurs de référence (médianes de la population de référence) pour l'état déclaré. */
  reference?: { state: BodyState; longueurMedianeCm: number; circonferenceMedianeCm: number };
  texte: ReportText;
};

export const DIRECTION_FR = {
  none: "",
  left: "vers la gauche",
  right: "vers la droite",
  up: "vers le haut",
  down: "vers le bas",
} as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Un percentile n'est jamais affiché à 0 ou 100 : on borne à 0,1 et 99,9. */
export const clampPercentile = (p: number) => Math.min(99.9, Math.max(0.1, round1(p)));
const fmt = (n: number) => String(round1(n)).replace(".", ",");

function measure(state: BodyState, dim: "length" | "girth", value: number): Measure & { percentile: number } {
  const ref = referenceFor(state, dim);
  return { value, percentile: clampPercentile(percentile(value, ref.mean, ref.sd)), referenceMedian: ref.mean };
}

/** Résultats d'un rapport du questionnaire : les deux percentiles sont toujours calculés. */
export type QuestionnaireResults = ReportResults & { length: Measure & { percentile: number }; girth: Measure & { percentile: number } };

export function buildQuestionnaireReport(input: QuestionnaireInput): QuestionnaireResults {
  const length = measure(input.state, "length", input.length);
  const girth = measure(input.state, "girth", input.girth);
  const angleDeg = CURVATURE_ANGLE[input.curvature];
  const score = globalScore({
    length: length.percentile / 100,
    girth: girth.percentile / 100,
    straightness: straightness(angleDeg),
  });

  const stateLabel = input.state === "rest" ? "au repos" : "en érection";
  let comment =
    `Les mesures déclarées ${stateLabel} placent la longueur au percentile ${Math.floor(length.percentile)} ` +
    `(${fmt(length.value)} cm, médiane de référence ${fmt(length.referenceMedian)} cm) et la circonférence au percentile ` +
    `${Math.floor(girth.percentile)} (${fmt(girth.value)} cm, médiane de référence ${fmt(girth.referenceMedian)} cm). ` +
    `Le score composite ressort à ${score}/100. ` +
    `Ce score est une note de présentation calibrée de façon indulgente : pour situer une mesure dans la population, ` +
    `seuls les percentiles font foi. Ces résultats reposent sur des valeurs déclarées et n'ont pas été vérifiés.`;
  if (angleDeg >= MEDICAL_ADVICE_ANGLE) {
    comment += " La courbure déclarée est marquée : en cas de gêne ou de douleur, un avis médical est recommandé.";
  }

  return {
    formula: "A",
    state: input.state,
    score,
    length,
    girth,
    curvature: { category: input.curvature, angleDeg, direction: input.direction },
    everyday: EVERYDAY_OBJECTS.map((o) => ({ label: o.label, times: round1(o.cm / input.length) })),
    landmarks: LANDMARKS.map((l) => ({ label: l.label, times: Math.round((l.m * 100) / input.length) })),
    comment,
  };
}
