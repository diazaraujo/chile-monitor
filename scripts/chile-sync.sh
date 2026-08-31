#!/usr/bin/env bash
# Chile Monitor · sync cada 4 h (reemplaza el loop que vivía en Grok CLI).
# Sin red al SEA: solo unpackea lo que ya está en disco y relee Postgres IA.
set -u
cd /mnt/data/chile-monitor || exit 1
PY=.venv-gis/bin/python3; [ -x "$PY" ] || PY=python3
echo "=== $(date -Is) trazados"; "$PY" scripts/chile-local-trazados.py --scraped-limit 400
echo "=== $(date -Is) ficha";    "$PY" scripts/chile-ficha-live.py
echo "=== $(date -Is) territorial"; set -a; . ./.env.local 2>/dev/null; set +a; "$PY" scripts/chile-seed-territorial.py
echo "=== $(date -Is) done"
