import { randomInt } from "node:crypto";
import { EVERYDAY_OBJECTS, LANDMARKS, MEDICAL_ADVICE_ANGLE } from "@/config/site";
import { frNum, type MorphoIndicators } from "./morpho";
import type { MorphoReport, ReportResults } from "./reportCore";
import { referenceFor, type BodyState } from "./stats";
import type { ReportText } from "./vision/reportText";

// Assemblage d'un rapport photo version 2 (photo-report/2) : résultats complets (indicateurs calculés + texte vérifié),
// ou rapport PARTIEL (échec technique), construit par le code sur les valeurs de référence et l'état déclaré, sans aucune mesure.

/** Libellé du rapport partiel (badge et en-tête). */
export const PARTIAL_LABEL = "Analyse partielle : photo difficile à lire";

/** Conseil de reprise affiché avec un rapport partiel (hors du texte du rapport). */
export const RETAKE_ADVICE =
  "Reprenez la photo pour obtenir le rapport complet : sujet entier et net, vue de profil ou de dessus, bonne lumière, aucun visage ni élément identifiant. " +
  "Une carte au format bancaire posée à côté, entière et lisible, permet en plus une mesure calibrée (badge « Taille calibrée »).";

/** Numéro du rapport : 5 chiffres, généré par le code (décoratif, sans lien avec l'identifiant privé). */
export const newReportNumber = (): string => String(randomInt(10000, 100000));

const round1 = (n: number) => Math.round(n * 10) / 10;

function curvatureCategory(angle: number): "none" | "light" | "marked" {
  if (angle < 10) return "none";
  if (angle < MEDICAL_ADVICE_ANGLE) return "light";
  return "marked";
}

const sizeReferences = (lengthCm: number) => ({
  everyday: EVERYDAY_OBJECTS.map((o) => ({ label: o.label, times: round1(o.cm / lengthCm) })),
  landmarks: LANDMARKS.map((l) => ({ label: l.label, times: Math.round((l.m * 100) / lengthCm) })),
});

/** Version texte courte du rapport (champ `comment` des résultats) : la synthèse. */
const commentOf = (t: ReportText) => t.synthese;

/** Résultats d'un rapport complet. Les champs historiques (longueur, circonférence, score…) sont remplis pour les fonctions communes (carte, défi). */
export function buildMorphoResults(args: {
  formula: "B" | "C";
  indicators: MorphoIndicators;
  method: "visuelle" | "calibree";
  text: ReportText;
  numero: string;
  versions: { schemaVersion: string; promptVersion: string };
}): ReportResults {
  const ind = args.indicators;
  const morpho: MorphoReport = {
    ...args.versions,
    numero: args.numero,
    methode: args.method,
    partielle: false,
    indicateurs: ind,
    texte: args.text,
  };
  return {
    formula: args.formula,
    state: ind.state,
    score: ind.score,
    length: {
      value: ind.longueurCm,
      ...(ind.percentileLongueur !== null ? { percentile: ind.percentileLongueur } : {}),
      referenceMedian: ind.medianeLongueurCm,
    },
    girth: { value: ind.circonferenceCm, percentile: ind.percentileCirconference, referenceMedian: ind.medianeCirconferenceCm },
    curvature: { category: curvatureCategory(ind.courbureDeg), angleDeg: ind.courbureDeg, direction: ind.courbureDirection },
    ...sizeReferences(ind.longueurCm),
    comment: commentOf(args.text),
    symmetry: ind.symetrie,
    taper: ind.ratioConicite,
    morpho,
  };
}

/**
 * Texte générique du rapport partiel : il décrit les indicateurs et les valeurs de référence de l'état déclaré, sans aucune mesure
 * personnelle. Rédigé par le code ; respecte les mêmes interdits que le rapport rédigé (vérifié par les tests).
 */
