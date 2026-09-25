import { COMMUNE_ISSUES, RESEARCH_DATE } from "@/config/independencia/issues";
import type { CommuneSnapshot } from "@/types/independencia";
import { safeSourceUrl, sourceState } from "@/services/independencia";
import { escapeHtml } from "@/utils/sanitize";
import { setTrustedHtml, trustedHtml } from "@/utils/dom-utils";
const e = (v: unknown) => escapeHtml(String(v ?? ""));
const put = (id: string, content: string) => {
  const el = document.getElementById(id);
  if (el)
    setTrustedHtml(
      el,
      trustedHtml(
        content,
        "Reviewed research and escaped snapshot text; external URLs protocol validated.",
      ),
    );
};
const services = [
  [
    "aseo",
    "01",
    "Basura y limpieza",
    "Rutas, microbasurales y retiro",
    "Falta registro de reclamos y retiros del día.",
  ],
  [
    "vialidad",
    "02",
    "Veredas y baches",
    "Recorridos seguros y accesibles",
    "Falta registro de baches, inspección y reparación.",
  ],
  [
    "riesgo_invernal",
    "03",
    "Luminarias y cortes",
    "Alumbrado, electricidad y agua",
    "Sin estado de luminarias ni feed de cortes en vivo.",
  ],
  [
    "comercio",
    "04",
    "Ruidos y convivencia",
    "Fiscalización del espacio común",
    "Sin mediciones de ruido ni denuncias recientes integradas.",
  ],
  [
    "comercio",
    "05",
    "Calles y comercio",
    "Accesos a hospitales y barrios",
    "Intervenciones publicadas; falta verificación en terreno.",
  ],
  [
    "medicamentos",
    "06",
    "Salud y cuidados",
    "Farmacia y atención a vecinos",
    "Sin stock de farmacia ni tiempos de espera actuales.",
  ],
] as const;
let filter = "todos";
let current: CommuneSnapshot | undefined;
let selected: string | undefined;
let serviceIndex: number | undefined;
function detail(): void {
  const item = COMMUNE_ISSUES.find((x) => x.id === selected);
  if (!item) return;
  const service =
    serviceIndex === undefined ? undefined : services[serviceIndex];
  put(
    "issue-detail",
    `<div class="issue-detail-hero"><span class="eyebrow">${e(service ? "VIDA COTIDIANA" : "AGENDA COMUNAL")} · INVESTIGACIÓN ${RESEARCH_DATE}</span><h2 id="issue-title">${e(service?.[2] ?? item.problema)}</h2><p>${e(service?.[4] ?? item.limites)}</p></div><div class="issue-detail-grid"><section><span class="eyebrow">EVIDENCIA DISPONIBLE</span><h3>${e(item.problema)}</h3><ul>${item.evidencia.map((x) => `<li>${e(x)}</li>`).join("")}</ul><p class="source-note">Corte de investigación: 25 sep. 2026. Compras consultadas hasta agosto de 2026. Los antecedentes no confirman una incidencia activa.</p><a href="${e(safeSourceUrl(item.enlace.url))}" target="_blank" rel="noopener noreferrer">${e(item.enlace.titulo)} ↗</a><button class="text-button" data-issue-dimension="${e(item.dimension)}">Consultar registros de Monitor Municipios ↗</button></section><section><span class="eyebrow">PREGUNTA PARA EL EQUIPO</span><h3>${e(item.pregunta_de_gestion)}</h3><p>${e(item.limites)}</p><span class="eyebrow">MONITORES PARA EL CRUCE</span><div class="issue-monitor-list">${item.monitores.map((x) => `<span>${e(x)}</span>`).join("")}</div><p class="source-note">Ruta de cruce propuesta. La presencia de un monitor no acredita una conexión operativa en vivo.</p><span class="eyebrow">VÍNCULOS A VERIFICAR</span><p>${item.llaves.map(e).join(" · ")}</p></section></div>`,
  );
}
function cards(): void {
  const shown = COMMUNE_ISSUES.filter(
    (x) => filter === "todos" || x.grupo === filter,
  );
  put(
    "issue-cards",
    shown
      .map(
        (x) =>
          `<button class="issue-card" data-issue="${x.id}"><span class="issue-card-top"><span>${x.grupo === "calle" ? "CALLE Y SERVICIOS" : x.grupo === "cuidados" ? "PERSONAS Y CUIDADOS" : "GESTIÓN Y CONTROL"}</span><span>↗</span></span><h3>${e(x.problema)}</h3><strong>${e(x.cifra)}</strong><span class="issue-period">${e(x.periodo)}</span><p>${e(x.pregunta_de_gestion)}</p><span class="issue-card-bottom">${x.monitores.length} monitores relacionados <span>Ver evidencia →</span></span></button>`,
      )
      .join(""),
  );
  document
    .querySelectorAll<HTMLElement>("[data-issue-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.issueFilter === filter)),
    );
  const count = document.getElementById("issue-count");
  if (count)
    count.textContent = `${shown.length} temas · investigación 25 sep. 2026`;
}
export function renderIssues(snapshot?: CommuneSnapshot): void {
  current = snapshot;
  cards();
  put(
    "everyday-services",
    services
      .map(
        (s, i) =>
          `<button data-everyday="${i}" class="everyday-service"><span class="service-number">${s[1]}</span><strong>${e(s[2])}</strong><small>${e(s[3])}</small><span class="service-status">Ver cobertura ↗</span></button>`,
      )
      .join(""),
  );
  const news = snapshot?.sources.municipal;
  const recent =
    news?.data?.filter((x) => {
      const age = Date.now() - Date.parse(x.publishedAt);
      return age >= 0 && age < 86400000;
    }) ?? [];
  put(
    "daily-pulse",
    `<span class="eyebrow">EL DÍA, DE UN VISTAZO</span><strong>${news?.data ? recent.length : "—"} <span>publicaciones en 24 h</span></strong><p>${e(recent[0]?.title ?? (news?.data ? "Sin publicaciones municipales en esta ventana. Revisa el pulso local para consultar las más recientes." : "Esperando publicaciones municipales."))}</p><span class="source-note">${sourceState(news, 90) === "fresh" ? "Consulta actualizada" : "Consulta pendiente o desactualizada"} · no es un registro de incidentes</span><a href="#news-list">Abrir pulso local ↓</a>`,
  );
}
export function setupIssues(): void {
  document.addEventListener("click", (event) => {
    const target = event.target as Element;
    const f = target.closest<HTMLElement>("[data-issue-filter]");
    if (f) {
      filter = f.dataset.issueFilter!;
      cards();
    }
    const issue = target.closest<HTMLElement>("[data-issue]");
    const service = target.closest<HTMLElement>("[data-everyday]");
    if (issue || service) {
      serviceIndex = service ? Number(service.dataset.everyday) : undefined;
      selected =
        serviceIndex === undefined
          ? issue?.dataset.issue
          : services[serviceIndex]?.[0];
      detail();
      document.querySelector<HTMLDialogElement>("#issue-dialog")?.showModal();
    }
    if (target.closest("[data-close-issue]"))
      document.querySelector<HTMLDialogElement>("#issue-dialog")?.close();
    const dimension = target.closest<HTMLElement>("[data-issue-dimension]");
    if (dimension) {
      if (!current?.sources.municipios?.data) {
        dimension.textContent = "Base municipal no disponible en esta consulta";
        return;
      }
      document.querySelector<HTMLDialogElement>("#issue-dialog")?.close();
      const button = document.createElement("button");
      button.dataset.municipalitySection = dimension.dataset.issueDimension;
      document.body.append(button);
      button.click();
      button.remove();
    }
  });
}
