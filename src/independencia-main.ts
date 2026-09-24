import { setTrustedHtml, trustedHtml } from "@/utils/dom-utils";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/independencia.css";
import { FALLBACK_DARK_STYLE } from "@/config/basemap";
import {
  COMMUNE_REFRESH_MS,
  COMMUNE_TIMEZONE,
  fetchCommuneSnapshot,
  safeSourceUrl,
  sourceState,
  weatherLabel,
} from "@/services/independencia";
import type { CommuneSnapshot } from "@/types/independencia";
import { escapeHtml } from "@/utils/sanitize";

const e = (value: unknown): string => escapeHtml(String(value ?? ""));
const n = (value: number): string =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
const date = (
  value: string,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const stamp = new Date(value);
  return Number.isFinite(stamp.getTime())
    ? new Intl.DateTimeFormat("es-CL", {
        timeZone: COMMUNE_TIMEZONE,
        ...options,
      }).format(stamp)
    : "Fecha no informada";
};
const clock = (value: string): string =>
  date(value, { hour: "2-digit", minute: "2-digit", hour12: false });
const age = (value: string | null | undefined): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Sin actualización";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  return minutes < 1
    ? "Ahora"
    : minutes < 60
      ? `Hace ${minutes} min`
      : minutes < 1440
        ? `Hace ${Math.floor(minutes / 60)} h`
        : date(value, { day: "numeric", month: "short" });
};
const icon = (name: string): string => {
  const paths: Record<string, string> = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    signal: '<path d="M4 19v-4m5 4V9m5 10V5m5 14V2"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    refresh: '<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    news: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/>',
    shield:
      '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    camera:
      '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    truck:
      '<path d="M3 6h11v11H3ZM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    drop: '<path d="M12 2S5 11 5 15a7 7 0 0 0 14 0c0-4-7-13-7-13Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
};

