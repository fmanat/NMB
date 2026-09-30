#!/bin/sh
# Webhook quotidien d agregats anonymes (Clever Cloud) : sans effet si STATS_WEBHOOK_URL est vide. Voir docs/CLEVER-CLOUD.md.
cd "$(dirname "$0")/.." || exit 1
exec npx tsx scripts/stats-webhook.mts
