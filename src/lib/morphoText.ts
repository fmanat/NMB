import type { IndicatorKey } from "./morpho";

// Structure du rapport rédigé, version 2 (photo-report/2). Module pur (aucune dépendance) : partagé par la page du rapport,
// le PDF, le kit de test et la validation (src/lib/vision/reportText.ts, qui contient les contrôles).

/** Rubriques rédigées (paragraphes de 3 à 5 phrases), dans l'ordre du rapport. */
export const SECTION_KEYS = [
  "morphologie_generale",
  "gland_couronne",
  "axe_courbure",
  "symetrie_equilibre",
  "aspect_surface",
  "positionnement_statistique",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_TITLES: Record<SectionKey, string> = {
  morphologie_generale: "Morphologie générale",
  gland_couronne: "Profil du gland et de la couronne",
  axe_courbure: "Axe et courbure",
  symetrie_equilibre: "Symétrie et équilibre",
  aspect_surface: "Aspect de surface",
  positionnement_statistique: "Positionnement statistique",
};

export type ReportText = {
  synthese: string;
  appreciations: Record<IndicatorKey, string>;
  morphologie_generale: string;
  gland_couronne: string;
  axe_courbure: string;
  symetrie_equilibre: string;
  aspect_surface: string;
  positionnement_statistique: string;
  points_remarquables: { indicateur: IndicatorKey; texte: string }[];
  conclusion: string;
  note_laboratoire: string;
};

