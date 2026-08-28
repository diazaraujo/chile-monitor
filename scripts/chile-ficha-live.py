#!/usr/bin/env python3
"""Dump ficha comunal from live IA Postgres. Does not certify completeness.

Chile Monitor re-reads seia.expediente / observacion / expediente_especie
as those pipelines fill. No SEA HTTP.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

OUT = Path("/mnt/data/chile-monitor/public/chile/ficha-comuna.json")
ALIASES = {
    "paihuano": "paiguano",
    "marchigue": "marchihue",
    "o higgins": "ohiggins",
    "o'higgins": "ohiggins",
}

Q_EXP = r"""
SELECT coalesce(nullif(trim(comuna), ''), 'sin-comuna') AS comuna,
       coalesce(nullif(trim(region), ''), '') AS region,
       count(*) AS n_exp,
       coalesce(sum(coalesce(n_observaciones, 0)), 0) AS n_obs,
       count(*) FILTER (WHERE coalesce(n_observaciones, 0) > 0) AS n_exp_pac
  FROM seia.expediente
 GROUP BY 1, 2
 ORDER BY 3 DESC;
"""
Q_ESP = r"""
SELECT coalesce(nullif(trim(e.comuna), ''), 'sin-comuna') AS comuna,
       count(*) AS n_especie,
       count(DISTINCT es.especie) AS n_especie_distinta
  FROM seia.expediente_especie es
  JOIN seia.expediente e ON e.id = es.expediente_id
 GROUP BY 1;
"""
Q_PAC_REG = r"""
SELECT coalesce(nullif(trim(region), ''), 'sin-region') AS region,
       count(*) AS n_obs,
       count(DISTINCT expediente_id) AS n_exp_pac
  FROM seia.observacion
 WHERE texto IS NOT NULL AND btrim(texto) <> ''
 GROUP BY 1
 ORDER BY 2 DESC;
"""


def psql(q: str) -> str:
    r = subprocess.run(
        [
            "docker", "exec", "inteligencia-ambiental-permisos-postgres-1",
            "psql", "-U", "permisos", "-d", "permisos", "-A", "-F", "\t", "-t", "-c", q,
        ],
        capture_output=True,
    )
    if r.returncode:
        raise SystemExit(r.stderr.decode()[-2000:])
    return r.stdout.decode()


def key(name: str) -> str:
    return name.strip().lower()


def main() -> None:
    by: dict[str, dict] = {}
    print("expediente.comuna...")
    for line in psql(Q_EXP).splitlines():
        if not line.strip():
            continue
        com, reg, n_exp, n_obs, n_pac = line.split("\t")
        by[key(com)] = {
            "comuna": com,
            "region": reg,
            "n_exp": int(n_exp),
            "n_obs": int(float(n_obs)),
            "n_exp_pac": int(n_pac),
            "n_especie": 0,
            "n_especie_distinta": 0,
        }
    print("especies...")
    for line in psql(Q_ESP).splitlines():
        if not line.strip():
            continue
        com, n, nd = line.split("\t")
        row = by.setdefault(key(com), {"comuna": com, "n_exp": 0, "n_obs": 0, "n_exp_pac": 0})
        row["n_especie"] = int(n)
        row["n_especie_distinta"] = int(nd)
    print("PAC regional (observacion.texto)...")
    pac_region = {}
    for line in psql(Q_PAC_REG).splitlines():
        if not line.strip():
            continue
        reg, n_obs, n_exp = line.split("\t")
        pac_region[reg] = {"n_obs": int(n_obs), "n_exp_pac": int(n_exp)}
    for v in by.values():
        pr = pac_region.get(v.get("region") or "", {})
        v["region_n_obs"] = pr.get("n_obs", 0)
        v["region_n_exp_pac"] = pr.get("n_exp_pac", 0)
    for dest, src in ALIASES.items():
        if dest not in by and src in by:
            by[dest] = dict(by[src])
    comunas_path = Path("/mnt/data/chile-monitor/public/chile/comunas.geojson")
    if comunas_path.exists():
        import json as _json
        fc = _json.loads(comunas_path.read_text())
        mapped = 0
        def fold(s):
            return (s.lower().replace("á","a").replace("é","e").replace("í","i")
                    .replace("ó","o").replace("ú","u").replace("ñ","n"))
        folded = {fold(k): v for k, v in by.items()}
        for feat in fc.get("features") or []:
            pr = feat.get("properties") or {}
            cut = str(pr.get("cut") or "").strip()
            name = str(pr.get("name") or "").strip()
            if not cut:
                continue
            row = by.get(name.lower()) or folded.get(fold(name))
            if row:
                by[cut] = dict(row)
                by[cut.lstrip("0") or cut] = dict(row)
                mapped += 1
        print("cut mapped", mapped)
    tmp = OUT.with_suffix(".json.tmp")
    payload = {
        "source": "seia.expediente live",
        "by_comuna": by,
        "pac_region": pac_region,
    }
    tmp.write_text(json.dumps(payload, ensure_ascii=False))
    tmp.replace(OUT)
    top = sorted(by.values(), key=lambda r: -r.get("n_exp", 0))[:6]
    print("comunas", len(by), "bytes", OUT.stat().st_size)
    print("top", [(r["comuna"], r["n_exp"], r["n_obs"]) for r in top])


if __name__ == "__main__":
    main()
