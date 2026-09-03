# Chile Monitor

Variante `chile` de [World Monitor](https://github.com/koala73/worldmonitor): pantalla de situación territorial, prensa y Estado para Chile, operada en Enigma (LAN Unholster). Este fork es personal y público; **nunca se pushea a `origin` (upstream)**, solo a `fork`.

El README original del upstream quedó en [docs/README.upstream.md](docs/README.upstream.md).

## Qué agrega la variante

- **Mapa Chile**: expedientes SEIA con color por estado, trazados (transmisión, ductos, áreas de influencia) reconstruidos desde KMZ locales, derechos de agua DGA, tierras y pueblos indígenas CONADI, incendios por comuna. Basemap Mapbox si hay `VITE_MAPBOX_TOKEN`, OpenFreeMap si no.
- **Titulares Chile / Política / Estado / Clima y territorio / Cono Sur**: 50 feeds chilenos generados desde una lista única (`scripts/chile-feeds-gen.py`) vía Google News RSS (`hl=es-419`, porque el proxy de producción no sigue el 302 de `es-CL`).
- **Brief Chile**: brief IA cada 30 min sobre el digest chileno, con Ollama en el Mac vía túnel (`qwen2.5-14b-8k`) y validación de citas y nombres propios en español.
- **Brief territorial**: ingresos SEIA de la semana, cambios de estado (RCA), incendios FIRMS por comuna.
- **Cámaras**: pestaña Chile en cámaras en vivo (6 señales YouTube verificadas) y panel de cámaras por comuna (`public/chile/camaras.json`).
- Español por defecto, tema oscuro por defecto, sin Pro/auth/Discord ni switcher de variantes.

Lo que el upstream trae y la variante **no** usa (patentes, ReviewCase, Convex, AML, Vercel) quedó fuera a propósito.

## Arquitectura en Enigma

| Pieza | Dónde | Cómo se mantiene vivo |
|---|---|---|
| Código y datos | `/mnt/data/chile-monitor` (rama `main` del fork) | `public/chile/` está gitignored: vive en disco |
| Vite dev | `:8141` (proxy `:8140`) | tmux `chile-monitor`, watchdog cron `*/5` |
| Producción | contenedor `chile-monitor-prod`, `:8142` | `restart unless-stopped`, imagen `chile-monitor:prod` |
| KV (compatible Upstash) | Redis docker `:6381` + shim `scripts/upstash-shim.py` `:8079` | tmux `chile-monitor-kv`, watchdog cron `*/5` |
| LLM | Ollama del Mac por túnel inverso launchd → `127.0.0.1:11435` | launchd en el Mac |

## Cron (bloque `# BEGIN chile-monitor` del crontab de `antonio`)

| Cadencia | Qué | Salida |
|---|---|---|
| `*/5` | watchdogs vite y shim KV | tmux |
| `20 */4` | `scripts/chile-sync.sh`: trazados, ficha comunal, brief territorial | `public/chile/*.json`, `logs/chile-sync.log` |
| `7,37 * * * *` | `scripts/chile-seed-insights.sh`: Brief Chile | KV `news:insights:v1` |
| `*/10` | `scripts/seed-earthquakes.mjs` (USGS 4.5+ semana, NRCan) | KV `seismology:earthquakes:v1` → capa `natural` |
| `3 * * * *` | `scripts/seed-natural-events.mjs` (EONET, GDACS, NHC) | KV `natural:events:v1` |
| `23 5 * * *` | `scripts/seed-climate-ocean-ice.mjs` (NOAA) | KV `climate:ocean-ice` |
| `*/15` | `scripts/seed-fire-detections.mjs`, **solo si** `NASA_FIRMS_API_KEY` está en `.env.local` | KV `wildfire:fires` → capa `fires` |
| `*/15` | `scripts/chile-health.py` | `public/chile/health.json`, franja roja en Brief territorial |

Los seeds son los mismos scripts del upstream (allá corren en Railway); acá escriben en el shim. Cargan `.env.local` solos.

## Salud

- `public/chile/health.json` (también en `http://10.0.0.3:8142/chile/health.json`): servicios, frescura de datos propios, edad de los seeds que la variante usa, y **`prod = main`**: compara `/version.json` del contenedor con `fork/main`. Si difiere, hay deploy pendiente.
- `/api/health?compact=1` del upstream evalúa 284 seeds globales. En esta instancia casi todos dan CRIT porque no se siembran: es ruido, no falla. Lo relevante para Chile está en `health.json`.

## Desarrollo

```bash
npm ci
npx cross-env VITE_VARIANT=chile vite --host 0.0.0.0 --port 8141
# typecheck sobre NFS tarda ~20 min: en background
npx tsc --noEmit
```

Variables en `.env.local` (ver `.env.example`): `UPSTASH_REDIS_REST_URL/TOKEN` (shim), `OLLAMA_API_URL/MODEL`, `VITE_MAPBOX_TOKEN` (opcional), `VITE_CHILE_TILES_URL`, `VITE_CHILE_SITE_URL`, `NASA_FIRMS_API_KEY` (opcional).

Gotchas: `scripts/shared/brief-llm-core.js` tiene espejo byte-idéntico en `shared/`; feeds nuevos exigen `PROVIDER_OVERRIDES` + `--write` en `scripts/source-attribution.mjs` o `inventory:facts` falla; el layout de paneles persiste en localStorage (defaults nuevos requieren reset).

## Producción

```bash
# build (5–10 min de contexto sobre NFS: setsid nohup ... &)
bash scripts/chile-build-prod.sh      # embebe el SHA en /version.json
bash scripts/chile-run-prod.sh        # recrea chile-monitor-prod en :8142
python3 scripts/csp_check.py dist/dashboard.html docker/nginx.conf   # hashes CSP de los inline scripts
bash scripts/chile-verify.sh          # matriz de completitud
```

La SPA emitida es `dashboard.html` (nginx `try_files → /dashboard.html`). Si cambia un inline script de `index.html`, hay que recalcular su sha256 en `docker/nginx.conf` y `docker/nginx-security-headers.conf`; `csp_check.py` lo detecta.

## Tests de regresión (subset que cubre lo chileno)

```bash
npx tsc --noEmit
npx tsx --test tests/brief-contract.test.mjs tests/seed-insights-brief.test.mjs tests/brief-llm.test.mjs \
  tests/desktop-one-binary-model.test.mjs tests/webmcp-inventory.test.mts api/bootstrap-auth.test.mjs
node --test api/rss-proxy.test.mjs    # solo: bajo concurrencia da falsos fallos
```

CI del fork: `Test` corre en cada PR y push a `main`. El E2E `dashboard-news-request-budget.spec.ts` (early scroll) es flaky del upstream (issue #25): rerun del job.

## Acceso

Solo LAN por ahora (`http://10.0.0.3:8142/dashboard`, Twingate). El Vercel antiguo devuelve 410. Para exponerlo con HTTPS, la receta ya usada en Enigma es un túnel Cloudflare apuntando a `127.0.0.1:8142`; falta decidir dominio.

## Pendientes conocidos

- Capa `fires`: requiere `NASA_FIRMS_API_KEY` (gratis). El cron ya está y se activa solo.
- Clima: `seed-climate-anomalies` necesita la base `climate:zone-normals`, cuyo fetch excede 240 s desde Enigma; `seed-climate-disasters` exige un appname aprobado por ReliefWeb. Ambos fuera hasta resolverlo.
- Dominio público con HTTPS.