const root = document.querySelector<HTMLDivElement>("#independencia-app")!;
// All remote text passes through e(); remote links pass through safeSourceUrl().
setTrustedHtml(
  root,
  trustedHtml(
    `
  <aside class="rail" aria-label="Navegación">
    <a class="brand-mark" href="/dashboard" aria-label="Chile Monitor">CM<span></span></a>
    <button class="rail-button selected" data-mode="morning" aria-label="Esta mañana" title="Esta mañana">${icon("grid")}</button>
    <button class="rail-button" data-mode="dispatch" aria-label="Centro de despacho" title="Centro de despacho">${icon("map")}</button>
    <button class="rail-button" data-action="sources" aria-label="Fuentes y conexiones" title="Fuentes y conexiones">${icon("signal")}</button>
    <div class="rail-bottom"><span class="rail-line"></span><span class="rail-cut">13108</span></div>
  </aside>
  <div class="workspace">
    <header class="topbar">
      <div class="breadcrumb"><a href="/dashboard">CHILE MONITOR</a><span>/</span><strong>COMUNAS</strong></div>
      <div class="topbar-right"><span class="public-label"><i></i> FUENTES PÚBLICAS</span><time id="wall-clock"></time><button class="icon-button" data-action="fullscreen" title="Pantalla completa" aria-label="Pantalla completa">${icon("expand")}</button></div>
    </header>
    <main>
      <section class="page-heading">
        <div><div class="eyebrow">REGIÓN METROPOLITANA <span>·</span> CUT 13108</div><h1>Independencia<span class="heading-dot">.</span> <span class="heading-light">en línea</span></h1><p id="day-heading">Una mirada compartida de la comuna.</p></div>
        <div class="heading-actions"><div class="mode-switch" role="group" aria-label="Modo de visualización"><button class="active" data-mode="morning" aria-pressed="true">${icon("sun")}Esta mañana</button><button data-mode="dispatch" aria-pressed="false">${icon("map")}Despacho</button></div><button class="refresh-button" data-action="refresh">${icon("refresh")}<span>Actualizar</span></button></div>
      </section>
      <div id="connection-banner" class="connection-banner" role="status">Conectando las fuentes de Independencia…</div>
      <section class="metric-grid" id="metrics" aria-label="Panorama comunal"></section>
      <section class="briefing" id="briefing" aria-label="Resumen de la mañana"></section>
      <section class="operations-grid">
        <article class="map-panel panel">
          <div class="panel-heading"><div><span class="eyebrow">TERRITORIO</span><h2>La comuna, en perspectiva</h2></div><span class="small-tag">MAPA INTERACTIVO</span></div>
          <div class="map-toolbar"><button class="layer-button active" data-layer="boundary" aria-pressed="true"><span class="legend-dot boundary"></span>Límite de referencia</button><button class="layer-button active" data-layer="projects" aria-pressed="true"><span class="legend-dot projects"></span>Proyectos SEIA <b id="project-count">—</b></button><button class="map-home" data-action="recenter">${icon("pin")}Centrar comuna</button></div>
          <div class="map-stage"><div id="commune-map" aria-label="Mapa de Independencia"></div><div class="map-caption"><span class="map-caption-line"></span><div><strong>INDEPENDENCIA</strong><span>Contexto territorial · no representa incidentes</span></div></div><div id="map-message" class="map-message" role="status">Cargando cartografía…</div></div>
          <div class="map-footer"><span id="cartography-credit">Cartografía de referencia · coordenadas geográficas</span><span id="project-date">SEIA · contexto acumulado</span></div>
        </article>
        <aside class="news-panel panel"><div class="panel-heading"><div><span class="eyebrow">PULSO LOCAL</span><h2>Lo que está pasando</h2></div>${icon("news")}</div><p class="panel-intro">Publicaciones de la municipalidad. No equivalen a incidentes activos.</p><div id="news-list" class="news-list"></div><div class="panel-bottom"><a href="https://www.independencia.cl/" target="_blank" rel="noopener noreferrer">Ir al sitio municipal ${icon("arrow")}</a><span id="news-updated">Sin consulta</span></div></aside>
      </section>
      <section class="bottom-grid">
        <article class="panel weather-panel"><div class="panel-heading"><div><span class="eyebrow">PRÓXIMAS HORAS</span><h2>Clima para planificar</h2></div>${icon("sun")}</div><div id="weather-detail"></div></article>
        <article class="panel dispatch-panel"><div class="panel-heading"><div><span class="eyebrow">CENTRO DE DESPACHO</span><h2>Capacidad operativa</h2></div><span class="small-tag amber">POR CONECTAR</span></div><div class="dispatch-systems">
          <div>${icon("shield")}<span><strong>Incidentes 1469</strong><small>Sin acceso al registro municipal</small></span><b>—</b></div>
          <div>${icon("truck")}<span><strong>Móviles en terreno</strong><small>Ubicación y disponibilidad pendientes</small></span><b>—</b></div>
          <div>${icon("camera")}<span><strong>Cámaras municipales</strong><small>Sin acceso a las señales autorizadas</small></span><b>—</b></div>
          <div>${icon("drop")}<span><strong>Servicios y cortes</strong><small>Agua, energía y aseo por integrar</small></span><b>—</b></div>
        </div><button class="text-button" data-action="sources">Ver qué falta para operar en vivo ${icon("arrow")}</button></article>
        <article class="panel territory-panel"><div class="panel-heading"><div><span class="eyebrow">CONTEXTO COMUNAL</span><h2>Proyectos y territorio</h2></div>${icon("pin")}</div><div id="territory-detail"></div></article>
      </section>
      <footer class="page-footer"><span><i class="status-dot"></i> Independencia en línea <span class="footer-separator">/</span> Chile Monitor</span><button data-action="sources" id="source-footer">Consultar fuentes y cobertura ${icon("arrow")}</button></footer>
    </main>
  </div>
  <dialog id="sources-dialog" aria-labelledby="sources-title"><div class="dialog-heading"><div><span class="eyebrow">TRAZABILIDAD</span><h2 id="sources-title">Qué estamos viendo</h2></div><button class="icon-button" data-action="close-sources" aria-label="Cerrar fuentes">${icon("close")}</button></div><div id="source-details"></div><div class="integration-note"><h3>Para conectar el despacho municipal</h3><p>Hace falta una integración autorizada con el 1469, la flota, las cámaras y los servicios. Cada evento debe incluir fecha de origen, estado, ubicación y responsable. Esta pantalla no envía instrucciones a equipos ni confirma emergencias.</p><p>Los datos ausentes se muestran como «por conectar»; nunca como cero incidentes.</p></div></dialog>
`,
    "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
  ),
);

let snapshot: CommuneSnapshot | undefined;
let refreshing = false;
let requestFailed = false;
let mode: "morning" | "dispatch" =
  new URLSearchParams(location.search).get("modo") === "despacho"
    ? "dispatch"
    : "morning";
