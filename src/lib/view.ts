import { FORMULAS, type FormulaId } from "@/config/site";
import { getReport } from "./repo";
import type { ReportResults } from "./report";

export type ReportView =
  | { status: "not_found" }
  | { status: "locked"; formula: FormulaId; priceEur: number; waiverAccepted: boolean }
  | { status: "unlocked"; formula: FormulaId; results: ReportResults; createdAt: Date };

/**
 * Point unique par lequel une page lit un rapport. Tant que `paid` est faux,
 * aucun résultat chiffré (score, mesures, percentiles, commentaire) n'est renvoyé.
 */
export async function getReportView(id: string): Promise<ReportView> {
  const row = await getReport(id);
  if (!row) return { status: "not_found" };
  if (!row.paid) {
    return {
      status: "locked",
      formula: row.formula,
      priceEur: FORMULAS[row.formula].priceEur,
      waiverAccepted: row.waiver_accepted_at !== null,
    };
  }
  return { status: "unlocked", formula: row.formula, results: row.results, createdAt: row.created_at };
}
