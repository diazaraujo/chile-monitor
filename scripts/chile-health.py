#!/usr/bin/env python3
"""Chile Monitor · monitor de integridad/frescura (cron */15).
Escribe public/chile/health.json; el panel Brief territorial pinta franja roja si status != ok.
ponytail: sin push a Slack — la alerta vive en el dashboard; webhook = decisión de Antonio.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/mnt/data/chile-monitor")
OUT = ROOT / "public/chile/health.json"
TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "chilemonitor-local")
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


def hours_since_iso(iso: str) -> float:
    ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (NOW - ts).total_seconds() / 3600


def age_file(name: str, path: Path, max_h: float, iso_field: str | None = None) -> None:
    if not path.exists():
        add(name, False, "no existe")
        return
    try:
        if iso_field:
            h = hours_since_iso(json.load(open(path))[iso_field])
        else:
            h = (NOW.timestamp() - path.stat().st_mtime) / 3600
        add(name, h < max_h, f"{h:.1f}h" + ("" if h < max_h else f" > {max_h}h"))
    except Exception as e:  # noqa: BLE001
        add(name, False, str(e)[:60])


http("vite :8141", "http://127.0.0.1:8141/")
http("proxy :8140", "http://127.0.0.1:8140/")
http("shim KV :8079", "http://127.0.0.1:8079/get/probe", {"Authorization": f"Bearer {TOKEN}"})
http("túnel Ollama Mac :11435", "http://127.0.0.1:11435/api/tags")
age_file("brief territorial", ROOT / "public/chile/brief-territorial.json", 6, "generatedAt")
age_file("ficha comunal", ROOT / "public/chile/ficha-comuna.json", 8)
age_file("trazados SEIA", ROOT / "public/chile/trazados.geojson", 8)

# brief IA (Redis vía shim; cron cada 30 min, margen 2 h)
body = None
try:
    req = urllib.request.Request("http://127.0.0.1:8079/get/news:insights:v1",
                                 headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        body = json.load(r)
    d = json.loads(body["result"])
    d = d.get("data", d)
    h = hours_since_iso(d["generatedAt"])
    add("brief IA (insights)", h < 4, f"{h:.1f}h" + ("" if h < 4 else " > 4h"))
except Exception as e:  # noqa: BLE001
    add("brief IA (insights)", False, str(e)[:60])

status = "ok" if all(c["ok"] for c in checks) else "degradado"
tmp = OUT.with_suffix(".json.tmp")
tmp.write_text(json.dumps({"status": status, "checkedAt": NOW.isoformat(timespec="seconds"),
                           "checks": checks}, ensure_ascii=False, indent=1))
tmp.replace(OUT)
fallas = ", ".join(c["name"] for c in checks if not c["ok"]) or "-"
print(f"{NOW.isoformat(timespec='seconds')} status={status} fallas={fallas}")
sys.exit(0 if status == "ok" else 1)
