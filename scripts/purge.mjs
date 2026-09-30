// Efface les rapports non payes de plus de 24 h et les adresses IP hachees de plus de 24 h.
// Usage : npm run db:purge   (a planifier toutes les heures une fois en ligne)
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const del = await client.query("DELETE FROM reports WHERE paid = false AND created_at < now() - interval '24 hours'");
const ips = await client.query("UPDATE reports SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '24 hours'");
console.log(`Rapports non payes effaces : ${del.rowCount} ; adresses IP effacees : ${ips.rowCount}`);
await client.end();
