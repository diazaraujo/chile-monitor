#!/usr/bin/env python3
"""Unpack zip/rar/kmz already on disk and rebuild public/chile/trazados.geojson.

NO network. Sources:
  - kmz-inbox/downloads (Chile Monitor harvest already on disk)
  - ia-permisos-data/sources/sea-pdfs/scraped (IA download_seia_expediente)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path("/mnt/data/chile-monitor")
INBOX = ROOT / "data/kmz-inbox"
DL = INBOX / "downloads"
UNP = INBOX / "unpacked"
UNP_IA = INBOX / "unpacked-ia-scraped"
SCRAPED = Path("/mnt/data/ia-permisos-data/sources/sea-pdfs/scraped")
TRAZADOS = ROOT / "public/chile/trazados.geojson"
GEO_NAME = re.compile(
    r"kmz|kml|trazad|cartograf|layout|geodat|planos|hidro|cuenca_visual|shape|\\bshp\\b",
    re.I,
)
KML_NS = "http://www.opengis.net/kml/2.2"
SKIP_KMZ = {"KMZ EIA Digua_adenda2.kmz"}
CAP = 150
MAX_KML = 8_000_000


def _coords(s: str | None) -> list[list[float]]:
    pts = []
    for tok in (s or "").replace("\n", " ").split():
        parts = tok.split(",")
        if len(parts) < 2:
            continue
        try:
            pts.append([float(parts[0]), float(parts[1])])
        except ValueError:
            continue
    return pts


def parse_kml(raw: str, src: str, expediente_id: str | None) -> list[dict]:
    raw = raw.replace("<kml ", '<kml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ', 1)
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    feats = []
    for pm in root.iter(f"{{{KML_NS}}}Placemark"):
        name = (pm.findtext(f"{{{KML_NS}}}name") or "").strip() or Path(src).stem
        geom = None
        pt = pm.find(f".//{{{KML_NS}}}Point/{{{KML_NS}}}coordinates")
        ls = pm.find(f".//{{{KML_NS}}}LineString/{{{KML_NS}}}coordinates")
        poly = pm.find(f".//{{{KML_NS}}}Polygon//{{{KML_NS}}}coordinates")
        if pt is not None:
            pts = _coords(pt.text)
            if pts:
                geom = {"type": "Point", "coordinates": pts[0]}
        elif ls is not None:
            pts = _coords(ls.text)
            if len(pts) >= 2:
                if len(pts) > 300:
                    step = max(1, len(pts) // 300)
                    pts = pts[::step]
                geom = {"type": "LineString", "coordinates": pts}
        elif poly is not None:
            pts = _coords(poly.text)
            if len(pts) >= 4:
                if len(pts) > 400:
                    step = max(1, len(pts) // 400)
                    pts = pts[::step] + [pts[-1]]
                geom = {"type": "Polygon", "coordinates": [pts]}
        if not geom:
            continue
        props = {"name": name, "source": os.path.basename(src)}
        if expediente_id:
            props["expediente_id"] = expediente_id
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    return feats


def exp_from_path(path: Path) -> str | None:
    for p in path.parts:
        if p.isdigit() and len(p) >= 6:
            return p
    stem = path.stem
    if "__" in stem:
        head = stem.split("__", 1)[0]
        if head.isdigit():
            return head
    return None


def unpack_one(src: Path, dest: Path) -> bool:
    dest.mkdir(parents=True, exist_ok=True)
    if any(dest.iterdir()):
        return False
    ext = src.suffix.lower()
    if ext in {".zip", ".kmz"}:
        r = subprocess.run(["unzip", "-o", "-q", str(src), "-d", str(dest)], capture_output=True)
    elif ext == ".rar":
        r = subprocess.run(["unrar", "x", "-o+", "-idq", str(src), str(dest) + "/"], capture_output=True)
    else:
        return False
    return r.returncode == 0


def unpack_inbox() -> int:
    UNP.mkdir(parents=True, exist_ok=True)
    n = 0
    if not DL.exists():
        return 0
    for f in DL.iterdir():
        if f.suffix.lower() not in {".zip", ".rar", ".kmz"}:
            continue
        outdir = UNP / f.stem
        if unpack_one(f, outdir):
            n += 1
            print("unpack inbox", f.name, flush=True)
    return n


def unpack_scraped(limit: int = 400) -> int:
    """Only geo-named zip/rar already on IA disk."""
    UNP_IA.mkdir(parents=True, exist_ok=True)
    n = 0
    if not SCRAPED.exists():
        return 0
    for exp_dir in SCRAPED.iterdir():
        if n >= limit:
            break
        if not exp_dir.is_dir():
            continue
        for f in exp_dir.iterdir():
            if n >= limit:
                break
            if not f.is_file():
                continue
            ext = f.suffix.lower()
            if ext not in {".zip", ".rar", ".kmz"}:
                continue
            if not GEO_NAME.search(f.name):
                continue
            dest = UNP_IA / exp_dir.name / f.stem
            if dest.exists() and any(dest.iterdir()):
                continue
            if unpack_one(f, dest):
                n += 1
                print("unpack ia", exp_dir.name, f.name, flush=True)
    return n


def collect_from(root: Path) -> tuple[list[dict], int, int]:
    feats: list[dict] = []
    n_kmz = skipped = 0
    if not root.exists():
        return feats, 0, 0
    for dp, _dns, fns in os.walk(root):
        exp = exp_from_path(Path(dp))
        for fn in fns:
            low = fn.lower()
            if fn.startswith("._") or fn in SKIP_KMZ:
                continue
            path = Path(dp) / fn
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if low.endswith(".kml"):
                if size > MAX_KML:
                    skipped += 1
                    continue
                n_kmz += 1
                try:
                    raw = path.read_text(encoding="utf-8", errors="replace")
                    feats.extend(parse_kml(raw, str(path), exp)[:CAP])
                except Exception as e:
                    print("fail kml", fn, e, flush=True)
                continue
            if not low.endswith(".kmz"):
                continue
            if size > MAX_KML:
                skipped += 1
                continue
            n_kmz += 1
            try:
                with zipfile.ZipFile(path) as z:
                    kmls = [n for n in z.namelist() if n.lower().endswith(".kml")]
                    if not kmls:
                        continue
                    raw = z.read(kmls[0]).decode("utf-8", "replace")
                feats.extend(parse_kml(raw, str(path), exp)[:CAP])
            except Exception as e:
                print("fail kmz", fn, e, flush=True)
    return feats, n_kmz, skipped


def rebuild(skip_inbox: bool = True) -> None:
    # Inbox walk is huge and already baked into trazados.geojson.
    if skip_inbox and TRAZADOS.exists() and TRAZADOS.stat().st_size > 1000:
        import json as _json
        prev = _json.loads(TRAZADOS.read_text())
        a = list(prev.get("features") or [])
        n1 = s1 = 0
        print("reuse existing trazados", len(a), flush=True)
    else:
        a, n1, s1 = collect_from(UNP)
    b, n2, s2 = collect_from(UNP_IA)
    seen = set()
    allf = []
    for f in a + b:
        src = (f.get("properties") or {}).get("source")
        name = (f.get("properties") or {}).get("name")
        g = f.get("geometry") or {}
        key = (src, name, g.get("type"), str(g.get("coordinates"))[:80])
        if key in seen:
            continue
        seen.add(key)
        allf.append(f)
    TRAZADOS.parent.mkdir(parents=True, exist_ok=True)
    tmp = TRAZADOS.with_suffix(".geojson.tmp")
    tmp.write_text(json.dumps({"type": "FeatureCollection", "features": allf}, ensure_ascii=False))
    tmp.replace(TRAZADOS)
    print(
        "trazados",
        "inbox_kmz", n1, "ia_kmz", n2,
        "skipped_big", s1 + s2,
        "features", len(allf),
        "bytes", TRAZADOS.stat().st_size,
        Counter(f["geometry"]["type"] for f in allf if f.get("geometry")),
        flush=True,
    )


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--scraped-limit", type=int, default=400)
    ap.add_argument("--skip-unpack", action="store_true")
    args = ap.parse_args()
    if not args.skip_unpack:
        print("unpack inbox", unpack_inbox(), flush=True)
        print("unpack scraped", unpack_scraped(args.scraped_limit), flush=True)
    rebuild(skip_inbox=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
