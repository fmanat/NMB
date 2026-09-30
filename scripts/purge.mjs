// Efface les rapports non payes de plus de 24 h et les adresses IP hachees de plus de 24 h.
// Usage : npm run db:purge   (a planifier toutes les heures une fois en ligne)
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI });
await client.connect();
const del = await client.query("DELETE FROM reports WHERE paid = false AND created_at < now() - interval '24 hours'");
const ips = await client.query("UPDATE reports SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '24 hours'");
// Meme regle que purgeExpired() (src/lib/repo.ts) : les empreintes d'IP des tentatives d'analyse sont aussi effacees.
const att = await client.query("UPDATE analysis_attempts SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '24 hours'");
console.log(`Rapports non payes effaces : ${del.rowCount} ; adresses IP effacees : ${ips.rowCount} ; tentatives anonymisees : ${att.rowCount}`);
await client.end();
