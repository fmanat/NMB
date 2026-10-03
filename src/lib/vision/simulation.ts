import sharp from "sharp";
import { CAMERA } from "@/config/site";
import { INDICATOR_LABELS, directionText, favourableIndicators, frNum, needsMedicalSentence, type IndicatorKey, type MorphoIndicators } from "../morpho";
import { assertNotProduction } from "../providers/guard";
import { DEFAULT_SHOT, simulateShot } from "./camera-sim";
import type { ReportText } from "./reportText";
import { PHOTO_REPORT_V2, type MotifV2, type ObservationsV2 } from "./schema2";
import type { ReportTextInput, Usage, VisionProvider } from "./types";

// Fournisseur d'analyse SIMULÉ, version 2 (photo-report/2) : aucun appel réseau, aucun coût, réponses déterministes.
// Interdit en production (assertNotProduction). Scénario choisi par SIM_VISION_SCENARIO ou par le paramètre (tests).
// Une instance par analyse : les scénarios « _once » (réponse invalide une fois, valide à la relance) comptent les appels de l'instance.

export type Scenario =
  | "ok" // estimation visuelle, sans carte, en érection
  | "calibrated" // carte présente et lisible, points cohérents (prise de vue simulée) : mesure calibrée
  | "card_unusable" // carte annoncée lisible mais points inexploitables (inclinaison trop forte) : estimation visuelle
  | "rest" // état observé : repos
  | "curved" // courbure de 35° : phrase d'avis médical exigée
  | "low" // longueur et circonférence basses : « gabarit compact »
  | "refuse_face"
  | "doute_majorite"
  | "image_non_originale"
  | "plusieurs_personnes"
  | "provider_refusal" // le prestataire refuse de traiter l'image
  | "quality" // qualité insuffisante : rapport partiel
  | "implausible" // estimations hors plage : rapport partiel
  | "garbage" // réponse vision non conforme, deux fois : rapport partiel
  | "garbage_once" // réponse vision non conforme une fois, valide à la relance
  | "text_forbidden" // rédaction avec un mot interdit, deux fois : rapport partiel
  | "text_forbidden_once" // rédaction interdite une fois, conforme à la relance
  | "text_foreign_number" // rédaction qui recalcule une valeur, deux fois : rapport partiel
  | "text_soft" // rédaction trop courte, deux fois : acceptée après la relance (règle souple)
  | "text_refused"; // le prestataire refuse la rédaction, deux fois : rapport partiel

const REFUSALS: Partial<Record<Scenario, Exclude<MotifV2, "ok">>> = {
  refuse_face: "visage_visible",
  doute_majorite: "doute_majorite",
  image_non_originale: "image_non_originale",
  plusieurs_personnes: "plusieurs_personnes",
  quality: "qualite_insuffisante",
};

/**
 * Observations simulées. Le marqueur « [obs-simulee] » permet aux tests de vérifier qu'aucune observation brute n'est stockée
 * (rapport, tentative) ni journalisée.
 */
export const OBSERVATION_MARKER = "[obs-simulee]";
export const SIMULATED_OBSERVATIONS: ObservationsV2 = {
  forme_generale: `${OBSERVATION_MARKER} Tige de profil régulier, proportions homogènes de la base à l'extrémité.`,
  gland_couronne: `${OBSERVATION_MARKER} Gland de forme arrondie, couronne nettement dessinée.`,
  axe: `${OBSERVATION_MARKER} Axe globalement rectiligne, légère inflexion latérale.`,
  symetrie: `${OBSERVATION_MARKER} Contours latéraux parallèles, équilibre net.`,
  surface: `${OBSERVATION_MARKER} Contour régulier, relief veineux discret, pilosité limitée à la base.`,
};

