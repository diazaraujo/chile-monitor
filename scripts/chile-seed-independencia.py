#!/usr/bin/env python3
"""Public-source snapshot for Independencia. No fabricated dispatch telemetry.

Atomic output; failures preserve the last successful source with its original
timestamps. Run every ten minutes with flock. No external Python dependencies.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import email.utils
import html
import json
import math
import os
import re
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

CUT = '13108'
RSS = 'https://www.independencia.cl/feed/'
WEATHER = 'https://api.open-meteo.com/v1/forecast'
UA = 'ChileMonitor/1.0 (Independencia public-source dashboard)'


def iso(timestamp=None):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if timestamp is not None else datetime.now(timezone.utc).isoformat()


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError('response exceeds limit')
        return raw


def finite(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError('missing numeric observation')
    return value


def weather():
    query = urllib.parse.urlencode({
        'latitude': -33.416, 'longitude': -70.666, 'timezone': 'America/Santiago',
        'timeformat': 'unixtime', 'forecast_days': 2,
        'current': 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
        'hourly': 'temperature_2m,precipitation_probability',
        'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max',
    })
    d = json.loads(get(WEATHER + '?' + query))
    c, daily, hourly = d['current'], d['daily'], d['hourly']
    observed = finite(c['time'])
    hours = [
        {'time': iso(t), 'temperature': finite(hourly['temperature_2m'][i]), 'rainProbability': finite(hourly['precipitation_probability'][i])}
        for i, t in enumerate(hourly['time']) if t >= observed - 3600
    ][:12]
    return {'status': 'ok', 'fetchedAt': iso(), 'observedAt': iso(observed), 'url': 'https://open-meteo.com/', 'data': {
        'temperature': finite(c['temperature_2m']), 'apparentTemperature': finite(c['apparent_temperature']),
        'wind': finite(c['wind_speed_10m']), 'code': finite(c['weather_code']),
        'min': finite(daily['temperature_2m_min'][0]), 'max': finite(daily['temperature_2m_max'][0]),
        'rainProbability': finite(daily['precipitation_probability_max'][0]),
        'precipitation': finite(daily['precipitation_sum'][0]), 'uv': finite(daily['uv_index_max'][0]), 'hourly': hours,
    }}


def municipal():
    root = ET.fromstring(get(RSS))
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('not an RSS channel')
    items = []
    for item in root.findall('./channel/item')[:10]:
        url = item.findtext('link', '')
        if urllib.parse.urlparse(url).hostname not in ('www.independencia.cl', 'independencia.cl'):
            continue
        stamp = email.utils.parsedate_to_datetime(item.findtext('pubDate', '')).astimezone(timezone.utc).isoformat()
        title = html.unescape(re.sub('<[^>]+>', '', item.findtext('title', ''))).strip()
        if title:
            items.append({'title': title, 'url': url, 'publishedAt': stamp})
    return {'status': 'ok', 'fetchedAt': iso(), 'url': RSS, 'data': items}


def matches_commune(value):
    # Exact token match: do not turn a street/project name into a commune match.
    return any(token.strip().casefold() == 'independencia' for token in re.split(r'[,;|/]', str(value)))


def territory(data_dir):
    path = data_dir / 'ficha-comuna.json'
    d = json.loads(path.read_text())
    by = d['by_comuna']
    record = by.get(CUT) or by.get('independencia')
    if not record or not matches_commune(record.get('comuna', '')):
        raise ValueError('commune absent from territory source')
    facts = []
    brief = data_dir / 'brief-territorial.json'
    if brief.exists():
        b = json.loads(brief.read_text())
        for h in b.get('hechos', []):
            if matches_commune(h.get('comuna', '')):
                facts.append({'title': h.get('proyecto') or h.get('materia') or h.get('tipo', ''),
                              'date': h.get('fecha', ''), 'type': h.get('tipo', ''), 'url': h.get('url', '')})
    projects = []
    points = data_dir / 'seia-puntos.geojson'
    if points.exists():
        for f in json.loads(points.read_text()).get('features', []):
            p, g = f.get('properties', {}), f.get('geometry') or {}
            coordinates = g.get('coordinates', [])
            if matches_commune(p.get('comunas', '')) and g.get('type') == 'Point' and len(coordinates) >= 2:
                lon, lat = coordinates[:2]
                # Reject bad/mislocated points, not geocode them by guessing.
                if isinstance(lon, (float, int)) and isinstance(lat, (float, int)) and -70.71 < lon < -70.63 and -33.46 < lat < -33.37:
                    projects.append({'name': str(p.get('nombre', 'Proyecto SEIA')), 'status': str(p.get('estado', 'Sin estado')), 'coordinates': [lon, lat]})
    return {'status': 'ok', 'fetchedAt': iso(), 'observedAt': iso(path.stat().st_mtime),
            'url': 'https://seia.sea.gob.cl/', 'data': {
                'expedientes': finite(record['n_exp']), 'observations': finite(record['n_obs']),
                'participation': finite(record['n_exp_pac']), 'facts': facts[:12], 'projects': projects[:150],
                'projectsObservedAt': iso(points.stat().st_mtime) if points.exists() else None,
            }}


def municipios(data_dir):
    data = json.loads((data_dir / 'municipios-13108.json').read_text())
    if data.get('cut') != CUT or data.get('schemaVersion') != 1 or not isinstance(data.get('sections'), list):
        raise ValueError('invalid Monitor Municipios commune snapshot')
    stamp = datetime.fromisoformat(data['exportedAt'].replace('Z', '+00:00'))
    if stamp.tzinfo is None or stamp.timestamp() > datetime.now(timezone.utc).timestamp() + 300:
        raise ValueError('invalid export timestamp')
    return {'status': 'ok', 'fetchedAt': data['exportedAt'], 'observedAt': data['exportedAt'],
            'url': 'https://monitor-municipios.vercel.app/es/comuna/13108', 'data': data}


def collect_source(key, loader, previous):
    try:
        return loader()
    except Exception as exc:
        old = previous.get('sources', {}).get(key, {})
        # Keep the old successful timestamps. A failed refresh is not fresh data.
        return {**old, 'status': 'error', 'fetchedAt': old.get('fetchedAt'),
                'url': old.get('url', ''), 'data': old.get('data'), 'error': type(exc).__name__}


def write_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as out:
            json.dump(value, out, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'public/chile')
    args = parser.parse_args()
    output = args.data_dir / 'independencia.json'
    try:
        previous = json.loads(output.read_text())
        if not isinstance(previous, dict) or previous.get('commune', {}).get('cut') != CUT:
            previous = {}
    except (OSError, ValueError):
        previous = {}
    loaders = {'weather': weather, 'municipal': municipal, 'territory': lambda: territory(args.data_dir), 'municipios': lambda: municipios(args.data_dir)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {k: pool.submit(collect_source, k, loader, previous) for k, loader in loaders.items()}
        sources = {k: f.result() for k, f in futures.items()}
    snapshot = {'schemaVersion': 1, 'commune': {'cut': CUT, 'name': 'Independencia'}, 'generatedAt': iso(), 'sources': sources}
    write_atomic(output, snapshot)
    print(json.dumps({'generatedAt': snapshot['generatedAt'], 'sources': {k: v['status'] for k, v in sources.items()}}))
    return 0 if all(s['status'] == 'ok' for s in sources.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
