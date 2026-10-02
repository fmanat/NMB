// Compte les lignes des tables principales (LECTURE SEULE) : sert à comparer une base à sa restauration (docs/RAILWAY.md, test de restauration).
//   node scripts/db-report.mjs      (DATABASE_URL ou POSTGRESQL_ADDON_URI)
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI });
await client.connect();
const out = {};
for (const t of ["reports", "payments", "report_log", "funnel_events", "stat_events", "cards", "challenges", "analysis_attempts"]) {
  out[t] = (await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
}
const m = (await client.query("SELECT count(*)::int AS n, max(name) AS last FROM schema_migrations")).rows[0];
out.migrations = m.n;
out.lastMigration = m.last;
out.newestReportLog = (await client.query("SELECT max(created_at) AS d FROM report_log")).rows[0].d;
console.log("DB-REPORT " + JSON.stringify(out));
await client.end();
