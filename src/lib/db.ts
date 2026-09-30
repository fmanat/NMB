import pg from "pg";

const globalForPg = globalThis as unknown as { nmbPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForPg.nmbPool) {
    // POSTGRESQL_ADDON_URI : variable fournie automatiquement par le module PostgreSQL de Clever Cloud (voir docs/CLEVER-CLOUD.md).
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI;
    if (!connectionString) throw new Error("DATABASE_URL manquant");
    globalForPg.nmbPool = new pg.Pool({ connectionString, max: 10 });
  }
  return globalForPg.nmbPool;
}
