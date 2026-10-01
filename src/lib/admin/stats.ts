import { FINANCE, aiPricing } from "@/config/site";
import { pool } from "../db";

export type FormulaKey = "A" | "B" | "C";
const FORMULAS: FormulaKey[] = ["A", "B", "C"];

export type FinanceConfig = { vatRate: number; paymentFeeRate: number; paymentFeeFixedCents: number };

export type Finance = {
  transactions: number;
  grossCents: number; // encaissé TTC
  vatCents: number;
  netOfVatCents: number; // hors taxes
  feeCents: number; // commission du prestataire de paiement
  netCents: number; // revenu net : TTC − TVA − commission
};

/**
 * Revenu brut et net. Les prix sont TTC : TVA = TTC − TTC / (1 + taux). La commission s'applique au montant TTC encaissé.
 * Les arrondis sont faits sur les totaux, jamais transaction par transaction.
 */
export function computeFinance(grossCents: number, transactions: number, cfg: FinanceConfig = FINANCE): Finance {
  const vatCents = Math.round(grossCents - grossCents / (1 + cfg.vatRate));
  const netOfVatCents = grossCents - vatCents;
  const feeCents = Math.round(grossCents * cfg.paymentFeeRate) + cfg.paymentFeeFixedCents * transactions;
  return { transactions, grossCents, vatCents, netOfVatCents, feeCents, netCents: netOfVatCents - feeCents };
}

export type AiCost = {
  modelCalls: number; // tentatives ayant appelé le modèle
  delivered: number; // analyses abouties
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  avgPerCallUsd: number | null; // coût moyen par analyse lancée ayant appelé le modèle (refus compris)
  avgPerDeliveredUsd: number | null; // coût total / analyses abouties : le vrai coût d'une analyse livrée
  avgVisionSeconds: number | null;
};

export function computeAiCost(
  t: { modelCalls: number; delivered: number; tokensIn: number; tokensOut: number; visionMsSum: number; visionMsCount: number },
  pricing = aiPricing(),
): AiCost {
  const costUsd = (t.tokensIn * pricing.inPerM + t.tokensOut * pricing.outPerM) / 1e6;
  return {
    modelCalls: t.modelCalls,
    delivered: t.delivered,
    tokensIn: t.tokensIn,
    tokensOut: t.tokensOut,
    costUsd,
    avgPerCallUsd: t.modelCalls > 0 ? costUsd / t.modelCalls : null,
    avgPerDeliveredUsd: t.delivered > 0 ? costUsd / t.delivered : null,
    avgVisionSeconds: t.visionMsCount > 0 ? t.visionMsSum / t.visionMsCount / 1000 : null,
  };
}

export type Dashboard = {
  days: number | null; // null = depuis le début
  since: Date | null;
  launched: Record<FormulaKey, { launched: number; delivered: number; refused: number; blocked: number; error: number }>;
  refusals: { outcome: string; motif: string; n: number }[];
  conversion: Record<FormulaKey, { created: number; paid: number; rate: number | null }>;
  /** Rapports créés en bêta gratuite sur la période (débloqués sans paiement, exclus de la conversion). */
  freeBetaReports: number;
  revenue: { total: Finance; byFormula: Record<FormulaKey, Finance> };
  challenges: { created: number; taken: number };
  ai: AiCost;
};

const emptyFormulaRecord = <T>(make: () => T): Record<FormulaKey, T> => ({ A: make(), B: make(), C: make() });

