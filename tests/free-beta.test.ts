import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dashboardStats } from "@/lib/admin/stats";
import { pool, poolMax } from "@/lib/db";
import { BETA } from "@/lib/mode";
import { CheckoutError, startCheckout } from "@/lib/payments/checkout";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport, globalStats, purgeExpired, reportKey } from "@/lib/repo";
import { getReportView } from "@/lib/view";

const input = { state: "erect", length: 14, girth: 12, curvature: "none", direction: "none" } as const;
const results = buildQuestionnaireReport(input);
const make = (freeBeta?: boolean) => createReport({ formula: "A", input, results, ipHash: "h", freeBeta });
const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE";

beforeEach(async () => {
  await pool().query(TABLES);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

describe("bêta gratuite : rapport débloqué sans paiement", () => {
  it("un rapport de la bêta est payé d'office, marqué bêta, sans ligne de paiement", async () => {
    const id = await make(true);
    const view = await getReportView(id);
    expect(view.status).toBe("unlocked");
    if (view.status === "unlocked") expect(view.freeBeta).toBe(true);
    const row = (await pool().query("SELECT paid, free_beta, paid_at FROM reports WHERE id = $1", [id])).rows[0];
    expect(row).toMatchObject({ paid: true, free_beta: true, paid_at: null });
    expect((await pool().query("SELECT count(*)::int AS n FROM payments")).rows[0].n).toBe(0);
  });

  it("sans le mode bêta, un rapport reste verrouillé comme avant (code de paiement intact)", async () => {
    const id = await make();
    expect((await getReportView(id)).status).toBe("locked");
    const row = (await pool().query("SELECT paid, free_beta FROM reports WHERE id = $1", [id])).rows[0];
    expect(row).toMatchObject({ paid: false, free_beta: false });
  });

  it("le journal anonyme garde le drapeau, sans date de paiement : ni conversion, ni bandeau, ni revenu", async () => {
    const id = await make(true);
    const log = (await pool().query("SELECT free_beta, paid_at FROM report_log WHERE key = $1", [reportKey(id)])).rows[0];
    expect(log).toMatchObject({ free_beta: true, paid_at: null });
    await make(false);
    const d = await dashboardStats(null);
    expect(d.freeBetaReports).toBe(1);
    expect(d.conversion.A).toEqual({ created: 1, paid: 0, rate: 0 }); // seul le rapport hors bêta compte
    expect(d.launched.A.launched).toBe(2); // mais les deux sont des analyses lancées
    expect(d.revenue.total.grossCents).toBe(0);
    expect((await globalStats()).totalAnalyses).toBe(0);
  });

  it("le paiement est refusé en mode bêta (FREE_BETA=on)", async () => {
    const id = await make(false);
    vi.stubEnv("FREE_BETA", "on");
    await expect(startCheckout(id, true)).rejects.toBeInstanceOf(CheckoutError);
    expect((await pool().query("SELECT count(*)::int AS n FROM payments")).rows[0].n).toBe(0);
  });
});

describe("conservation limitée des rapports de la bêta", () => {
  async function seed() {
    const old = await make(true);
    const recent = await make(true);
    const paidOld = await make(false);
    await pool().query("UPDATE reports SET paid = true WHERE id = $1", [paidOld]);
    await pool().query("UPDATE reports SET created_at = now() - make_interval(days => $2) WHERE id = $1", [old, BETA.reportTtlDays + 1]);
    await pool().query("UPDATE reports SET created_at = now() - make_interval(days => $2) WHERE id = $1", [paidOld, BETA.reportTtlDays + 1]);
    await pool().query("UPDATE reports SET created_at = now() - make_interval(days => 10) WHERE id = $1", [recent]);
    return { old, recent, paidOld };
  }
  const ids = async () => (await pool().query("SELECT id FROM reports")).rows.map((r) => r.id as string);

  it("purgeExpired efface les rapports bêta de plus de 90 jours, garde les récents et les rapports réellement payés", async () => {
    const s = await seed();
    await purgeExpired();
    const left = await ids();
    expect(left).toContain(s.recent);
    expect(left).toContain(s.paidOld);
    expect(left).not.toContain(s.old);
  });

  it("le script de purge planifié applique la même règle (et la même durée)", async () => {
    expect(readFileSync("scripts/purge.mjs", "utf8")).toContain(`BETA_TTL_DAYS = ${BETA.reportTtlDays}`);
    const s = await seed();
    execFileSync("node", ["scripts/purge.mjs"], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! }, stdio: "pipe" });
    const left = await ids();
    expect(left.sort()).toEqual([s.recent, s.paidOld].sort());
  });
});

describe("limite de connexions à la base", () => {
  it("DB_POOL_MAX borne le nombre de connexions (défaut 10, valeurs absurdes ignorées)", () => {
    expect(poolMax({})).toBe(10);
    expect(poolMax({ DB_POOL_MAX: "5" })).toBe(5);
    for (const v of ["0", "-1", "abc", "1000", "2.5", ""]) expect(poolMax({ DB_POOL_MAX: v })).toBe(10);
  });
});
