#!/usr/bin/env python3
"""Chile Monitor continuous pipeline on Enigma.

Loops:
  1. Crawl SEA enviados.php for zip/rar/kmz/kml/7z URLs (resume-safe)
  2. Download new archives
  3. Unpack
  4. Rebuild public/chile/trazados.geojson
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.request
from pathlib import Path
from urllib.parse import unquote, urljoin

ROOT = Path("/mnt/data/chile-monitor")
INBOX = ROOT / "data/kmz-inbox"
INBOX.mkdir(parents=True, exist_ok=True)
STATE = INBOX / "pipeline-state.json"
PARENTS = INBOX / "annex-parents.txt"
GEO_URLS = INBOX / "geo-urls.jsonl"
DL = INBOX / "downloads"
UNP = INBOX / "unpacked"
TRAZADOS = ROOT / "public/chile/trazados.geojson"
UA = "Mozilla/5.0 (compatible; ChileMonitor/1.0; Unholster)"
SEA = "https://seia.sea.gob.cl"
ANNEX = SEA + "/elementosFisicos/enviados.php?id_documento={did}"
BUSCADOR = SEA + "/busqueda/buscarProyecto.php"
ARCHIVO = re.compile(r"""href=["']([^"']*/?archivos/[^"']+)["']""", re.I)
GEO_EXT = {".zip", ".rar", ".7z", ".kmz", ".kml", ".shp"}
GEO_NAME = re.compile(r"kmz|kml|shp|cad|trazado|cartograf|layout|geodat", re.I)


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"parent_idx": 0, "crawled": 0, "found": 0, "downloaded": 0, "cycles": 0}


def save_state(s: dict) -> None:
    STATE.write_text(json.dumps(s, indent=2))


def ensure_parents() -> list[str]:
    if PARENTS.exists() and PARENTS.stat().st_size > 1000:
        return [ln.strip() for ln in PARENTS.read_text().splitlines() if ln.strip()]
    sql = "SELECT DISTINCT doc_id FROM bronze.raw_doc_map WHERE source_csv='doc_map_anexos' ORDER BY 1"
    r = subprocess.run(
        ["docker", "exec", "inteligencia-ambiental-permisos-postgres-1",
         "psql", "-U", "permisos", "-d", "permisos", "-tAc", sql],
        capture_output=True,
    )
    ids = [ln.strip() for ln in r.stdout.decode().splitlines() if ln.strip().isdigit()]
    PARENTS.write_text("\n".join(ids) + "\n")
    print("wrote parents", len(ids))
    return ids


class CookieOpener:
    def __init__(self) -> None:
        self.cj = urllib.request.HTTPCookieProcessor()
        self.opener = urllib.request.build_opener(self.cj)
        req = urllib.request.Request(BUSCADOR, headers={"User-Agent": UA})
        try:
            self.opener.open(req, timeout=30)
        except Exception as e:
            print("cookie warmup", e)

    def get(self, url: str, timeout: int = 45) -> str | None:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with self.opener.open(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            return None


def harvest_batch(opener: CookieOpener, parents: list[str], start: int, n: int) -> tuple[int, int]:
    known = set()
    if GEO_URLS.exists():
        for line in GEO_URLS.read_text().splitlines():
            try:
                known.add(json.loads(line)["url"])
            except Exception:
                pass
    found = 0
    end = min(len(parents), start + n)
    with GEO_URLS.open("a", encoding="utf-8") as out:
        for i, did in enumerate(parents[start:end], start):
            html = opener.get(ANNEX.format(did=did))
            if not html:
                continue
            for href in ARCHIVO.findall(html):
                url = href if href.startswith("http") else urljoin(SEA + "/", href.lstrip("/"))
                name = unquote(url.rsplit("/", 1)[-1]).lower()
                ext = os.path.splitext(name)[1]
                if ext not in GEO_EXT and not GEO_NAME.search(name):
                    continue
                if url in known:
                    continue
                known.add(url)
                rec = {"parent_id": did, "url": url, "ext": ext}
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                found += 1
            if (i + 1) % 50 == 0:
                print(f"  crawl {i+1}/{end} found+{found}")
                out.flush()
    return end, found


def download_new(limit: int = 40) -> int:
    DL.mkdir(exist_ok=True)
    have = {p.name for p in DL.iterdir()}
    n = 0
    if not GEO_URLS.exists():
        return 0
    seen = set()
    for line in GEO_URLS.read_text().splitlines():
        if n >= limit:
            break
        r = json.loads(line)
        url = r["url"]
        if url in seen:
            continue
        seen.add(url)
        fn = unquote(url.rsplit("/", 1)[-1]).replace("/", "_")
        safe = f"{r.get('parent_id','x')}__{fn}"[:180]
        if safe in have:
            continue
        dest = DL / safe
        p = subprocess.run(
            ["curl", "-fsSL", "--retry", "2", "-m", "90", "-A", UA, "-o", str(dest), url],
            capture_output=True,
        )
        if p.returncode == 0 and dest.exists() and dest.stat().st_size > 100:
            n += 1
            print("DL", safe, dest.stat().st_size)
        elif dest.exists():
            dest.unlink()
    return n


def unpack_new() -> int:
    UNP.mkdir(exist_ok=True)
    n = 0
    for f in DL.iterdir():
        ext = f.suffix.lower()
        if ext not in {".zip", ".rar", ".kmz"}:
            continue
        outdir = UNP / f.stem
        if outdir.exists() and any(outdir.iterdir()):
            continue
        outdir.mkdir(exist_ok=True)
        if ext in {".zip", ".kmz"}:
            r = subprocess.run(["unzip", "-o", "-q", str(f), "-d", str(outdir)], capture_output=True)
        else:
            r = subprocess.run(["unrar", "x", "-o+", "-idq", str(f), str(outdir) + "/"], capture_output=True)
        if r.returncode == 0:
            n += 1
    return n


def rebuild_trazados() -> None:
    script = Path("/tmp/kmz-to-geojson.py")
    if script.exists():
        subprocess.run(["python3", str(script)], check=False)


def cycle(batch_parents: int = 200) -> dict:
    st = load_state()
    parents = ensure_parents()
    opener = CookieOpener()
    new_idx, found = harvest_batch(opener, parents, st["parent_idx"], batch_parents)
    st["parent_idx"] = new_idx if new_idx < len(parents) else 0
    st["crawled"] += batch_parents
    st["found"] += found
    dl_n = download_new(40)
    st["downloaded"] += dl_n
    un_n = unpack_new()
    if dl_n or un_n or found:
        rebuild_trazados()
    st["cycles"] += 1
    st["last"] = {
        "found": found,
        "downloaded": dl_n,
        "unpacked": un_n,
        "parent_idx": st["parent_idx"],
        "n_parents": len(parents),
    }
    save_state(st)
    print("cycle", st["last"])
    return st


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", action="store_true")
    ap.add_argument("--batch", type=int, default=150)
    ap.add_argument("--sleep", type=int, default=20)
    args = ap.parse_args()
    if args.loop:
        raise SystemExit("disabled: no SEA crawl. Use scripts/chile-local-trazados.py")
        while True:
            try:
                cycle(args.batch)
            except Exception as e:
                print("cycle error", e)
                time.sleep(30)
            time.sleep(args.sleep)
    else:
        cycle(args.batch)


if __name__ == "__main__":
    main()
