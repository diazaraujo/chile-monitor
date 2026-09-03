#!/bin/bash
# Arranque del contenedor de producción Chile Monitor (prueba en :8142).
# ponytail: secretos efímeros regenerados en cada arranque; persistir si algún día hay sesiones que sobrevivir.
set -e
cd /mnt/data/chile-monitor
SECRET_FILE=/mnt/data/chile-monitor/.prod-secrets.env
if [ ! -f "$SECRET_FILE" ]; then
  {
    echo "WM_SESSION_SECRET=$(openssl rand -hex 32)"
    echo "RELAY_SHARED_SECRET=$(openssl rand -hex 32)"
  } > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
fi
docker rm -f chile-monitor-prod 2>/dev/null || true
docker run -d --name chile-monitor-prod \
  --restart unless-stopped \
  --add-host host.docker.internal:host-gateway \
  -p 8142:8080 \
  --env-file "$SECRET_FILE" \
  -e LOCAL_API_MODE=docker \
  -e SITE_VARIANT=chile \
  -e UPSTASH_REDIS_REST_URL=http://host.docker.internal:8079 \
  -e UPSTASH_REDIS_REST_TOKEN=chilemonitor-local \
  -e OLLAMA_API_URL=http://host.docker.internal:11435 \
  -e OLLAMA_MODEL=qwen2.5-14b-8k \
  -e WORLDMONITOR_VALID_KEYS=chile-local-dev \
  -v /mnt/data/chile-monitor/public/chile:/usr/share/nginx/html/chile:ro \
  chile-monitor:prod
sleep 6
docker ps --filter name=chile-monitor-prod --format '{{.Status}}'
curl -sf -m 10 http://127.0.0.1:8142/api/sidecar-health && echo " SIDECAR-OK"
curl -sf -m 10 -o /dev/null -w 'HTML %{http_code}\n' http://127.0.0.1:8142/
