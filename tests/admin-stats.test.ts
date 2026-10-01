import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { computeAiCost, computeFinance, dashboardStats } from "@/lib/admin/stats";
import { createChallenge, attachFriend } from "@/lib/challenge";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport, deleteReport, purgeExpired, recordPayment, reportKey, startAttempt, finishAttempt, addAttemptTokens } from "@/lib/repo";
import { startCheckout } from "@/lib/payments/checkout";
import { handleWebhook } from "@/lib/payments/confirm";
import { signSimulated } from "@/lib/payments/simulation";

const cfg = { vatRate: 0.2, paymentFeeRate: 0.12, paymentFeeFixedCents: 0 };
const input = { state: "erect", length: 14, girth: 12, curvature: "none", direction: "none" } as const;
const results = buildQuestionnaireReport(input);

async function newReport(formula: "A" | "B" | "C" = "A") {
  return createReport({ formula, input, results: { ...results, formula }, ipHash: null });
}
async function pay(id: string) {
  await startCheckout(id, true);
  const { rows } = await pool().query("SELECT provider_ref, amount_cents FROM payments WHERE report_id = $1", [id]);
  const body = JSON.stringify({ type: "payment.succeeded", providerRef: rows[0].provider_ref, amountCents: rows[0].amount_cents, currency: "EUR" });
  await handleWebhook(body, signSimulated(body));
}

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
  await pool().end();
});

describe("revenu brut et net", () => {
  it("TVA 20 % et commission 12 % sur 4,99 € TTC", () => {
    const f = computeFinance(499, 1, cfg);
    expect(f.grossCents).toBe(499);
    expect(f.vatCents).toBe(83); // 499 − 499/1,2 = 83,17
    expect(f.netOfVatCents).toBe(416);
    expect(f.feeCents).toBe(60); // 12 % de 4,99 € = 0,5988 €
    expect(f.netCents).toBe(356); // TTC − TVA − commission
    expect(f.vatCents + f.netOfVatCents).toBe(f.grossCents);
  });

  it("frais fixes par transaction et taux modifiables", () => {
    const f = computeFinance(1000, 4, { vatRate: 0.1, paymentFeeRate: 0.029, paymentFeeFixedCents: 25 });
    expect(f.vatCents).toBe(91);
    expect(f.feeCents).toBe(29 + 100);
    expect(f.netCents).toBe(1000 - 91 - 129);
  });

  it("zéro transaction : tout à zéro", () => {
    expect(computeFinance(0, 0, cfg)).toEqual({ transactions: 0, grossCents: 0, vatCents: 0, netOfVatCents: 0, feeCents: 0, netCents: 0 });
  });

  it("la configuration par défaut est 20 % de TVA et 12 % de commission", () => {
    const f = computeFinance(10000, 1);
    expect(f.vatCents).toBe(1667);
    expect(f.feeCents).toBe(1200);
  });
});

describe("coût de l'analyse par le modèle", () => {
  const p = { inPerM: 2, outPerM: 6 };
  it("coût total, par appel et par analyse livrée", () => {
    const c = computeAiCost({ modelCalls: 4, delivered: 2, tokensIn: 20_000, tokensOut: 4_000, visionMsSum: 80_000, visionMsCount: 4 }, p);
    expect(c.costUsd).toBeCloseTo(0.064, 9); // 20 000 × 2 + 4 000 × 6 = 64 000 / 1e6
    expect(c.avgPerCallUsd).toBeCloseTo(0.016, 9);
    expect(c.avgPerDeliveredUsd).toBeCloseTo(0.032, 9); // les refus coûtent aussi : coût réel d'une analyse livrée
    expect(c.avgVisionSeconds).toBe(20);
  });
  it("aucune donnée : moyennes absentes plutôt qu'un zéro trompeur", () => {
    const c = computeAiCost({ modelCalls: 0, delivered: 0, tokensIn: 0, tokensOut: 0, visionMsSum: 0, visionMsCount: 0 }, p);
    expect(c.avgPerCallUsd).toBeNull();
    expect(c.avgPerDeliveredUsd).toBeNull();
    expect(c.avgVisionSeconds).toBeNull();
  });
});

