// Envoie les statistiques agrégées et anonymes de la veille à l'adresse STATS_WEBHOOK_URL (Make, n8n, etc.).
//
// À lancer UNE FOIS PAR JOUR (la mise en ligne, étape 7, explique comment le planifier). Jamais en temps réel.
//
//   npm run stats:webhook                        envoie la veille
//   npm run stats:webhook -- --day 2026-10-01    envoie un jour précis (renvoi impossible si déjà envoyé)
//   npm run stats:webhook -- --dry-run           affiche ce qui serait envoyé, sans rien envoyer

import { buildDailyAggregate, sendDailyWebhook, yesterdayParis } from "@/lib/admin/webhook";
import { pool } from "@/lib/db";

const args = process.argv.slice(2);
const dayIdx = args.indexOf("--day");
const day = dayIdx >= 0 ? args[dayIdx + 1] : undefined;

try {
  if (args.includes("--dry-run")) {
    console.log(JSON.stringify(await buildDailyAggregate(day ?? (await yesterdayParis())), null, 2));
  } else {
    const r = await sendDailyWebhook({ day });
    const msg: Record<string, string> = {
      skipped_no_url: "STATS_WEBHOOK_URL n'est pas renseigné : rien à envoyer.",
      invalid_url: "Adresse refusée : " + ("reason" in r ? r.reason : ""),
      already_sent: "Déjà envoyé pour " + ("day" in r ? r.day : "") + " : rien à faire.",
      sent: "Envoyé pour " + ("day" in r ? r.day : "") + " (réponse " + ("httpStatus" in r ? r.httpStatus : "") + ").",
      failed: "Échec : " + ("reason" in r ? r.reason : "") + " (sera réessayé au prochain lancement).",
    };
    console.log(msg[r.status]);
    if (r.status === "failed" || r.status === "invalid_url") process.exitCode = 1;
  }
} finally {
  await pool().end();
}