export function partialText(state: BodyState): ReportText {
  const L = frNum(referenceFor(state, "length").mean);
  const C = frNum(referenceFor(state, "girth").mean);
  const etat = state === "rest" ? "au repos" : "en érection";
  const rest = state === "rest";
  return {
    synthese:
      `Les dimensions n'ont pas pu être lues sur la photo transmise : ce document reprend les valeurs de référence de la population étudiée pour l'état déclaré, ${etat}. ` +
      "Il présente les sept indicateurs du laboratoire et la façon dont chacun sera établi sur une nouvelle photo. " +
      "Aucune valeur personnelle n'y figure.",
    appreciations: {
      longueur: rest ? "Médiane de référence au repos ; aucun percentile de longueur n'est calculé dans cet état." : "Médiane de référence, en attente d'une lecture personnelle.",
      circonference: "Médiane de référence, en attente d'une lecture personnelle.",
      courbure: "Angle non lu lors de cette analyse.",
      rectitude: "Indice non établi, faute d'angle lisible.",
      symetrie: "Coefficient non établi lors de cette analyse.",
      conicite: "Index non établi, faute de largeurs lisibles.",
      typicite: "Indice non établi sans mesure personnelle.",
    },
    morphologie_generale:
      "La morphologie générale décrit la silhouette de la tige, de la base à l'extrémité, et le rapport entre longueur et circonférence. " +
      `Dans la population de référence (Veale et al., 2015), la médiane de longueur ${etat} est de ${L} cm et celle de la circonférence de ${C} cm. ` +
      "Une nouvelle photo permettra de situer vos propres proportions par rapport à ces repères.",
    gland_couronne:
      "Cette rubrique décrit la forme et les proportions du gland et de la couronne, dont le rapport entre la longueur du gland et la longueur totale. " +
      "Ce rapport n'a pas pu être établi sur la photo transmise. " +
      "Il sera calculé lors de la prochaine analyse.",
    axe_courbure:
      "L'axe est décrit par l'angle entre la partie proximale (proche de la base) et la partie distale (située vers l'extrémité). " +
      "L'Indice de rectitude axiale vaut 100 pour un axe droit et diminue à mesure que l'angle s'ouvre. " +
      "Ces deux valeurs n'ont pas pu être lues ici.",
    symetrie_equilibre:
      "Le Coefficient de symétrie bilatérale compare les deux côtés de l'axe, la valeur 100 correspondant à deux moitiés identiques. " +
      "L'Index de conicité distale compare la largeur sous le gland à la largeur à la base. " +
      "Ces deux indicateurs seront établis sur une nouvelle photo.",
    aspect_surface:
      "L'aspect de surface rend compte de la régularité du contour, du relief veineux et de la pilosité. " +
      "Ces éléments descriptifs n'entrent dans aucun calcul. " +
      "Ils n'ont pas pu être observés sur la photo transmise.",
    positionnement_statistique:
      "Le positionnement statistique situe chaque dimension par un percentile (rang sur 100) dans la population de référence, le percentile 50 correspondant à la médiane. " +
      "L'Indice de typicité résume la proximité de ces percentiles avec le centre de la population. " +
      (rest ? "Au repos, seule la circonférence est positionnée." : "En érection, la longueur et la circonférence sont toutes deux positionnées."),
    points_remarquables: [],
    conclusion:
      "Ce document partiel ne contient aucune mesure personnelle. " +
      "Une nouvelle photo, prise en suivant les consignes, permettra d'établir le rapport complet.",
    note_laboratoire: rest
      ? "Les valeurs de ce document sont des médianes de référence et non des mesures ; une observation en érection donne une lecture complète des dimensions."
      : "Les valeurs de ce document sont des médianes de référence et non des mesures.",
  };
}

/**
 * Résultats d'un rapport PARTIEL (échec technique : photo difficile à lire, erreur ou délai du modèle, réponse invalide après relance).
 * Aucune mesure : les seules valeurs sont les médianes de référence de l'état déclaré. Pas de score affiché, pas de carte, pas de défi.
 */
export function buildPartialResults(args: { formula: "B" | "C"; state: BodyState; numero: string; versions: { schemaVersion: string; promptVersion: string } }): ReportResults {
  const lenRef = referenceFor(args.state, "length");
  const girthRef = referenceFor(args.state, "girth");
  const text = partialText(args.state);
  return {
    formula: args.formula,
    state: args.state,
    score: 0, // jamais affiché ; le rapport partiel n'entre pas dans le journal des scores
    length: { value: lenRef.mean, referenceMedian: lenRef.mean },
    girth: { value: girthRef.mean, referenceMedian: girthRef.mean },
    curvature: { category: "none", angleDeg: 0, direction: "none" },
    everyday: [],
    landmarks: [],
    comment: text.synthese,
    morpho: {
      ...args.versions,
      numero: args.numero,
      methode: "reference",
      partielle: true,
      indicateurs: null,
      reference: { state: args.state, longueurMedianeCm: lenRef.mean, circonferenceMedianeCm: girthRef.mean },
      texte: text,
    },
  };
}
