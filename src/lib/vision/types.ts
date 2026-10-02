import { RECEVABILITE_MOTIFS } from "./schema";

export const MOTIFS = RECEVABILITE_MOTIFS;
export type Motif = (typeof MOTIFS)[number];

/** Consommation d'un ou plusieurs appels au modèle (jetons, durée, nombre d'appels réellement envoyés). */
export type Usage = { tokensIn: number; tokensOut: number; ms: number; calls: number };

/** Réponses BRUTES du modèle : le flux d'analyse les valide contre le schéma versionné (src/lib/vision/schema.ts) et relance une fois. */
export type VisionResult = {
  /** Le prestataire a refusé de traiter l'image (filtre de contenu) : traité comme non recevable, sans détail. */
  refused: boolean;
  /** Réponse de recevabilité ({ schemaVersion, recevable, motif }), à valider. */
  recevabilite: unknown;
  /** Repérage ({ schemaVersion, coins_carte, … }), à valider ; absent si la photo n'est pas recevable. */
  reperage: unknown;
  usage: Usage;
};

/** Indicateurs calculés par le code, traduits en qualificatifs dans le prompt : le modèle ne reçoit aucune mesure en centimètres. */
export type CommentInput = {
  formula: "B" | "C";
  state: "rest" | "erect";
  score: number;
  lengthPercentile: number;
  girthPercentile: number;
  /** Marge d'erreur des mesures (%). */
  marginPct: number;
  symmetry: number;
  curvatureDeg: number;
  /** Indice de confiance du repérage (0 à 100). */
  confidence: number;
  /** Grand côté de la carte / grand côté de l'image (0 à 1). */
  cardFraction: number;
  /** Inclinaison de l'appareil (degrés). */
  tiltDeg: number;
  declaredGapFlagged: boolean;
};

export class VisionError extends Error {
  constructor(
    public kind: "network" | "timeout" | "auth" | "policy" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

/** Fournisseur d'analyse d'image et de rédaction. La photo n'est jamais journalisée ni conservée. */
export interface VisionProvider {
  id: string;
  /** Recevabilité + repérage des points (le modèle ne mesure rien). Les réponses brutes sont validées par le flux d'analyse. */
  analyse(jpeg: Buffer): Promise<VisionResult>;
  /** Appel texte seul : reçoit uniquement des indicateurs calculés, jamais la photo. Renvoie le JSON brut, validé par le flux. */
  writeComment(input: CommentInput): Promise<{ json: unknown; usage: Usage }>;
}
