export const MOTIFS = [
  "ok",
  "visage_visible",
  "plusieurs_personnes",
  "sujet_non_conforme",
  "carte_absente_ou_illisible",
  "image_non_originale",
  "doute_majorite",
] as const;
export type Motif = (typeof MOTIFS)[number];

export type Usage = { tokensIn: number; tokensOut: number; ms: number };

export type VisionResult = {
  recevable: boolean;
  motif: Motif;
  /** Repérage brut renvoyé par le modèle, à valider avant usage (peut être vide si non recevable). */
  reperage: unknown;
  usage: Usage;
};

export type CommentInput = {
  formula: "B" | "C";
  state: "rest" | "erect";
  score: number;
  lengthPercentile: number;
  girthPercentile: number;
  lengthMarginPct: number;
  symmetry: number;
  curvatureDeg: number;
  confidence: number;
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
  /** Un seul appel : recevabilité + repérage des points (le modèle ne mesure rien). */
  analyse(jpeg: Buffer): Promise<VisionResult>;
  /** Appel texte seul : reçoit uniquement des chiffres calculés, jamais la photo. */
  writeComment(input: CommentInput): Promise<{ text: string | null; usage: Usage }>;
}
