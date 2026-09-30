import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport, getReport, hashIp, countRecentByIp, purgeExpired, globalStats, priceCents } from "@/lib/repo";
import { getReportView } from "@/lib/view";
import { startCheckout, CheckoutError } from "@/lib/payments/checkout";
import { handleWebhook } from "@/lib/payments/confirm";
import { signSimulated } from "@/lib/payments/simulation";

const input = { state: "erect", length: 14, girth: 12, curvature: "light", direction: "left" } as const;

async function newReport(ipHash: string | null = null) {
  return createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash });
}

function webhook(providerRef: string, over: Partial<{ type: string; amountCents: number; currency: string }> = {}) {
  const body = JSON.stringify({ type: "payment.succeeded", providerRef, amountCents: priceCents("A"), currency: "EUR", ...over });
  return { body, sig: signSimulated(body) };
}

async function refOf(reportId: string): Promise<string> {
  const { rows } = await pool().query("SELECT provider_ref FROM payments WHERE report_id = $1", [reportId]);
  return rows[0].provider_ref;
}

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports CASCADE");
  await pool().end();
});

describe("déblocage du rapport (section 8)", () => {
  it("un rapport neuf est verrouillé et ne révèle aucun résultat", async () => {
    const id = await newReport();
    const view = await getReportView(id);
    expect(view.status).toBe("locked");
    const json = JSON.stringify(view);
    expect(json).not.toContain("percentile");
    expect(json).not.toContain("score");
    expect(json).not.toContain("comment");
    expect(json).not.toContain("14");
  });

  it("identifiant de 32 caractères ou plus, introuvable si inventé", async () => {
    const id = await newReport();
    expect(id.length).toBeGreaterThanOrEqual(32);
    expect((await getReportView("a".repeat(43))).status).toBe("not_found");
    expect((await getReportView("court")).status).toBe("not_found");
  });

  it("le paiement exige la case de renonciation", async () => {
    const id = await newReport();
    await expect(startCheckout(id, false)).rejects.toBeInstanceOf(CheckoutError);
    const { rows } = await pool().query("SELECT count(*)::int AS n FROM payments WHERE report_id = $1", [id]);
    expect(rows[0].n).toBe(0);
  });

  it("démarrer un paiement, ou revenir sur la page, ne débloque pas", async () => {
    const id = await newReport();
    await startCheckout(id, true);
    expect((await getReport(id))?.waiver_accepted_at).not.toBeNull();
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("une notification sans signature ou mal signée est rejetée", async () => {
    const id = await newReport();
    await startCheckout(id, true);
    const { body } = webhook(await refOf(id));
    await expect(handleWebhook(body, null)).rejects.toThrow();
    await expect(handleWebhook(body, "00".repeat(32))).rejects.toThrow();
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("une notification signée débloque, une seule fois (idempotent)", async () => {
    const id = await newReport();
    await startCheckout(id, true);
    const { body, sig } = webhook(await refOf(id));
    expect(await handleWebhook(body, sig)).toEqual({ ok: true, alreadyConfirmed: false });
    const view = await getReportView(id);
    expect(view.status).toBe("unlocked");
    if (view.status === "unlocked") expect(view.results.score).toBeGreaterThanOrEqual(40);
    expect(await handleWebhook(body, sig)).toEqual({ ok: true, alreadyConfirmed: true });
  });

  it("un montant incorrect ne débloque pas", async () => {
    const id = await newReport();
    await startCheckout(id, true);
    const { body, sig } = webhook(await refOf(id), { amountCents: 1 });
    expect(await handleWebhook(body, sig)).toEqual({ ok: false, reason: "amount_mismatch" });
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("une référence inconnue ne débloque rien", async () => {
    const id = await newReport();
    const { body, sig } = webhook("sim_inconnue");
    expect(await handleWebhook(body, sig)).toEqual({ ok: false, reason: "unknown_payment" });
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("un échec de paiement ne débloque pas", async () => {
    const id = await newReport();
    await startCheckout(id, true);
    const { body, sig } = webhook(await refOf(id), { type: "payment.failed" });
    expect(await handleWebhook(body, sig)).toEqual({ ok: false, reason: "failed_event" });
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("le paiement d'un rapport ne débloque pas un autre rapport", async () => {
    const a = await newReport();
    const b = await newReport();
    await startCheckout(a, true);
    await startCheckout(b, true);
    const { body, sig } = webhook(await refOf(a));
    await handleWebhook(body, sig);
    expect((await getReportView(a)).status).toBe("unlocked");
    expect((await getReportView(b)).status).toBe("locked");
  });
});

describe("conservation et limites (section 11)", () => {
  it("purge les rapports non payés de plus de 24 h, garde les payés et les récents", async () => {
    const old = await newReport();
    const fresh = await newReport();
    const paidOld = await newReport();
    await pool().query("UPDATE reports SET created_at = now() - interval '25 hours' WHERE id = ANY($1)", [[old, paidOld]]);
    await pool().query("UPDATE reports SET paid = true WHERE id = $1", [paidOld]);
    const r = await purgeExpired();
    expect(r.reports).toBe(1);
    expect(await getReport(old)).toBeNull();
    expect(await getReport(fresh)).not.toBeNull();
    expect(await getReport(paidOld)).not.toBeNull();
  });

  it("efface les IP hachées après 24 h et compte les analyses récentes", async () => {
    const h = hashIp("203.0.113.7");
    expect(h).not.toContain("203.0.113.7");
    const a = await newReport(h);
    await newReport(h);
    expect(await countRecentByIp(h)).toBe(2);
    await pool().query("UPDATE reports SET created_at = now() - interval '25 hours' WHERE id = $1", [a]);
    expect(await countRecentByIp(h)).toBe(1);
    await purgeExpired();
    const { rows } = await pool().query("SELECT ip_hash FROM reports WHERE ip_hash IS NOT NULL");
    expect(rows.length).toBe(1);
  });

  it("statistiques globales : uniquement les rapports payés issus d'une photo (B, C)", async () => {
    expect((await globalStats()).totalAnalyses).toBe(0);
    const b = await newReport();
    const c = await newReport();
    const declared = await newReport(); // formule A payée : ne compte pas
    const unpaid = await newReport(); // photo non payée : ne compte pas
    await pool().query("UPDATE reports SET formula = 'B', paid = true, paid_at = now(), score = 80 WHERE id = $1", [b]);
    await pool().query("UPDATE reports SET formula = 'C', paid = true, paid_at = now(), score = 90 WHERE id = $1", [c]);
    await pool().query("UPDATE reports SET paid = true, paid_at = now(), score = 98 WHERE id = $1", [declared]);
    await pool().query("UPDATE reports SET formula = 'B', score = 99 WHERE id = $1", [unpaid]);
    const s = await globalStats();
    expect(s.totalAnalyses).toBe(2);
    expect(s.averageScore).toBe(85);
    expect(s.bestScoreThisWeek).toBe(90);
  });
});
