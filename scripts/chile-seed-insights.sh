#!/usr/bin/env bash
# Chile Monitor · siembra news:insights:v1 (Brief Chile) desde el digest chile/es con Ollama (Mac, túnel :11435).
set -u
cd /mnt/data/chile-monitor || exit 1
export PATH=/home/antonio/.local/bin:$PATH
set -a; . ./.env.local; set +a
export SEED_LANGUAGE=es
echo "=== $(date -Is)"
timeout 1500 node scripts/seed-insights.mjs