describe("journal anonyme durable", () => {
  it("créer un rapport ajoute une ligne au journal, sans l'identifiant en clair", async () => {
    const id = await newReport("B");
    const { rows } = await pool().query("SELECT * FROM report_log");
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(reportKey(id));
    expect(rows[0].key).not.toContain(id);
    expect(rows[0].formula).toBe("B");
    expect(rows[0].paid_at).toBeNull();
  });

  it("le paiement confirmé marque le journal", async () => {
    const id = await newReport("A");
    await pay(id);
    const { rows } = await pool().query("SELECT paid_at FROM report_log WHERE key = $1", [reportKey(id)]);
    expect(rows[0].paid_at).not.toBeNull();
  });

  it("supprimer le rapport, ou purger un rapport non payé, conserve le journal et les paiements", async () => {
    const paid = await newReport("A");
    await pay(paid);
    const unpaid = await newReport("A");
    await pool().query("UPDATE reports SET created_at = now() - interval '25 hours' WHERE id = $1", [unpaid]);
    await purgeExpired();
    await deleteReport(paid);
    expect((await pool().query("SELECT count(*)::int AS n FROM reports")).rows[0].n).toBe(0);
    expect((await pool().query("SELECT count(*)::int AS n FROM report_log")).rows[0].n).toBe(2);
    const pays = await pool().query("SELECT report_id, status, amount_cents, formula FROM payments");
    expect(pays.rows).toHaveLength(1);
    expect(pays.rows[0]).toEqual({ report_id: null, status: "succeeded", amount_cents: 299, formula: "A" });
  });

  it("le journal ne contient ni identifiant de rapport, ni image, ni adresse IP", async () => {
    await newReport("A");
    const cols = (await pool().query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'report_log' ORDER BY 1")).rows.map((r) => r.column_name);
    expect(cols).toEqual(["created_at", "formula", "free_beta", "key", "paid_at", "score"]);
  });
});

describe("tableau de bord", () => {
  it("analyses lancées, refus par motif, conversion, revenus, défis, coût IA", async () => {
    // Formule A : 3 rapports, 2 payés
    const a1 = await newReport("A");
    const a2 = await newReport("A");
    await newReport("A");
    await pay(a1);
    await pay(a2);
    // Formule B : 1 rapport payé
    const b1 = await newReport("B");
    await pay(b1);
    // Tentatives photo : 1 ok, 2 refusées (même motif), 1 bloquée, 1 erreur
    const t1 = await startAttempt(null, "B");
    await finishAttempt(t1, { outcome: "ok", visionMs: 20_000, tokensIn: 5_000, tokensOut: 800 });
    await addAttemptTokens(t1, 400, 200);
    for (let i = 0; i < 2; i++) {
      const t = await startAttempt(null, "B");
      await finishAttempt(t, { outcome: "refused", motif: "carte_absente_ou_illisible", visionMs: 10_000, tokensIn: 4_000, tokensOut: 500 });
    }
    await finishAttempt(await startAttempt(null, "C"), { outcome: "blocked", motif: "empreinte_connue" });
    await finishAttempt(await startAttempt(null, "C"), { outcome: "error", motif: "fournisseur_timeout" });
    // Défis : 2 créés, 1 relevé
    const creator = await newReport("A");
    await pay(creator);
    const friend = await newReport("A");
    const c1 = await createChallenge(creator);
    await createChallenge(a1);
    await attachFriend(c1, friend);

    const d = await dashboardStats(null);

    expect(d.launched.A).toEqual({ launched: 5, delivered: 5, refused: 0, blocked: 0, error: 0 });
    expect(d.launched.B).toEqual({ launched: 3, delivered: 1, refused: 2, blocked: 0, error: 0 });
    expect(d.launched.C).toEqual({ launched: 2, delivered: 0, refused: 0, blocked: 1, error: 1 });

    expect(d.refusals).toEqual([
      { outcome: "refused", motif: "carte_absente_ou_illisible", n: 2 },
      { outcome: "blocked", motif: "empreinte_connue", n: 1 },
      { outcome: "error", motif: "fournisseur_timeout", n: 1 },
    ]);

    expect(d.conversion.A).toEqual({ created: 5, paid: 3, rate: 0.6 });
    expect(d.conversion.B).toEqual({ created: 1, paid: 1, rate: 1 });
    expect(d.conversion.C).toEqual({ created: 0, paid: 0, rate: null });

    // 3 paiements A (2,99 €) + 1 B (4,99 €) = 13,96 € TTC
    expect(d.revenue.total.transactions).toBe(4);
    expect(d.revenue.total.grossCents).toBe(3 * 299 + 499);
    expect(d.revenue.byFormula.A.grossCents).toBe(3 * 299);
    expect(d.revenue.byFormula.B.grossCents).toBe(499);
    expect(d.revenue.byFormula.C.grossCents).toBe(0);
    const t = d.revenue.total;
    expect(t.vatCents + t.netOfVatCents).toBe(t.grossCents);
    expect(t.netCents).toBe(t.netOfVatCents - t.feeCents);

    expect(d.challenges).toEqual({ created: 2, taken: 1 });

    // Coût : tentative ok = 5 400 + 1 000 ; 2 refusées = 2 × (4 000 + 500)
    expect(d.ai.modelCalls).toBe(3);
    expect(d.ai.delivered).toBe(1);
    expect(d.ai.tokensIn).toBe(5_400 + 8_000);
    expect(d.ai.tokensOut).toBe(1_000 + 1_000);
  });

  it("période : les événements plus anciens sont exclus", async () => {
    const id = await newReport("A");
    await pay(id);
    await pool().query("UPDATE report_log SET created_at = now() - interval '40 days'");
    await pool().query("UPDATE payments SET confirmed_at = now() - interval '40 days'");
    const old = await startAttempt(null, "B");
    await finishAttempt(old, { outcome: "refused", motif: "visage_visible" });
    await pool().query("UPDATE analysis_attempts SET created_at = now() - interval '40 days'");

    expect((await dashboardStats(30)).launched.A.launched).toBe(0);
    expect((await dashboardStats(30)).revenue.total.grossCents).toBe(0);
    expect((await dashboardStats(30)).refusals).toEqual([]);
    expect((await dashboardStats(90)).launched.A.launched).toBe(1);
    expect((await dashboardStats(null)).revenue.total.grossCents).toBe(299);
  });

  it("base vide : des zéros, aucune division par zéro", async () => {
    const d = await dashboardStats(30);
    expect(d.conversion.A.rate).toBeNull();
    expect(d.ai.avgPerCallUsd).toBeNull();
    expect(d.revenue.total.netCents).toBe(0);
  });

  it("un paiement échoué ou en attente n'est pas du revenu", async () => {
    const id = await newReport("A");
    await startCheckout(id, true); // paiement créé, jamais confirmé
    expect((await dashboardStats(null)).revenue.total.grossCents).toBe(0);
    await recordPayment({ reportId: id, formula: "A", provider: "simulation", providerRef: "sim_echec", amountCents: 299 });
    await pool().query("UPDATE payments SET status = 'failed' WHERE provider_ref = 'sim_echec'");
    expect((await dashboardStats(null)).revenue.total.grossCents).toBe(0);
  });
});
