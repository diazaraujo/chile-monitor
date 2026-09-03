#!/usr/bin/env python3
"""Chile Monitor · monitor de integridad/frescura (cron */15).
Escribe public/chile/health.json; el panel Brief territorial pinta franja roja si status != ok.
ponytail: sin push a Slack — la alerta vive en el dashboard; webhook = decisión de Antonio.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Los datos (public/chile, .env.local, .prod-secrets.env) viven acá aunque el código corra desde otro checkout.
ROOT = Path("/mnt/data/chile-monitor")
OUT = ROOT / "public/chile/health.json"
TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "chilemonitor-local")
KV = "http://127.0.0.1:8079"
NOW = datetime.now(timezone.utc)
checks: list[dict] = []


def add(name: str, ok: bool, detail: str) -> None:
    checks.append({"name": name, "ok": ok, "detail": detail})


def http(name: str, url: str, headers: dict | None = None) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read()
            add(name, r.status == 200, f"HTTP {r.status}")
            return body
    except Exception as e:  # noqa: BLE001
        add(name, False, str(e)[:60])
        return None


def kv_get(key: str):
    req = urllib.request.Request(f"{KV}/get/{key}", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)["result"]


def hours_since_iso(iso: str) -> float:
    ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (NOW - ts).total_seconds() / 3600


def fmt_age(name: str, h: float, max_h: float, extra: str = "") -> None:
    add(name, h < max_h, f"{h:.1f}h{extra}" + ("" if h < max_h else f" > {max_h}h"))


def age_file(name: str, path: Path, max_h: float, iso_field: str | None = None) -> None:
    if not path.exists():
        add(name, False, "no existe")
        return
    try:
        if iso_field:
            h = hours_since_iso(json.load(open(path))[iso_field])
        else:
            h = (NOW.timestamp() - path.stat().st_mtime) / 3600
        fmt_age(name, h, max_h)
    except Exception as e:  # noqa: BLE001
        add(name, False, str(e)[:60])


def age_kv(name: str, meta_key: str, max_h: float) -> None:
    """Edad de un seed del upstream (seed-meta:<dominio>:<recurso>, fetchedAt en ms)."""
    try:
        res = kv_get(meta_key)
        if not res:
            add(name, False, "sin seed")
            return
        m = json.loads(res)
        h = (NOW.timestamp() - m["fetchedAt"] / 1000) / 3600
        fmt_age(name, h, max_h, f" · {m.get('recordCount', '?')} reg")
    except Exception as e:  # noqa: BLE001
        add(name, False, str(e)[:60])


def env_has(key: str) -> bool:
    try:
        return any(l.startswith(f"{key}=") and len(l.strip()) > len(key) + 1
                   for l in (ROOT / ".env.local").read_text().splitlines())
    except OSError:
        return False


# --- servicios ---
http("vite :8141", "http://127.0.0.1:8141/")
http("proxy :8140", "http://127.0.0.1:8140/")
http("prod :8142", "http://127.0.0.1:8142/")
http("shim KV :8079", f"{KV}/get/probe", {"Authorization": f"Bearer {TOKEN}"})
http("túnel Ollama Mac :11435", "http://127.0.0.1:11435/api/tags")

# --- SHA desplegado en prod vs main del fork (deploy verificable) ---
try:
    subprocess.run(["git", "-C", str(ROOT), "fetch", "-q", "fork", "main"], timeout=25, check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    main_sha = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "fork/main"],
                              capture_output=True, text=True, timeout=10).stdout.strip()
    with urllib.request.urlopen("http://127.0.0.1:8142/version.json", timeout=10) as r:
        v = json.load(r)
    same = bool(main_sha) and v.get("sha") == main_sha
    add("prod = main", same, str(v.get("sha", "?"))[:8] + ("" if same else f" ≠ main {main_sha[:8]} (deploy pendiente)"))
except Exception as e:  # noqa: BLE001
    add("prod = main", False, str(e)[:60])

# --- datos propios ---
age_file("brief territorial", ROOT / "public/chile/brief-territorial.json", 6, "generatedAt")
age_file("ficha comunal", ROOT / "public/chile/ficha-comuna.json", 8)
age_file("trazados SEIA", ROOT / "public/chile/trazados.geojson", 8)

# brief IA (Redis vía shim; cron cada 30 min, margen 4 h)
try:
    d = json.loads(kv_get("news:insights:v1"))
    d = d.get("data", d)
    fmt_age("brief IA (insights)", hours_since_iso(d["generatedAt"]), 4)
except Exception as e:  # noqa: BLE001
    add("brief IA (insights)", False, str(e)[:60])

# --- seeds del upstream que la variante chile sí usa (crontab, bloque chile-monitor) ---
age_kv("sismos USGS (capa natural)", "seed-meta:seismology:earthquakes", 1)
age_kv("eventos naturales EONET/GDACS", "seed-meta:natural:events", 9)
age_kv("clima hielo/océano NOAA", "seed-meta:climate:ocean-ice", 48)
if env_has("NASA_FIRMS_API_KEY"):
    age_kv("incendios FIRMS (capa fires)", "seed-meta:wildfire:fires", 6)

status = "ok" if all(c["ok"] for c in checks) else "degradado"
tmp = OUT.with_suffix(".json.tmp")
tmp.write_text(json.dumps({"status": status, "checkedAt": NOW.isoformat(timespec="seconds"),
                           "checks": checks}, ensure_ascii=False, indent=1))
tmp.replace(OUT)
fallas = ", ".join(c["name"] for c in checks if not c["ok"]) or "-"
print(f"{NOW.isoformat(timespec='seconds')} status={status} fallas={fallas}")
sys.exit(0 if status == "ok" else 1)