let map: maplibregl.Map | undefined;
let mapReady = false;
let boundaryBounds: maplibregl.LngLatBounds | undefined;
let boundaryVisible = true;
let projectsVisible = true;
let controller: AbortController | undefined;
const q = <T extends HTMLElement = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;
const badge = (state: string): string =>
  `<span class="source-state ${e(state)}">${state === "fresh" ? "AL DÍA" : state === "stale" ? "DESACTUALIZADO" : "SIN DATOS"}</span>`;

function render(): void {
  const sources = snapshot?.sources;
  const w = sources?.weather.data;
  const news = sources?.municipal.data ?? [];
  const t = sources?.territory.data;
  const ws = sourceState(sources?.weather, 90);
  const ns = sourceState(sources?.municipal, 90);
  const ts = sourceState(sources?.territory, 8 * 60);
  const fresh = [ws, ns, ts].filter((s) => s === "fresh").length;
  const recent = news.filter((item) => {
    const elapsed = Date.now() - Date.parse(item.publishedAt);
    return elapsed >= 0 && elapsed < 86_400_000;
  });
  q("#connection-banner").classList.toggle(
    "warning",
    requestFailed || fresh < 3,
  );
  setTrustedHtml(
    q("#connection-banner"),
    trustedHtml(
      `${icon(requestFailed || fresh < 3 ? "signal" : "check")}<span>${requestFailed ? "No se pudo actualizar. Se conserva la última información recibida." : snapshot ? `${fresh} de 3 fuentes públicas al día. La información operativa municipal aún no está conectada.` : "Esperando datos públicos. No hay información operativa municipal conectada."}</span><button data-action="sources">Ver cobertura ${icon("arrow")}</button>`,
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  setTrustedHtml(
    q("#metrics"),
    trustedHtml(
      `
    <article class="metric"><div class="metric-label">CLIMA LOCAL ${icon("sun")}</div><div class="metric-value">${w ? n(w.temperature) : "—"}<span>${w ? "°C" : ""}</span></div><div class="metric-foot"><span>${w ? e(weatherLabel(w.code)) : "Esperando pronóstico"}</span>${badge(ws)}</div></article>
    <article class="metric"><div class="metric-label">PUBLICACIONES · 24 H ${icon("news")}</div><div class="metric-value">${sources?.municipal.data ? recent.length : "—"}<span>municipales</span></div><div class="metric-foot"><span>Ventana móvil de 24 horas</span>${badge(ns)}</div></article>
    <article class="metric"><div class="metric-label">EXPEDIENTES SEIA ${icon("pin")}</div><div class="metric-value">${t ? n(t.expedientes) : "—"}<span>en el corpus</span></div><div class="metric-foot"><span>Acumulado · no obras activas</span>${badge(ts)}</div></article>
    <article class="metric metric-coverage"><div class="metric-label">COBERTURA OPERATIVA ${icon("signal")}</div><div class="metric-value">4<span>conexiones pendientes</span></div><div class="metric-foot"><span>1469 · móviles · cámaras · servicios</span><span class="coverage-dot"></span></div></article>`,
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  const weatherBrief =
    ws !== "fresh" || !w
      ? "Actualizar el pronóstico antes de planificar actividades en terreno."
      : w.rainProbability >= 60
        ? `Lluvia prevista: ${n(w.rainProbability)}% de probabilidad. Revisar actividades al aire libre con el equipo.`
        : `Entre ${n(w.min)}° y ${n(w.max)}° hoy; ${n(w.rainProbability)}% de probabilidad de lluvia.`;
  setTrustedHtml(
    q("#briefing"),
    trustedHtml(
      `<div class="briefing-label"><span class="eyebrow">LECTURA DE 30 SEGUNDOS</span><h2>Antes de empezar<br>el día.</h2><span class="briefing-stamp">${snapshot ? `Corte de datos · ${clock(snapshot.generatedAt)}` : "Esperando actualización"}</span></div><div class="briefing-item"><span class="brief-number">01</span><div><h3>Preparar el terreno</h3><p>${e(weatherBrief)}</p></div></div><div class="briefing-item"><span class="brief-number">02</span><div><h3>Tomar el pulso local</h3><p>${ns === "fresh" ? `${recent.length} publicaciones municipales en las últimas 24 horas. ${recent.length ? "Revisar su alcance con el equipo." : "El historial reciente está disponible abajo."}` : "La fuente municipal requiere actualización; revisar el sitio de origen."}</p></div></div><div class="briefing-item"><span class="brief-number">03</span><div><h3>Confirmar con despacho</h3><p>Solicitar el parte de turno: incidentes abiertos, equipos disponibles y cortes. Aún no llegan a esta pantalla.</p></div></div>`,
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  setTrustedHtml(
    q("#news-list"),
    trustedHtml(
      news.length
        ? news
            .slice(0, 5)
            .map(
              (item, i) =>
                `<a class="news-item" href="${e(safeSourceUrl(item.url))}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span>${i === 0 ? "ÚLTIMA PUBLICACIÓN" : "MUNICIPALIDAD"}</span><time datetime="${e(item.publishedAt)}">${e(date(item.publishedAt, { day: "numeric", month: "short" }))}</time></div><h3>${e(item.title)}</h3><span class="news-link">Leer en la fuente ${icon("arrow")}</span></a>`,
            )
            .join("")
        : '<div class="empty-state">Todavía no hay publicaciones disponibles.<span>La conexión se vuelve a intentar automáticamente.</span></div>',
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  q("#news-updated").textContent = age(sources?.municipal.fetchedAt);
  setTrustedHtml(
    q("#weather-detail"),
    trustedHtml(
      w
        ? `<div class="weather-today"><strong>${n(w.temperature)}°</strong><div><span>${e(weatherLabel(w.code))}</span><small>Sensación de ${n(w.apparentTemperature)}° · mín ${n(w.min)}° / máx ${n(w.max)}°</small></div></div><div class="hour-strip">${w.hourly
            .slice(0, 6)
            .map(
              (h) =>
                `<div><span>${clock(h.time)}</span>${icon(h.rainProbability >= 50 ? "drop" : "sun")}<strong>${n(h.temperature)}°</strong><small>${n(h.rainProbability)}%</small></div>`,
            )
            .join(
              "",
            )}</div><div class="weather-stats"><span>Viento <b>${n(w.wind)} km/h</b></span><span>Lluvia <b>${n(w.precipitation)} mm</b></span><span>UV máx. <b>${n(w.uv)}</b></span></div><p class="source-note">Modelo Open-Meteo · ${e(age(sources?.weather.observedAt))} · ${badge(ws)}<br>Pronóstico, no alerta oficial. Porcentajes: probabilidad de lluvia.</p>`
        : '<div class="empty-state">Pronóstico no disponible.<span>Se conservará la última lectura cuando exista.</span></div>',
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  setTrustedHtml(
    q("#territory-detail"),
    trustedHtml(
      t
        ? `<div class="territory-stats"><div><strong>${n(t.expedientes)}</strong><span>expedientes</span></div><div><strong>${n(t.observations)}</strong><span>observaciones</span></div><div><strong>${n(t.participation)}</strong><span>con observaciones</span></div></div><p class="territory-description">Registros de Independencia en el corpus de Inteligencia Ambiental. Cobertura parcial; no es el total oficial de obras ni su estado en terreno.</p>${
            t.facts.length
              ? `<div class="territory-facts">${t.facts
                  .slice(0, 2)
                  .map(
                    (f) =>
                      `<a href="${e(safeSourceUrl(f.url))}" target="_blank" rel="noopener noreferrer">${e(f.title)} ${icon("arrow")}</a>`,
                  )
                  .join("")}</div>`
              : '<div class="territory-empty">Sin hechos comunales en el último brief territorial. Esto no confirma ausencia de actividad.</div>'
          }<p class="source-note">SEIA · ${e(age(sources?.territory.observedAt))} · ${badge(ts)}</p>`
        : '<div class="empty-state">Ficha comunal no disponible.<span>Se conecta al corpus territorial de Chile Monitor.</span></div>',
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  q("#project-count").textContent = String(t?.projects.length ?? "—");
  q("#project-date").textContent = t?.projectsObservedAt
    ? `Puntos SEIA · ${age(t.projectsObservedAt)}`
    : "Puntos SEIA · sin fecha de actualización";
  const descriptions = [
    {
      title: "Clima local",
      source: sources?.weather,
      state: ws,
      scope:
        "Modelo para un punto de Independencia. Consulta cada 10 minutos; se muestra la hora del dato meteorológico.",
    },
    {
      title: "Publicaciones municipales",
      source: sources?.municipal,
      state: ns,
      scope:
        "RSS oficial, títulos y enlaces. Una noticia no es un incidente activo ni una instrucción de despacho.",
    },
    {
      title: "Contexto SEIA",
      source: sources?.territory,
      state: ts,
      scope:
        "Corpus acumulado filtrado por CUT 13108. Actualización territorial cada 4 horas. Cobertura parcial.",
    },
  ];
  setTrustedHtml(
    q("#source-details"),
    trustedHtml(
      descriptions
        .map(
          (d) =>
            `<article class="source-card"><div><h3>${d.title}</h3>${badge(d.state)}</div><p>${e(d.scope)}</p><small>Última consulta: ${e(d.source?.fetchedAt ? date(d.source.fetchedAt, { dateStyle: "medium", timeStyle: "short" }) : "Sin consulta exitosa")}</small>${d.source?.url ? `<a href="${e(safeSourceUrl(d.source.url))}" target="_blank" rel="noopener noreferrer">Abrir fuente ${icon("arrow")}</a>` : ""}</article>`,
        )
        .join(""),
      "Static municipal markup; source text is escaped with e(), URLs are protocol-validated, and numeric values pass the snapshot contract.",
    ),
  );
  updateMapProjects();
}

function updateMapProjects(): void {
  if (!mapReady || !map) return;
  const source = map.getSource("commune-projects") as
    | maplibregl.GeoJSONSource
    | undefined;
  source?.setData({
    type: "FeatureCollection",
    features: (snapshot?.sources.territory.data?.projects ?? []).map(
      (p, id) => ({
        type: "Feature",
        id,
        geometry: { type: "Point", coordinates: p.coordinates },
        properties: { name: p.name, status: p.status },
      }),
    ),
  });
}

function initMap(): void {
  try {
    maplibregl.setWorkerUrl(mapWorkerUrl);
    map = new maplibregl.Map({
      container: "commune-map",
      style: FALLBACK_DARK_STYLE,
      center: [-70.665, -33.416],
      zoom: 13.3,
      attributionControl: { compact: true },
      maxZoom: 18,
      minZoom: 10,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }),
      "bottom-right",
    );
    map.on("error", () => {
      q("#map-message").textContent =
        "Parte de la cartografía no está disponible. Las fuentes siguen visibles.";
      q("#map-message").hidden = false;
    });
    map.on("load", async () => {
      if (!map) return;
      mapReady = true;
      q("#map-message").hidden = true;
      map.addSource("commune-projects", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "commune-projects-halo",
        type: "circle",
        source: "commune-projects",
        paint: {
          "circle-radius": 12,
          "circle-color": "#ecb86a",
          "circle-opacity": 0.14,
        },
      });
      map.addLayer({
        id: "commune-projects-points",
        type: "circle",
        source: "commune-projects",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ecb86a",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#26302f",
        },
      });
      for (const id of ["commune-projects-halo", "commune-projects-points"])
        map.setLayoutProperty(
          id,
          "visibility",
          projectsVisible ? "visible" : "none",
        );
      updateMapProjects();
      map.on("click", "commune-projects-points", (event) => {
        const feature = event.features?.[0];
        if (!feature || !map) return;
        const content = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = String(feature.properties.name);
        const detail = document.createElement("p");
        detail.textContent = `${feature.properties.status} · Registro SEIA; no indica actividad actual en terreno.`;
        content.append(title, detail);
        new maplibregl.Popup({ maxWidth: "290px" })
          .setLngLat(event.lngLat)
          .setDOMContent(content)
          .addTo(map);
      });
      try {
        const response = await fetch("/independencia/limite.geojson");
        if (!response.ok) throw new Error("boundary unavailable");
        const boundary = await response.json();
        if (
          !Array.isArray(boundary.features) ||
          boundary.features.length !== 1 ||
          boundary.features[0]?.properties?.cut !== "13108"
        )
          throw new Error("boundary mismatch");
        map.addSource("commune-boundary", { type: "geojson", data: boundary });
        const geometry = boundary.features[0].geometry;
        const positions: number[][] =
          geometry.type === "Polygon"
            ? geometry.coordinates.flat()
            : geometry.coordinates.flat(2);
        boundaryBounds = new maplibregl.LngLatBounds();
        for (const position of positions)
          if (position.length >= 2)
            boundaryBounds.extend([position[0]!, position[1]!]);
        map.fitBounds(boundaryBounds, { padding: 40, duration: 0 });
        map.addLayer(
          {
            id: "commune-boundary-fill",
            type: "fill",
            source: "commune-boundary",
            paint: { "fill-color": "#82d6c1", "fill-opacity": 0.055 },
          },
          "commune-projects-halo",
        );
        map.addLayer({
          id: "commune-boundary-line",
          type: "line",
          source: "commune-boundary",
          paint: {
            "line-color": "#82d6c1",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });
        for (const id of ["commune-boundary-fill", "commune-boundary-line"])
          map.setLayoutProperty(
            id,
            "visibility",
            boundaryVisible ? "visible" : "none",
          );
        q("#cartography-credit").textContent = String(
          boundary.features[0].properties.credit || "Límite de referencia",
        );
      } catch {
        q("#cartography-credit").textContent =
          "Límite comunal no disponible · mapa de contexto";
        q<HTMLButtonElement>('[data-layer="boundary"]').disabled = true;
      }
    });
  } catch (error) {
    console.warn("[Independencia] Map startup failed", error);
    q("#map-message").textContent =
      "Este equipo no pudo iniciar el mapa. El resto del monitor permanece disponible.";
  }
}

function setMode(next: typeof mode): void {
  mode = next;
  document.body.classList.toggle("dispatch-mode", next === "dispatch");
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  const url = new URL(location.href);
  if (mode === "dispatch") url.searchParams.set("modo", "despacho");
  else url.searchParams.delete("modo");
  history.replaceState(null, "", url);
  requestAnimationFrame(() => {
    map?.resize();
    if (boundaryBounds)
      map?.fitBounds(boundaryBounds, { padding: 40, duration: 0 });
  });
}

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  const button = q<HTMLButtonElement>('[data-action="refresh"]');
  button.disabled = true;
  button.classList.add("refreshing");
  controller = new AbortController();
  const timeout = window.setTimeout(() => controller?.abort(), 15_000);
  try {
    snapshot = await fetchCommuneSnapshot(controller.signal);
    requestFailed = false;
  } catch {
    requestFailed = true;
  } finally {
    clearTimeout(timeout);
    refreshing = false;
    button.disabled = false;
    button.classList.remove("refreshing");
    render();
  }
}

function tick(): void {
  const now = new Date().toISOString();
  q("#wall-clock").textContent = clock(now);
  q("#wall-clock").setAttribute("datetime", now);
  q("#day-heading").textContent =
    `${date(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Hora de Santiago`;
}

root.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!button) return;
  if (button.dataset.mode === "morning" || button.dataset.mode === "dispatch")
    setMode(button.dataset.mode);
  const action = button.dataset.action;
  if (action === "refresh") void refresh();
  if (action === "sources") q<HTMLDialogElement>("#sources-dialog").showModal();
  if (action === "close-sources")
    q<HTMLDialogElement>("#sources-dialog").close();
  if (action === "recenter") {
    if (boundaryBounds)
      map?.fitBounds(boundaryBounds, { padding: 40, duration: 500 });
    else map?.flyTo({ center: [-70.665, -33.416], zoom: 13.3, duration: 700 });
  }
  if (action === "fullscreen") {
    const task = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void task.catch(() => {
      q("#connection-banner").textContent =
        "El navegador no permite pantalla completa. Puedes ampliar la ventana manualmente.";
    });
  }
  if (button.dataset.layer) {
    const boundary = button.dataset.layer === "boundary";
    if (boundary) boundaryVisible = !boundaryVisible;
    else projectsVisible = !projectsVisible;
    const visible = boundary ? boundaryVisible : projectsVisible;
    button.classList.toggle("active", visible);
    button.setAttribute("aria-pressed", String(visible));
    for (const id of boundary
      ? ["commune-boundary-fill", "commune-boundary-line"]
      : ["commune-projects-halo", "commune-projects-points"]) {
      if (map?.getLayer(id))
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
});

tick();
render();
setMode(mode);
initMap();
void refresh();
const clockTimer = window.setInterval(tick, 15_000);
const refreshTimer = window.setInterval(() => {
  if (!document.hidden) void refresh();
}, COMMUNE_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    tick();
    void refresh();
  }
});
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(clockTimer);
    clearInterval(refreshTimer);
    controller?.abort();
    map?.remove();
  },
  { once: true },
);
