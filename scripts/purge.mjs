// Efface les rapports non payes de plus de 24 h, les rapports de la beta gratuite de plus de 90 jours (BETA.reportTtlDays dans
// src/lib/mode.ts) et les adresses IP hachees de plus de 24 h.
// Usage : npm run db:purge   (a planifier toutes les heures une fois en ligne)
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI });
await client.connect();
const BETA_TTL_DAYS = 90; // meme valeur que BETA.reportTtlDays (un test verifie la concordance)
const RELOCKED_TTL_DAYS = 30; // meme valeur que RELOCKED_TTL_DAYS (src/lib/repo.ts)
const del = await client.query(
  "DELETE FROM reports WHERE (paid = false AND relocked_at IS NULL AND created_at < now() - interval '24 hours')" +
    " OR (paid = false AND relocked_at < now() - make_interval(days => $2))" +
    " OR (free_beta AND created_at < now() - make_interval(days => $1))",
  [BETA_TTL_DAYS, RELOCKED_TTL_DAYS],
);
const ips = await client.query("UPDATE reports SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '24 hours'");
// Meme regle que purgeExpired() (src/lib/repo.ts) : les empreintes d'IP des tentatives d'analyse sont aussi effacees.
const att = await client.query("UPDATE analysis_attempts SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '24 hours'");
console.log(`Rapports effaces (non payes ou beta expiree) : ${del.rowCount} ; adresses IP effacees : ${ips.rowCount} ; tentatives anonymisees : ${att.rowCount}`);
await client.end();
