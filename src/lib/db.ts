import pg from "pg";

const globalForPg = globalThis as unknown as { nmbPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForPg.nmbPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL manquant");
    globalForPg.nmbPool = new pg.Pool({ connectionString, max: 10 });
  }
  return globalForPg.nmbPool;
}
