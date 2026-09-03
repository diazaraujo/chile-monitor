#!/usr/bin/env python3
"""Fuente única de feeds Chile → regenera CHILE_FEEDS (src/config/feeds.ts) y el bloque
`chile` de server/worldmonitor/news/v1/_feeds.ts. Todo vía Google News es-CL (mismo host,
sin churn en el manifiesto de proveedores). Idempotente: reemplaza los bloques completos."""
import os, pathlib, re
os.chdir("/mnt/data/chile-monitor")

G = "https://news.google.com/rss/search?q={q}&hl=es-419&gl=CL&ceid=CL:es-419"
def site(dom, when="1d", extra=""): return G.format(q=f"site:{dom}{('+' + extra) if extra else ''}+when:{when}")
def q(query, when="1d"): return G.format(q=f"{query}+when:{when}")

FEEDS = {
    # Titulares Chile — medios nacionales generalistas
    "politics": [
        ("Google News Chile", "https://news.google.com/rss?hl=es-419&gl=CL&ceid=CL:es-419"),
        ("BioBio", site("biobiochile.cl")),
        ("Emol", site("emol.com")),
        ("La Tercera", site("latercera.com")),
        ("Cooperativa", site("cooperativa.cl")),
        ("El Mostrador", site("elmostrador.cl")),
        ("T13", site("t13.cl")),
        ("CNN Chile", site("cnnchile.com")),
        ("24 Horas", site("24horas.cl")),
        ("ADN Radio", site("adnradio.cl")),
        ("Diario Financiero", site("df.cl")),
        ("La Segunda", site("lasegunda.com")),
        ("The Clinic", site("theclinic.cl")),
        ("El Desconcierto", site("eldesconcierto.cl")),
        ("CIPER", site("ciperchile.cl", "7d")),
    ],
    # Política — Congreso, gobierno, análisis
    "us": [
        ("Prensa Chile", q("Chile+(gobierno+OR+congreso+OR+municipal)")),
        ("La Tercera Política", site("latercera.com", "1d", "(política+OR+gobierno)")),
        ("Ex-Ante", site("ex-ante.cl")),
        ("El Líbero", site("ellibero.cl")),
        ("Interferencia", site("interferencia.cl", "3d")),
        ("Radio U. de Chile", site("radio.uchile.cl")),
        ("Senado", site("senado.cl", "3d")),
        ("Cámara de Diputados", site("camara.cl", "3d")),
        ("La Moneda", q("(\"La+Moneda\"+OR+\"Presidente+de+la+República\")+Chile")),
        ("CIPER", site("ciperchile.cl", "7d")),
    ],
    # Estado — organismos y regulación
    "gov": [
        ("SEA / SEIA", q("(SEIA+OR+\"Servicio+de+Evaluación+Ambiental\"+OR+RCA)+Chile", "7d")),
        ("SMA", q("(\"Superintendencia+del+Medio+Ambiente\"+OR+SMA+sanción)+Chile", "7d")),
        ("Tribunales Ambientales", q("\"Tribunal+Ambiental\"+Chile", "7d")),
        ("DGA / agua", q("(DGA+OR+\"derechos+de+agua\"+OR+\"escasez+hídrica\")+Chile", "7d")),
        ("Diario Oficial", site("diariooficial.interior.gob.cl", "7d")),
        ("Contraloría", q("\"Contraloría\"+Chile", "3d")),
        ("Corte Suprema", q("(\"Corte+Suprema\"+OR+\"Poder+Judicial\")+Chile", "1d")),
        ("CMF", q("(CMF+OR+\"Comisión+para+el+Mercado+Financiero\")+Chile", "3d")),
        ("SERNAGEOMIN / minería", q("(SERNAGEOMIN+OR+\"Ministerio+de+Minería\"+OR+Codelco)+Chile", "3d")),
        ("Municipalidades", q("(municipalidad+OR+alcalde+OR+concejo+municipal)+Chile", "1d")),
    ],
    # Clima y territorio
    "climate": [
        ("Clima Chile", q("Chile+(sequía+OR+inundación+OR+glaciar+OR+humedal+OR+CONAF)", "3d")),
        ("Incendios CONAF", q("Chile+(incendio+forestal+OR+CONAF+OR+\"alerta+roja\")")),
        ("SENAPRED", q("(SENAPRED+OR+\"alerta+temprana+preventiva\"+OR+evacuación)+Chile")),
        ("Meteorología", q("(\"Dirección+Meteorológica\"+OR+\"sistema+frontal\"+OR+ola+de+calor)+Chile")),
        ("Ladera Sur", site("laderasur.com", "7d")),
        ("País Circular", site("paiscircular.cl", "7d")),
        ("MMA", site("mma.gob.cl", "7d")),
        ("Pueblos originarios", q("(CONADI+OR+mapuche+OR+\"consulta+indígena\")+Chile", "3d")),
    ],
    # Cono Sur + regiones
    "latam": [
        ("Cono Sur", q("(Chile+OR+Argentina+OR+Perú+OR+Bolivia)")),
        ("Regiones (SoyChile)", site("soychile.cl")),
        ("El Día (Coquimbo)", site("diarioeldia.cl")),
        ("Mercurio de Valparaíso", site("mercuriovalpo.cl")),
        ("El Sur (Concepción)", site("elsur.cl")),
        ("Austral (Temuco/Valdivia)", site("australtemuco.cl")),
        ("El Pingüino (Magallanes)", site("elpinguino.com")),
    ],
}

# ---- cliente: src/config/feeds.ts
p = pathlib.Path("src/config/feeds.ts"); s = p.read_text()
a = s.index("// Chile variant feeds — Chile Monitor")
b = s.index("};", a) + 2
lines = ["// Chile variant feeds — Chile Monitor (generado por scripts/chile-feeds-gen.py; espejo en server/worldmonitor/news/v1/_feeds.ts)",
         "const CHILE_FEEDS: Record<string, Feed[]> = {"]
for cat, feeds in FEEDS.items():
    lines.append(f"  {cat}: [")
    for name, url in feeds:
        lines.append(f"    {{ name: '{name}', url: rss('{url}') }},")
    lines.append("  ],")
lines.append("};")
s = s[:a] + "\n".join(lines) + s[b:]
p.write_text(s); print("client ok", sum(len(v) for v in FEEDS.values()), "feeds")

# ---- servidor
p = pathlib.Path("server/worldmonitor/news/v1/_feeds.ts"); s = p.read_text()
a = s.index("  // Chile Monitor (variante chile)")
b = s.index("  happy: {")
lines = ["  // Chile Monitor (variante chile) — generado por scripts/chile-feeds-gen.py (espejo de CHILE_FEEDS)", "  chile: {"]
for cat, feeds in FEEDS.items():
    lines.append(f"    {cat}: [")
    for name, url in feeds:
        lines.append(f"      {{ name: '{name}', url: '{url}', lang: 'es' }},")
    lines.append("    ],")
lines.append("  },")
s = s[:a] + "\n".join(lines) + "\n" + s[b:]
p.write_text(s); print("server ok")
