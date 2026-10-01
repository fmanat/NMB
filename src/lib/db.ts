import pg from "pg";

const globalForPg = globalThis as unknown as { nmbPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForPg.nmbPool) {
    // POSTGRESQL_ADDON_URI : variable fournie automatiquement par le module PostgreSQL de Clever Cloud (voir docs/CLEVER-CLOUD.md).
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI;
    if (!connectionString) throw new Error("DATABASE_URL manquant");
    globalForPg.nmbPool = new pg.Pool({ connectionString, max: poolMax(), idleTimeoutMillis: 30_000 });
  }
  return globalForPg.nmbPool;
}

/** Nombre maximal de connexions simultanées à la base : DB_POOL_MAX (défaut 10 ; 5 recommandé sur la petite offre Railway). */
export function poolMax(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.DB_POOL_MAX);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 10;
}
