#!/usr/bin/env python3
"""Brief territorial de Chile Monitor (punto 2): cruza los datos propios de la semana
→ public/chile/brief-territorial.json con resumen en español por Ollama (Mac, túnel :11435).

Fuentes (últimos N días):
  - SEIA ingresos, calificaciones (RCA) ......... Postgres IA (docker psql), sin red al SEA
  - Tribunales ambientales, conflictos .......... Postgres IA
  - Incendios activos por comuna ................ NASA FIRMS CSV público (VIIRS SNPP, 7d) × comunas.geojson (shapely)
  - DAA constituidos ............................ SIN fuente estructurada en disco (derechos_agua.csv no trae fechas) → se declara

ponytail: cada hecho lleva su [n]; el resumen solo puede citar esos n. Si el LLM falla,
se publica igual con `resumen` vacío (los hechos ya son el brief).
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import subprocess
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path("/mnt/data/chile-monitor")
OUT = ROOT / "public/chile/brief-territorial.json"
COMUNAS = ROOT / "public/chile/comunas.geojson"
FICHA = ROOT / "public/chile/ficha-comuna.json"
PG = ["docker", "exec", "inteligencia-ambiental-permisos-postgres-1", "psql", "-U", "permisos", "-d", "permisos",
      "-A", "-F", "\t", "-t", "-c"]
DIAS = int(os.environ.get("TERRITORIAL_DIAS", "7"))
OLLAMA = os.environ.get("OLLAMA_API_URL", "http://127.0.0.1:11435")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-14b-8k")
TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT_MS", "105000")) / 1000
FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_7d.csv"
CHILE_BBOX = (-76.5, -56.5, -66.0, -17.3)  # lon_min, lat_min, lon_max, lat_max (continental)
SNAPSHOT = ROOT / "data/seia-estado-snapshot.json"  # {id: estado} de la corrida anterior → transiciones = RCA de la semana
SEIA_URL = "https://seia.sea.gob.cl/expediente/expedientesEvaluacion.php?id_expediente={id}"


def rows(sql: str) -> list[list[str]]:
    r = subprocess.run(PG + [sql], capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise SystemExit(f"psql: {r.stderr.strip()}")
    return [l.split("\t") for l in r.stdout.splitlines() if l.strip()]


def num(s: str) -> float:
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def incendios(dias: int) -> dict:
    """FIRMS VIIRS 7d → puntos en Chile → conteo por comuna. Devuelve {} si falla la red."""
    try:
        with urllib.request.urlopen(FIRMS_URL, timeout=90) as resp:
            text = resp.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"FIRMS no disponible: {e}", file=sys.stderr)
        return {}
    try:
        from shapely.geometry import Point, shape
        from shapely.strtree import STRtree
    except ImportError as e:
        # ponytail: sin shapely el brief sale igual, solo sin incendios (correr con .venv-gis para tenerlos)
        print(f"shapely no disponible ({e}): brief sin incendios", file=sys.stderr)
        return {}

    desde = (date.today() - timedelta(days=dias)).isoformat()
    x0, y0, x1, y1 = CHILE_BBOX
    pts, meta = [], []
    for r in csv.DictReader(io.StringIO(text)):
        lat, lon = num(r["latitude"]), num(r["longitude"])
        if not (x0 <= lon <= x1 and y0 <= lat <= y1) or r["acq_date"] < desde:
            continue
        pts.append(Point(lon, lat)); meta.append(r)
    geo = json.load(open(COMUNAS))
    polys = [shape(f["geometry"]) for f in geo["features"]]
    names = [f["properties"].get("name", "?") for f in geo["features"]]
    tree = STRtree(polys)
    por_comuna: dict[str, dict] = defaultdict(lambda: {"n": 0, "alta": 0, "frp": 0.0, "ultimo": ""})
    en_chile = 0
    for p, r in zip(pts, meta):
        for i in tree.query(p, predicate="within"):
            c = por_comuna[names[i]]
            c["n"] += 1
            c["alta"] += 1 if r.get("confidence") == "h" else 0
            c["frp"] += num(r.get("frp"))
            c["ultimo"] = max(c["ultimo"], r["acq_date"])
            en_chile += 1
            break
    ficha = {}
    try:
        ficha = json.load(open(FICHA)).get("by_comuna", {})
    except Exception:  # noqa: BLE001
        pass
    top = sorted(por_comuna.items(), key=lambda kv: (-kv[1]["n"], -kv[1]["frp"]))[:8]
    return {
        "fuente": "NASA FIRMS VIIRS SNPP (CSV público, 7 días)",
        "detecciones": en_chile,
        "comunasAfectadas": len(por_comuna),
        "top": [{"comuna": k, "region": (ficha.get(k.lower()) or {}).get("region", ""), "n": v["n"],
                 "altaConfianza": v["alta"], "frpMw": round(v["frp"], 1), "ultimo": v["ultimo"]} for k, v in top],
    }


def main() -> int:
    d = DIAS
    kpi = rows(f"""SELECT count(*), coalesce(sum(capex_musd),0),
                          count(*) FILTER (WHERE tipo_evaluacion::text='EIA'),
                          count(DISTINCT region)
                     FROM seia.expediente WHERE fecha_presentacion >= current_date - {d}""")[0]
    ingresos = rows(f"""SELECT id, nombre_proyecto, coalesce(region,''), tipo_evaluacion::text,
                               coalesce(capex_musd,0), coalesce(titular,''), coalesce(comuna,''), fecha_presentacion
                          FROM seia.expediente WHERE fecha_presentacion >= current_date - {d}
                         ORDER BY capex_musd DESC NULLS LAST LIMIT 8""")
    # fecha_calificacion viene NULL en toda la base (campo muerto) → RCA de la semana = transiciones de
    # `estado` respecto del snapshot de la corrida anterior (ponytail: JSON plano, sin tabla nueva).
    actual = {r[0]: r[1] for r in rows("SELECT id, estado::text FROM seia.expediente")}
    previo = {}
    try:
        previo = json.load(open(SNAPSHOT))
    except Exception:  # noqa: BLE001
        pass
    cambios = {i: e for i, e in actual.items() if i in previo and previo[i] != e and e in ("Aprobado", "Rechazado", "No Admitido a Tramitación", "Desistido")}
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(actual))
    calif_agg: dict[str, dict] = defaultdict(lambda: {"n": 0, "capex": 0.0})
    calif_top: list[list[str]] = []
    if cambios:
        ids = ",".join("'" + i.replace("'", "") + "'" for i in list(cambios)[:400])
        for r in rows(f"""SELECT id, nombre_proyecto, coalesce(region,''), estado::text, coalesce(capex_musd,0),
                                 coalesce(titular,''), current_date::text, coalesce(rca_numero,'')
                            FROM seia.expediente WHERE id IN ({ids}) ORDER BY capex_musd DESC NULLS LAST"""):
            calif_agg[r[3]]["n"] += 1; calif_agg[r[3]]["capex"] += num(r[4])
            if len(calif_top) < 6:
                calif_top.append(r)
    calif = [[e, str(v["n"]), str(v["capex"])] for e, v in sorted(calif_agg.items(), key=lambda kv: -kv[1]["n"])]
    trib = rows(f"""SELECT tribunal, fecha, left(materia, 160), coalesce(resultado,'')
                      FROM seia.tribunal_ruling WHERE fecha >= current_date - {d} ORDER BY fecha DESC LIMIT 5""")
    confl = rows(f"""SELECT proyecto, coalesce(titular,''), coalesce(inversion_musd,0), coalesce(tipo,''), coalesce(estado,''), fecha
                       FROM seia.conflicto_seia WHERE fecha >= current_date - {d} ORDER BY fecha DESC LIMIT 5""")
    regiones = rows(f"""SELECT coalesce(region,'s/r'), count(*), coalesce(sum(capex_musd),0)
                          FROM seia.expediente WHERE fecha_presentacion >= current_date - {d}
                         GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 6""")
    fuego = incendios(d)

    hechos: list[dict] = []
    for r in ingresos:
        hechos.append({"tipo": "ingreso", "id": r[0], "proyecto": r[1], "region": r[2], "via": r[3],
                       "capex_musd": num(r[4]), "titular": r[5], "comuna": r[6], "fecha": r[7], "url": SEIA_URL.format(id=r[0])})
    for r in calif_top:
        hechos.append({"tipo": "calificacion", "id": r[0], "proyecto": r[1], "region": r[2], "estado": r[3],
                       "capex_musd": num(r[4]), "titular": r[5], "fecha": r[6], "rca": r[7], "url": SEIA_URL.format(id=r[0])})
    for r in trib:
        hechos.append({"tipo": "tribunal", "tribunal": r[0], "fecha": r[1], "materia": r[2], "resultado": r[3]})
    for r in confl:
        hechos.append({"tipo": "conflicto", "proyecto": r[0], "titular": r[1], "capex_musd": num(r[2]),
                       "clase": r[3], "estado": r[4], "fecha": r[5]})
    for c in (fuego.get("top") or [])[:5]:
        hechos.append({"tipo": "incendio", "comuna": c["comuna"], "region": c["region"], "n": 0,
                       "detecciones": c["n"], "altaConfianza": c["altaConfianza"], "frpMw": c["frpMw"], "fecha": c["ultimo"]})
    for i, h in enumerate(hechos, 1):
        h["n"] = i

    def linea(h: dict) -> str:
        t = h["tipo"]
        if t == "ingreso":
            return f"{h['n']}. INGRESO SEIA ({h['via']}, {h['fecha']}): \"{h['proyecto']}\" — titular {h['titular']}, {h['region']}, {h['comuna']}, inversión USD {h['capex_musd']:.0f} MM"
        if t == "calificacion":
            return f"{h['n']}. CALIFICACIÓN ({h['estado']}{', RCA ' + h['rca'] if h.get('rca') else ''}, {h['fecha']}): \"{h['proyecto']}\" — {h['titular']}, {h['region']}, USD {h['capex_musd']:.0f} MM"
        if t == "tribunal":
            return f"{h['n']}. TRIBUNAL AMBIENTAL ({h['tribunal']}, {h['fecha']}): {h['materia']} — resultado: {h['resultado'] or 's/d'}"
        if t == "incendio":
            return f"{h['n']}. INCENDIOS (FIRMS, hasta {h['fecha']}): comuna {h['comuna']} ({h['region'] or 's/r'}) con {h['detecciones']} focos activos detectados por satélite en {d} días ({h['altaConfianza']} de alta confianza)"
        return f"{h['n']}. CONFLICTO ({h['clase']}, {h['estado']}, {h['fecha']}): \"{h['proyecto']}\" — {h['titular']}, USD {h['capex_musd']:.0f} MM"

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "periodoDias": d,
        "desde": (date.today() - timedelta(days=d)).isoformat(),
        "kpis": {"ingresos": int(kpi[0]), "capexMusd": round(num(kpi[1]), 1), "eia": int(kpi[2]), "regiones": int(kpi[3]),
                 "calificaciones": [{"estado": c[0], "n": int(c[1]), "capexMusd": round(num(c[2]), 1)} for c in calif],
                 "calificacionesNota": "transiciones de estado desde la corrida anterior (fecha_calificacion no está poblada en la base)" if not previo else "",
                 "focosIncendio": fuego.get("detecciones", None), "comunasConFuego": fuego.get("comunasAfectadas", None)},
        "regiones": [{"region": r[0], "n": int(r[1]), "capexMusd": round(num(r[2]), 1)} for r in regiones],
        "incendios": fuego,
        "daa": {"disponible": False,
                "nota": "DAA constituidos en la semana: sin fuente estructurada en disco (derechos_agua.csv no trae fecha de constitución). Pendiente scraper DGA/Diario Oficial."},
        "hechos": hechos,
        "resumen": "",
        "modelo": "",
    }

    if hechos:
        system = ("Eres analista territorial de Chile. Redacta un BRIEF en español (Chile), 3-5 oraciones, menos de 130 palabras, "
                  "sobre los hechos numerados. Usa SOLO lo que dicen los hechos; no agregues nombres, cifras ni contexto que no estén ahí. "
                  "Cita cada afirmación con el número entre corchetes del hecho, p. ej. [2] o [1][4]. "
                  "Copia nombres propios exactamente como aparecen. Sin saludos ni títulos. Responde solo el texto.")
        user = (f"Periodo: últimos {d} días. Totales: {payload['kpis']['ingresos']} ingresos al SEIA por USD {payload['kpis']['capexMusd']:.0f} MM "
                f"({payload['kpis']['eia']} EIA), {payload['kpis']['regiones']} regiones"
                + (f"; {fuego['detecciones']} focos de incendio satelitales en {fuego['comunasAfectadas']} comunas" if fuego else "")
                + ".\n\nHechos:\n" + "\n".join(linea(h) for h in hechos))
        body = json.dumps({"model": MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                           "max_tokens": 450, "temperature": 0.2}).encode()
        try:
            req = urllib.request.Request(f"{OLLAMA}/v1/chat/completions", data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                out = json.load(resp)
            texto = out["choices"][0]["message"]["content"].strip()
            citas = {int(c) for c in re.findall(r"\[(\d{1,2})\]", texto)}
            if texto and citas and citas <= {h["n"] for h in hechos}:
                payload["resumen"] = texto
                payload["modelo"] = out.get("model", MODEL)
            else:
                print(f"resumen rechazado (citas={sorted(citas)}): {texto[:120]!r}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"ollama falló: {e}", file=sys.stderr)

    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    tmp.replace(OUT)
    print(f"{OUT.name}: {len(hechos)} hechos, {payload['kpis']['ingresos']} ingresos, "
          f"focos={fuego.get('detecciones', 'n/d')}, resumen={'sí' if payload['resumen'] else 'NO'} ({payload['modelo']})")
    return 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        assert num("1.5") == 1.5 and num("x") == 0.0 and num(None) == 0.0
        print("selfcheck ok"); sys.exit(0)
    sys.exit(main())
