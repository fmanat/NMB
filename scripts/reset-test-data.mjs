// Efface TOUTES les données d'un site de TEST (rapports, journal anonyme, événements, tentatives, cartes, défis, paiements d'essai).
// Garde-fous : refuse sans RESET_TEST_DATA=oui-effacer-les-donnees-de-test ; refuse s'il existe un paiement réellement réussi chez un
// prestataire autre que « simulation » (une base qui contient de vrais paiements n'est jamais une base de test) ; ne touche ni au schéma
// ni à la table des migrations. Utilisation prévue : remettre à zéro le site de test avant de montrer l'administration.
//   RESET_TEST_DATA=oui-effacer-les-donnees-de-test node scripts/reset-test-data.mjs
import pg from "pg";

if (process.env.RESET_TEST_DATA !== "oui-effacer-les-donnees-de-test") {
  console.error("Refusé : RESET_TEST_DATA=oui-effacer-les-donnees-de-test est requis.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI });
await client.connect();
const real = await client.query("SELECT count(*)::int AS n FROM payments WHERE status IN ('succeeded', 'refunded', 'disputed') AND provider <> 'simulation'");
if (real.rows[0].n > 0) {
  console.error(`Refusé : ${real.rows[0].n} paiement(s) réel(s) dans cette base. Ce n'est pas une base de test.`);
  await client.end();
  process.exit(2);
}
const tables = ["reports", "payments", "analysis_attempts", "cards", "challenges", "report_log", "stat_events", "webhook_deliveries", "captcha_used", "funnel_events"];
const before = {};
for (const t of tables) before[t] = (await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
await client.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
console.log("Données de test effacées :", JSON.stringify(before));
await client.end();
