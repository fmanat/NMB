#!/bin/sh
# Purge horaire (Clever Cloud) : rapports non payes et empreintes d IP de plus de 24 h. Voir docs/CLEVER-CLOUD.md.
cd "$(dirname "$0")/.." || exit 1
exec node scripts/purge.mjs
