import { execFileSync, spawnSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport } from "@/lib/repo";

const OK = "oui-effacer-les-donnees-de-test";
const run = (env: Record<string, string>) => spawnSync("node", ["scripts/reset-test-data.mjs"], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL!, ...env }, encoding: "utf8" });
const input = { state: "erect", length: 14, girth: 12, curvature: "none", direction: "none" } as const;
const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, funnel_events CASCADE";

beforeEach(async () => {
  await pool().query(TABLES);
});
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

async function seed() {
  await createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash: "h" });
  await pool().query("INSERT INTO funnel_events (kind) VALUES ('home_view')");
  await pool().query("INSERT INTO stat_events (kind) VALUES ('challenge_created')");
}
const count = async (t: string) => (await pool().query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n as number;

describe("remise à zéro d'un site de test", () => {
  it("refuse sans la variable de confirmation exacte, et ne touche à rien", async () => {
    await seed();
    for (const env of [{}, { RESET_TEST_DATA: "oui" }, { RESET_TEST_DATA: "" }] as Record<string, string>[]) {
      const r = run(env);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("Refusé");
    }
    expect(await count("reports")).toBe(1);
    expect(await count("funnel_events")).toBe(1);
  });

  it("efface les données de test, garde le schéma et la table des migrations", async () => {
    await seed();
    const migrationsBefore = await count("schema_migrations");
    const out = execFileSync("node", ["scripts/reset-test-data.mjs"], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL!, RESET_TEST_DATA: OK }, encoding: "utf8" });
    expect(out).toContain("Données de test effacées");
    for (const t of ["reports", "report_log", "funnel_events", "stat_events", "payments", "cards", "challenges", "analysis_attempts"]) expect(await count(t), t).toBe(0);
    expect(await count("schema_migrations")).toBe(migrationsBefore);
    expect(migrationsBefore).toBeGreaterThan(0);
  });

  it("refuse si la base contient un vrai paiement (réussi, remboursé ou contesté chez un vrai prestataire)", async () => {
    await seed();
    const id = (await pool().query("SELECT id FROM reports LIMIT 1")).rows[0].id;
    await pool().query("INSERT INTO payments (report_id, provider, provider_ref, amount_cents, status, formula) VALUES ($1, 'verotel', 'nmb_x', 299, 'succeeded', 'A')", [id]);
    const r = run({ RESET_TEST_DATA: OK });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("paiement(s) réel(s)");
    expect(await count("reports")).toBe(1);
    // Un paiement d'essai « simulation » n'empêche pas la remise à zéro.
    await pool().query("UPDATE payments SET provider = 'simulation'");
    expect(run({ RESET_TEST_DATA: OK }).status).toBe(0);
  });
});