/** Estimations simulées (centimètres, degrés, rapports). */
export const SIMULATED_ESTIMATES = {
  etat: "erection",
  carte_presente: false,
  carte_lisible: false,
  longueur_cm: 14.2,
  circonference_cm: 12.1,
  longueur_sans_carte_cm: 14.2,
  circonference_sans_carte_cm: 12.1,
  courbure_degres: 8,
  courbure_direction: "gauche",
  symetrie: 93,
  rapport_gland: 0.24,
  conicite: 0.92,
} as const;

const usage = (calls: number): Usage => ({ tokensIn: 0, tokensOut: 0, ms: 5, calls });
const zeroPoint = { x: 0, y: 0, confiance: 0 };
const emptyReperage = { coins_carte: [], base: zeroPoint, extremite: zeroPoint, ligne_mediane: [], bords: [] };

export function createSimulatedVision(scenario?: Scenario, opts: { lengthMm?: number; widthMm?: number } = {}): VisionProvider {
  let analyseCalls = 0;
  let textCalls = 0;
  const pick = (): Scenario => scenario ?? ((process.env.SIM_VISION_SCENARIO as Scenario) || "ok");
  return {
    id: "simulation",

    async analyse(jpeg) {
      assertNotProduction("vision");
      analyseCalls++;
      const meta = await sharp(jpeg).metadata(); // vérifie que l'image est lisible, comme le ferait le vrai modèle
      const width = meta.width ?? 1200;
      const height = meta.height ?? 800;
      const s = pick();
      if (s === "provider_refusal") return { refused: true, json: null, usage: usage(1) };
      const refusal = REFUSALS[s];
      if (refusal) {
        return {
          refused: false,
          json: { schemaVersion: PHOTO_REPORT_V2, recevabilite: { recevable: false, motif: refusal }, estimations: {}, observations: {}, reperage: emptyReperage },
          usage: usage(1),
        };
      }
      if (s === "garbage" || (s === "garbage_once" && analyseCalls === 1)) {
        return { refused: false, json: { schemaVersion: PHOTO_REPORT_V2, recevabilite: { recevable: true, motif: "ok" } }, usage: usage(1) };
      }

      const estimations: Record<string, unknown> = { ...SIMULATED_ESTIMATES };
      let reperage: unknown = emptyReperage;
      if (s === "rest") Object.assign(estimations, { etat: "repos", longueur_cm: 9.6, circonference_cm: 9.5, longueur_sans_carte_cm: 9.6, circonference_sans_carte_cm: 9.5 });
      if (s === "curved") Object.assign(estimations, { courbure_degres: 35, courbure_direction: "haut" });
      if (s === "low") Object.assign(estimations, { longueur_cm: 11.3, circonference_cm: 10.4, longueur_sans_carte_cm: 11.3, circonference_sans_carte_cm: 10.4 });
      if (s === "implausible") Object.assign(estimations, { longueur_cm: 48, circonference_cm: 40 });
      if (s === "calibrated" || s === "card_unusable") {
        const longSide = Math.max(width, height);
        Object.assign(estimations, { carte_presente: true, carte_lisible: true, longueur_sans_carte_cm: 13.4, circonference_sans_carte_cm: 11.9 });
        reperage = simulateShot({
          ...DEFAULT_SHOT,
          width,
          height,
          focalPx: CAMERA.focalFactor * longSide,
          cardWidthPx: 0.3 * longSide,
          azimuthDeg: -90, // l'axe X de la scène suit la largeur de l'image
          lengthMm: opts.lengthMm ?? 130,
          diameterMm: opts.widthMm ?? 40,
          ...(s === "card_unusable" ? { tiltDeg: 62 } : {}),
        }).reperage;
      }
      return {
        refused: false,
        json: { schemaVersion: PHOTO_REPORT_V2, recevabilite: { recevable: true, motif: "ok" }, estimations, observations: { ...SIMULATED_OBSERVATIONS }, reperage },
        usage: usage(1),
      };
    },

    async writeReport(input) {
      assertNotProduction("vision");
      textCalls++;
      const s = pick();
      if (s === "text_refused") return { refused: true, json: null, usage: usage(1) };
      const text = simulatedReportText(input);
      const json: Record<string, unknown> = { schemaVersion: PHOTO_REPORT_V2, ...text };
      if (s === "text_forbidden" || (s === "text_forbidden_once" && textCalls === 1)) {
        json.aspect_surface = `${text.aspect_surface} La teinte de la surface est uniforme.`;
      }
      if (s === "text_foreign_number") json.conclusion = `${text.conclusion} L'écart à la médiane atteint 1,7 cm.`;
      if (s === "text_soft") {
        json.aspect_surface = "Le contour présente une régularité soutenue.";
        json.gland_couronne = "Le gland présente un dessin net.";
      }
      return { refused: false, json, usage: usage(1) };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Rapport rédigé simulé : conforme à toutes les règles du cahier des charges (vérifié par les tests), construit sur les valeurs
// calculées. Sert aux tests, à l'essai à blanc du kit de test et aux tests de bout en bout. Le vrai texte vient du modèle.
// ---------------------------------------------------------------------------------------------------------------------------

const LABEL_DESC = {
  "morphotype classique": "proche du centre de la distribution",
  "morphotype distinctif": "doté d'une signature propre",
  "morphotype singulier": "à la signature très personnelle",
} as const;

const article = (k: IndicatorKey) => (k === "longueur" ? "la longueur" : k === "circonference" ? "la circonférence" : `l'${INDICATOR_LABELS[k].charAt(0).toLowerCase()}${INDICATOR_LABELS[k].slice(1)}`);

export function simulatedReportText(input: Pick<ReportTextInput, "indicators" | "method" | "allowedHighlights">): ReportText {
  const ind: MorphoIndicators = input.indicators;
  const n = (x: number) => frNum(x);
  const pL = ind.percentileLongueur === null ? null : Math.round(ind.percentileLongueur);
  const pC = Math.round(ind.percentileCirconference);
  const glans = frNum(ind.rapportGland, 2);
  const glansPct = Math.round(ind.rapportGland * 100);
  const ratio = frNum(ind.ratioConicite, 2);
  const curved = ind.courbureDeg >= 5;
  const fav = favourableIndicators(ind);

  // Deux jeux de formulations (synthèse, points remarquables) : aucune expression ne revient plus de deux fois.
  const opening: Record<IndicatorKey, string> = {
    longueur: `La longueur de ${n(ind.longueurCm)} cm, relevée de la base à l'extrémité, place la tige au percentile ${pL} de l'échantillon de Veale.`,
    circonference: `La circonférence à mi-tige atteint ${n(ind.circonferenceCm)} cm, ce qui la situe au percentile ${pC} des sujets étudiés.`,
    courbure: `L'axe présente une courbure de ${ind.courbureDeg}°.`,
    rectitude: `L'Indice de rectitude axiale (alignement de l'axe) s'établit à ${ind.rectitude} sur 100, pour un angle de ${ind.courbureDeg}°.`,
    symetrie: `Le Coefficient de symétrie bilatérale (concordance des contours gauche et droit) atteint ${ind.symetrie} sur 100.`,
    conicite: `L'Index de conicité distale (régularité de la largeur vers l'extrémité) s'élève à ${ind.conicite} sur 100.`,
    typicite: `L'Indice de typicité (proximité avec le centre de la population) ressort à ${ind.typicite} sur 100.`,
  };
  const highlight: Record<IndicatorKey, string> = {
    longueur: `Une dimension longitudinale de ${n(ind.longueurCm)} cm, qui affirme l'axe principal du profil.`,
    circonference: `Un calibre de ${n(ind.circonferenceCm)} cm à mi-tige, qui donne de la présence à l'ensemble.`,
    courbure: `Une trajectoire d'axe lisible et continue.`,
    rectitude: `Un alignement coté ${ind.rectitude} sur 100, qui structure toute la silhouette.`,
    symetrie: `Un équilibre latéral de ${ind.symetrie} sur 100, signe d'une construction harmonieuse.`,
    conicite: `Une conicité cotée ${ind.conicite} sur 100, qui assure une transition fluide vers l'extrémité.`,
    typicite: `Une typicité de ${ind.typicite} sur 100, qui ancre le profil dans le ${ind.typiciteLibelle}.`,
  };

  const axe = needsMedicalSentence(ind)
    ? [
        `L'axe suit une trajectoire continue, avec une inflexion progressive ${directionText(ind.courbureDirection)} et un Indice de rectitude axiale de ${ind.rectitude} sur 100.`,
        `La courbure relevée atteint ${ind.courbureDeg}°, d'un seul tenant, sans rupture de la ligne de la tige.`,
        "La régularité de cette inflexion montre une construction homogène de la base jusqu'à la région distale (située vers l'extrémité).",
        "À partir de 30°, un avis médical permet, si vous le souhaitez, de faire le point sur cette courbure.",
      ]
    : curved
      ? [
          `L'axe conserve une trajectoire régulière, avec un Indice de rectitude axiale de ${ind.rectitude} sur 100.`,
          `La courbure de ${ind.courbureDeg}° s'oriente ${directionText(ind.courbureDirection)}, selon une inflexion progressive et sans angulation brusque.`,
          "Une courbure de cet ordre relève de la variante de la normale (diversité habituelle des formes), largement représentée parmi les sujets étudiés.",
          "La continuité de la ligne, de la région proximale (proche de la base) à l'extrémité, renforce la lisibilité de l'ensemble.",
        ]
      : [
          `L'axe se présente comme rectiligne, avec une courbure de ${ind.courbureDeg}° et un Indice de rectitude axiale de ${ind.rectitude} sur 100.`,
          "Aucune inflexion latérale ni verticale ne vient modifier la trajectoire de la tige.",
          "Cette rectitude (alignement de l'axe) constitue un repère de lecture particulièrement net.",
          "La continuité de la ligne, de la région proximale (proche de la base) à l'extrémité, renforce la lisibilité de l'ensemble.",
        ];

  const position =
    pL !== null
      ? [
          `Dans l'échantillon de Veale et al. (2015), la longueur se place au percentile ${pL}, en regard d'une médiane de ${n(ind.medianeLongueurCm)} cm.`,
          `La circonférence se situe au-dessus de ${pC} % des valeurs observées, pour une médiane de ${n(ind.medianeCirconferenceCm)} cm.`,
          `L'Indice de typicité de ${ind.typicite} sur 100 classe l'ensemble en ${ind.typiciteLibelle}, c'est-à-dire un profil ${LABEL_DESC[ind.typiciteLibelle]}.`,
          "Cette double lecture, longitudinale et transversale, donne une image complète du positionnement.",
        ]
      : [
          `Au repos, la circonférence occupe le percentile ${pC} dans l'échantillon de Veale et al. (2015).`,
          "La longueur n'est pas positionnée dans cet état, conformément à la méthode du laboratoire.",
          `L'Indice de typicité de ${ind.typicite} sur 100 classe l'ensemble en ${ind.typiciteLibelle}, c'est-à-dire un profil ${LABEL_DESC[ind.typiciteLibelle]}.`,
          "La lecture transversale, centrée sur le calibre, donne ici un repère stable et directement comparable.",
        ];

  const low = (ind.percentileLongueur !== null && ind.percentileLongueur < 25) || ind.percentileCirconference < 25;
  const methodText = input.method === "calibree" ? "une mesure calibrée sur la carte de référence" : "une estimation visuelle";

  return {
    synthese: [opening[fav[0]], opening[fav[1]], `Le score global de ${ind.score} sur 100 confirme un ensemble cohérent, dont chaque indicateur est détaillé ci-dessous.`].join(" "),
    appreciations: {
      longueur:
        pL !== null ? "Dimension longitudinale nettement lisible, comparée à la valeur centrale de Veale." : "Dimension longitudinale relevée au repos, sans positionnement statistique dans cet état.",
      circonference: "Calibre régulier à mi-tige, situé par rapport à l'échantillon de référence.",
      courbure: curved ? "Inflexion progressive et régulière, sans rupture de l'axe." : "Axe rectiligne sur toute sa longueur.",
      rectitude: ind.rectitude >= 70 ? "Alignement axial bien conservé sur toute la hauteur de la tige." : "Alignement lisible, infléchi selon une direction unique et constante.",
      symetrie: "Répartition latérale nette et parfaitement lisible.",
      conicite: "Transition harmonieuse entre la base et la région sous-glandulaire (située sous le gland).",
      typicite: `Profil classé ${ind.typiciteLibelle}, d'après les percentiles disponibles.`,
    },
    morphologie_generale: [
      `La silhouette générale présente une tige régulière et bien proportionnée, dont la longueur de ${n(ind.longueurCm)} cm se lit sans discontinuité jusqu'à la pointe.`,
      pL !== null
        ? `Rapportée à la médiane de référence, fixée à ${n(ind.medianeLongueurCm)} cm en érection, cette longueur se situe au percentile ${pL}.`
        : "Au repos, cette dimension n'est pas positionnée : seule la circonférence reçoit un percentile dans cet état.",
      `La circonférence à mi-tige, estimée à ${n(ind.circonferenceCm)} cm, accompagne cette dimension longitudinale avec un calibre homogène.`,
      low
        ? "L'ensemble s'inscrit dans un gabarit compact, aux proportions nettes et bien articulées."
        : "Le rapport entre ces deux grandeurs compose un gabarit équilibré, sans zone de resserrement ni renflement marqué.",
    ].join(" "),
    gland_couronne: [
      "Le gland présente un dessin net et une couronne (rebord circulaire à la base du gland) bien individualisée.",
      `Sa longueur représente ${glans} de la longueur totale, soit ${glansPct} %, une proportion qui s'intègre harmonieusement au reste de la tige.`,
      "La transition entre la couronne et la tige s'effectue sans décrochement, ce qui renforce la continuité du profil.",
      `Le rapport de ${ratio} entre la largeur sous le gland et la largeur à la base traduit une conicité distale (affinement progressif vers l'extrémité) maîtrisée.`,
    ].join(" "),
    axe_courbure: axe.join(" "),
    symetrie_equilibre: [
      `Le Coefficient de symétrie bilatérale s'établit à ${ind.symetrie} sur 100, signe d'un équilibre net entre les deux côtés de l'axe.`,
      "Les contours latéraux évoluent en parallèle sur toute la hauteur, sans asymétrie (écart entre la gauche et la droite) notable.",
      `L'Index de conicité distale, à ${ind.conicite} sur 100, confirme une largeur qui se maintient de façon harmonieuse jusqu'à la région distale.`,
      "Cette cohérence entre symétrie et conicité donne au profil une stabilité visuelle appréciable.",
    ].join(" "),
    aspect_surface: [
      "Le contour présente une régularité soutenue, sans irrégularité de relief sur la longueur observée.",
      "Le réseau veineux superficiel (veines visibles sous la surface) se dessine de manière discrète et homogène.",
      "La pilosité, limitée à la base, ne modifie pas la lecture de la silhouette.",
      "Ces caractères de surface complètent une description d'ensemble nette et ordonnée.",
    ].join(" "),
    positionnement_statistique: position.join(" "),
    points_remarquables: input.allowedHighlights.slice(0, 3).map((k) => ({ indicateur: k, texte: highlight[k] })),
    conclusion: [
      `Le présent rapport décrit une morphologie harmonieuse, portée en premier lieu par ${article(fav[0])} et ${article(fav[1])}.`,
      "Chaque indicateur se situe dans une configuration valorisante, que le laboratoire consigne avec satisfaction.",
    ].join(" "),
    note_laboratoire:
      ind.state === "rest"
        ? `Ce rapport repose sur ${methodText} au repos ; une observation en érection donne une lecture complète des dimensions.`
        : `Ce rapport repose sur ${methodText}, dont les valeurs restent des estimations à lire comme telles.`,
  };
}
