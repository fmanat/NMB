import type { IndicatorKey, MorphoIndicators } from "../morpho";
import type { ObservationsV2 } from "./schema2";

/** Consommation d'un ou plusieurs appels au modèle (jetons, durée, nombre d'appels réellement envoyés). */
export type Usage = { tokensIn: number; tokensOut: number; ms: number; calls: number };

export class VisionError extends Error {
  constructor(
    public kind: "network" | "timeout" | "auth" | "policy" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

/** Données transmises à l'appel texte (sans la photo) : observations du modèle de vision et valeurs calculées par le code. */
export type ReportTextInput = {
  indicators: MorphoIndicators;
  method: "visuelle" | "calibree";
  /** Observations factuelles de l'appel vision : transmises à la rédaction, jamais stockées ni journalisées. */
  observations: ObservationsV2;
  /** Indicateurs favorables admis pour les points remarquables. */
  allowedHighlights: readonly IndicatorKey[];
  /** Relance : règles violées par la rédaction précédente, transmises au modèle pour correction. */
  previousViolations?: string[];
};

/** Fournisseur d'analyse (version 2, photo-report/2). La photo n'est jamais journalisée ni conservée. */
export interface VisionProvider {
  id: string;
  /** Appel vision (avec la photo) : recevabilité, estimations, observations, points. Réponse BRUTE, validée par le flux d'analyse. */
  analyse(jpeg: Buffer): Promise<{ refused: boolean; json: unknown; usage: Usage }>;
  /** Appel texte (sans la photo) : rédaction du rapport. Réponse BRUTE, vérifiée par le flux d'analyse (relance unique). */
  writeReport(input: ReportTextInput): Promise<{ refused: boolean; json: unknown; usage: Usage }>;
}
