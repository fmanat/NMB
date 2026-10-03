import { FORMULAS, type FormulaId } from "@/config/site";
import { getReport } from "./repo";
import type { ReportResults } from "./report";

export type ReportView =
  | { status: "not_found" }
  | {
      status: "locked";
      formula: FormulaId;
      priceEur: number;
      waiverAccepted: boolean;
      /** Rapport reverrouillé après un remboursement ou une contestation : pas de nouveau paiement proposé. */
      relocked: boolean;
      /**
       * Formules photo : deux indicateurs visibles avant paiement. Version 1 : indice de confiance et symétrie ;
       * version 2 (photo-report/2) : Coefficient de symétrie bilatérale et Indice de rectitude axiale. Rien d'autre.
       */
      preview?: { label: string; value: number }[];
    }
  | { status: "unlocked"; formula: FormulaId; results: ReportResults; createdAt: Date; freeBeta: boolean };

/**
 * Point unique par lequel une page lit un rapport. Tant que `paid` est faux,
 * aucun résultat chiffré (score, mesures, percentiles, commentaire) n'est renvoyé.
 */
export async function getReportView(id: string): Promise<ReportView> {
  const row = await getReport(id);
  if (!row) return { status: "not_found" };
  // Rapport photo PARTIEL (échec technique) : aucune mesure, construit sur des valeurs de référence ; aucun paiement n'est demandé.
  if (!row.paid && row.results.morpho?.partielle) {
    return { status: "unlocked", formula: row.formula, results: row.results, createdAt: row.created_at, freeBeta: row.free_beta };
  }
  if (!row.paid) {
    const r = row.results;
    return {
      status: "locked",
      formula: row.formula,
      priceEur: FORMULAS[row.formula].priceEur,
      waiverAccepted: row.waiver_accepted_at !== null,
      relocked: row.relocked_at !== null,
      ...(row.formula === "A"
        ? {}
        : r.morpho?.indicateurs
          ? {
              preview: [
                { label: "Coefficient de symétrie bilatérale", value: r.morpho.indicateurs.symetrie },
                { label: "Indice de rectitude axiale", value: r.morpho.indicateurs.rectitude },
              ],
            }
          : typeof r.confidence === "number" && typeof r.symmetry === "number"
            ? {
                preview: [
                  { label: "Indice de confiance", value: r.confidence },
                  { label: "Symétrie", value: r.symmetry },
                ],
              }
            : {}),
    };
  }
  return { status: "unlocked", formula: row.formula, results: row.results, createdAt: row.created_at, freeBeta: row.free_beta };
}
