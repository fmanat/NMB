// Applique les fichiers de db/migrations dans l'ordre, une seule fois chacun.
// Usage : npm run db:migrate   (utilise DATABASE_URL du fichier .env)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI;
if (!url) {
  console.error("DATABASE_URL manquant (voir .env).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
);
const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
const dir = join(process.cwd(), "db", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await client.query("BEGIN");
  try {
    await client.query(readFileSync(join(dir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log("Appliquée :", file);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Échec :", file, e.message);
    process.exit(1);
  }
}
await client.end();
console.log("Base à jour.");
