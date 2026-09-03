#!/bin/bash
# Chile Monitor · matriz de completitud: un check verificable por punto de la estabilización (sep-2026).
# Uso: bash scripts/chile-verify.sh   → exit 1 si algún check obligatorio falla.
cd "$(dirname "$0")/.." || exit 1
DATA=/mnt/data/chile-monitor
KV=http://127.0.0.1:8079; TOK="Bearer ${UPSTASH_REDIS_REST_TOKEN:-chilemonitor-local}"
fail=0
ok()   { printf '  OK    %s\n' "$1"; }
bad()  { printf '  FALLA %s\n' "$1"; fail=1; }
pend() { printf '  PEND  %s\n' "$1"; }
kv_age_h() { curl -sf -H "Authorization: $TOK" "$KV/get/seed-meta:$1" | python3 -c 'import sys,json,time; r=json.load(sys.stdin)["result"]; print(round((time.time()-json.loads(r)["fetchedAt"]/1000)/3600,1) if r else "")' 2>/dev/null; }
age_check() { local h; h=$(kv_age_h "$2"); [ -n "$h" ] && python3 -c "import sys; sys.exit(0 if $h < $3 else 1)" && ok "$1 (${h}h)" || bad "$1 (edad: ${h:-sin seed})"; }

echo "1. Incendios (capa fires)"
crontab -l | grep -q seed-fire-detections.mjs && ok "cron FIRMS instalado (guardado por key)" || bad "cron FIRMS ausente"
if grep -qE '^NASA_FIRMS_API_KEY=.+' "$DATA/.env.local" 2>/dev/null; then age_check "seed wildfire:fires" wildfire:fires 6; else pend "NASA_FIRMS_API_KEY no está en .env.local: la capa queda vacía hasta ponerla"; fi

echo "2. Deploy verificable"
V=$(curl -sf -m 10 http://127.0.0.1:8142/version.json) && ok "prod :8142 expone version.json" || bad "prod :8142 sin version.json"
SHA=$(printf '%s' "$V" | python3 -c 'import sys,json; print(json.load(sys.stdin)["sha"])' 2>/dev/null)
MAIN=$(git -C "$DATA" rev-parse fork/main 2>/dev/null)
[ -n "$SHA" ] && [ "$SHA" = "$MAIN" ] && ok "prod = fork/main (${SHA:0:8})" || bad "prod ${SHA:0:8} ≠ fork/main ${MAIN:0:8}"
[ "$(git -C "$DATA" rev-parse --abbrev-ref HEAD)" = main ] && ok "tree vivo en main" || bad "tree vivo en $(git -C "$DATA" rev-parse --abbrev-ref HEAD), no en main"

echo "3. Health por variante"
H="$DATA/public/chile/health.json"
python3 - "$H" <<'EOF' && ok "health.json con checks de seeds y prod=main" || bad "health.json incompleto"
import sys,json; d=json.load(open(sys.argv[1])); names={c["name"] for c in d["checks"]}
need={"prod :8142","prod = main","sismos USGS (capa natural)","eventos naturales EONET/GDACS","clima hielo/océano NOAA"}
sys.exit(0 if need<=names else 1)
EOF
age_check "seed sismos" seismology:earthquakes 1
age_check "seed eventos naturales" natural:events 9

echo "4. Acceso"
curl -sf -m 10 -o /dev/null http://127.0.0.1:8142/dashboard && ok "LAN :8142/dashboard responde" || bad "LAN :8142 no responde"
pend "dominio público con HTTPS: decisión pendiente (receta: túnel Cloudflare → 127.0.0.1:8142)"

echo "5. README"
grep -q '^# Chile Monitor' README.md && test -s docs/README.upstream.md && ok "README propio + upstream archivado" || bad "README no es el de Chile Monitor"

echo "6. Clima"
age_check "seed climate:ocean-ice" climate:ocean-ice 48
pend "climate:anomalies (zone-normals >240 s) y climate:disasters (appname ReliefWeb) fuera"

echo "Regresión"
T=$(mktemp -d); docker run --rm chile-monitor:prod cat /usr/share/nginx/html/dashboard.html > "$T/d.html" 2>/dev/null; docker run --rm chile-monitor:prod cat /etc/nginx/nginx.conf.template > "$T/n.conf" 2>/dev/null
python3 scripts/csp_check.py "$T/d.html" "$T/n.conf" >/dev/null 2>&1 && ok "CSP: inline scripts de la imagen prod cubiertos" || bad "CSP: hash faltante en la imagen prod (python3 scripts/csp_check.py)"; rm -rf "$T"
[ $fail -eq 0 ] && echo "TODO OK" || echo "HAY FALLAS"
exit $fail
