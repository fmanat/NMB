import { execFileSync } from "node:child_process";
import pg from "pg";
import { E2E } from "../playwright.config";

// Crée le schéma dédié aux tests de bout en bout si besoin, applique les migrations et le vide.
// Ne touche jamais à la base de développement (nmb) ni au schéma public de la base de tests (tests unitaires).
export default async function setup() {
  const plain = E2E.dbUrl.split("?")[0];
  const admin = new pg.Client({ connectionString: plain });
  await admin.connect();
  await admin.query("CREATE SCHEMA IF NOT EXISTS e2e");
  await admin.end();

  execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: E2E.dbUrl }, stdio: "inherit" });

  const db = new pg.Client({ connectionString: E2E.dbUrl });
  await db.connect();
  await db.query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
  await db.end();
}