/** Tableau de bord sur une période (jours glissants ; null = depuis le début). Tout est agrégé, rien d'individuel. */
export async function dashboardStats(days: number | null): Promise<Dashboard> {
  const since = days === null ? null : new Date(Date.now() - days * 86_400_000);
  const p = pool();

  // Analyses lancées. Formule A : un rapport créé = une analyse (journal). Formules photo : tentatives.
  const launched = emptyFormulaRecord(() => ({ launched: 0, delivered: 0, refused: 0, blocked: 0, error: 0 }));
  const a = await p.query("SELECT count(*)::int AS n FROM report_log WHERE formula = 'A' AND ($1::timestamptz IS NULL OR created_at >= $1)", [since]);
  launched.A = { launched: a.rows[0].n, delivered: a.rows[0].n, refused: 0, blocked: 0, error: 0 };
  const att = await p.query(
    "SELECT formula, outcome, count(*)::int AS n FROM analysis_attempts WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY formula, outcome",
    [since],
  );
  for (const r of att.rows as { formula: "B" | "C"; outcome: string; n: number }[]) {
    const row = launched[r.formula];
    row.launched += r.n;
    if (r.outcome === "ok") row.delivered += r.n;
    else if (r.outcome === "refused") row.refused += r.n;
    else if (r.outcome === "blocked") row.blocked += r.n;
    else if (r.outcome === "error") row.error += r.n;
  }

  // Refus par motif.
  const ref = await p.query(
    `SELECT outcome, COALESCE(motif, '(non précisé)') AS motif, count(*)::int AS n
       FROM analysis_attempts
      WHERE outcome IN ('refused', 'blocked', 'error') AND ($1::timestamptz IS NULL OR created_at >= $1)
      GROUP BY outcome, motif ORDER BY n DESC, motif`,
    [since],
  );

  // Conversion : parmi les rapports créés sur la période, part de ceux qui ont été payés.
  const conversion = emptyFormulaRecord(() => ({ created: 0, paid: 0, rate: null as number | null }));
  const conv = await p.query(
    `SELECT formula, count(*)::int AS created, count(paid_at)::int AS paid
       FROM report_log WHERE NOT free_beta AND ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY formula`,
    [since],
  );
  for (const r of conv.rows as { formula: FormulaKey; created: number; paid: number }[]) {
    conversion[r.formula] = { created: r.created, paid: r.paid, rate: r.created > 0 ? r.paid / r.created : null };
  }

  const beta = await p.query("SELECT count(*)::int AS n FROM report_log WHERE free_beta AND ($1::timestamptz IS NULL OR created_at >= $1)", [since]);

  // Revenus : paiements confirmés sur la période (conservés même si le rapport a été supprimé).
  const pay = await p.query(
    `SELECT COALESCE(formula, 'A') AS formula, count(*)::int AS n, COALESCE(sum(amount_cents), 0)::int AS gross
       FROM payments WHERE status = 'succeeded' AND ($1::timestamptz IS NULL OR confirmed_at >= $1) GROUP BY formula`,
    [since],
  );
  const byFormula = emptyFormulaRecord(() => computeFinance(0, 0));
  let totalGross = 0;
  let totalTx = 0;
  for (const r of pay.rows as { formula: FormulaKey; n: number; gross: number }[]) {
    byFormula[r.formula] = computeFinance(r.gross, r.n);
    totalGross += r.gross;
    totalTx += r.n;
  }

  // Défis créés et relevés.
  const ch = await p.query(
    `SELECT kind, count(*)::int AS n FROM stat_events WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY kind`,
    [since],
  );
  const chMap = Object.fromEntries((ch.rows as { kind: string; n: number }[]).map((r) => [r.kind, r.n]));

  // Coût de l'analyse par le modèle.
  const ai = await p.query(
    `SELECT count(tokens_in)::int AS model_calls,
            count(*) FILTER (WHERE outcome = 'ok')::int AS delivered,
            COALESCE(sum(tokens_in), 0)::bigint AS tin, COALESCE(sum(tokens_out), 0)::bigint AS tout,
            COALESCE(sum(vision_ms), 0)::bigint AS ms_sum, count(vision_ms)::int AS ms_count
       FROM analysis_attempts WHERE ($1::timestamptz IS NULL OR created_at >= $1)`,
    [since],
  );
  const t = ai.rows[0];

  return {
    days,
    since,
    launched,
    refusals: ref.rows,
    conversion,
    freeBetaReports: beta.rows[0].n,
    revenue: { total: computeFinance(totalGross, totalTx), byFormula },
    challenges: { created: chMap.challenge_created ?? 0, taken: chMap.challenge_taken ?? 0 },
    ai: computeAiCost({
      modelCalls: t.model_calls,
      delivered: t.delivered,
      tokensIn: Number(t.tin),
      tokensOut: Number(t.tout),
      visionMsSum: Number(t.ms_sum),
      visionMsCount: t.ms_count,
    }),
  };
}

export { FORMULAS };
