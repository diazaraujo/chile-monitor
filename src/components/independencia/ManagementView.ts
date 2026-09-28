import type { CommuneSnapshot } from "@/types/independencia";
import type {
  ManagementArea,
  ManagementView,
  ManagementMetric,
} from "@/types/independencia-management";
import {
  MANAGEMENT_VIEWS,
  SECTOR_PLAN,
} from "@/config/independencia/management";
import {
  buildManagementSectors,
  comparableExecution,
  formatManagementValue,
  managementMetric,
} from "@/services/independencia-management";
import { sourceState } from "@/services/independencia";
import { escapeHtml } from "@/utils/sanitize";
import { setTrustedHtml, trustedHtml } from "@/utils/dom-utils";
const e = (v: unknown) => escapeHtml(String(v ?? ""));
const put = (id: string, markup: string) => {
  const el = document.getElementById(id);
  if (el)
    setTrustedHtml(
      el,
      trustedHtml(
        markup,
        "Static management markup and escaped public municipal fields. No untrusted HTML or source URLs.",
      ),
    );
};
const views = Object.keys(MANAGEMENT_VIEWS) as ManagementView[];
let view: ManagementView = "alcaldia";
let area: ManagementArea = "seguridad";
let snapshot: CommuneSnapshot | undefined;
const data = () => snapshot?.sources.municipios?.data ?? null;
const sectors = () => buildManagementSectors(data(), view);
const metric = (m: ManagementMetric) =>
  `<div class="mgmt-metric" data-unit="${m.unit}"><strong>${e(formatManagementValue(m))}</strong><span>${e(m.label)}</span><small>${e(m.source)} · ${e(m.period)}</small><small>${e(m.scope)}</small></div>`;
function renderResources(): void {
  const s = sectors().find((x) => x.id === area)!;
  put(
    "management-resources",
    `<div class="mgmt-resource-title"><div><span class="eyebrow">RECURSOS CON EVIDENCIA</span><h3>${e(s.title)} · base para decidir</h3></div><div class="mgmt-area-tabs" role="group" aria-label="Área de recursos">${sectors()
      .map(
        (x) =>
          `<button data-management-area="${x.id}" aria-pressed="${x.id === area}">${e(x.title)}</button>`,
      )
      .join(
        "",
      )}</div></div><div class="mgmt-resource-metrics">${s.resources.map(metric).join("")}</div><p class="source-note">${area === "salud" ? "Personal de salud puede formar parte del gasto de salud: no sumar estas partidas ni interpretarlas como caja disponible." : area === "educacion" ? "Transferencias e ingresos pueden solaparse; no sumarlos ni interpretarlos como presupuesto disponible del día." : "Inventarios de períodos distintos; no equivalen a dotación presente ni disponibilidad del turno."}</p><button class="text-button" data-management-open="${area}">Abrir ficha y alternativas →</button>`,
  );
}
function renderReview(): void {
  if (view === "concejo") {
    const execution = comparableExecution(data());
    const cgr = data()?.sections.find((s) => s.id === "fiscalizacion")
      ?.records[0];
    put(
      "management-review",
      `<div class="mgmt-review-heading"><span class="eyebrow">REVISIÓN DEL CONCEJO</span><h3>Del acuerdo a la evidencia de cumplimiento</h3></div><div class="mgmt-review-grid"><button data-municipality-section="presupuesto"><strong>${execution ? `${execution.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%` : "—"}</strong><span>Ejecución aritmética ${e(execution?.period ?? "")}</span><small>Devengado / vigente del mismo año. No mide saldo libre.</small></button><button data-municipality-section="fiscalizacion"><strong>${e(cgr?.n_hallazgos ?? "—")}</strong><span>Hallazgos CGR · ${e(cgr?.anio ?? "sin período")}</span><small>Consultar antecedentes; estado de subsanación no integrado.</small></button><button data-municipality-section="acuerdos"><strong>Acuerdos ↗</strong><span>Revisar documento de origen</span><small>La extracción no confirma ejecución. Algunos registros no tienen fecha de sesión.</small></button></div><p class="source-note">El enlace acuerdo → contrato → gasto → resultado requiere conciliación documental; no se presenta como completado.</p>`,
    );
  } else {
    put(
      "management-review",
      `<div class="mgmt-review-heading"><span class="eyebrow">${view === "direccion" ? "PREPARAR LA OPERACIÓN" : "AGENDA DE REVISIÓN PROPUESTA"}</span><h3>${view === "direccion" ? "Qué falta validar para gestionar el día" : "Tres preguntas para la próxima reunión"}</h3></div><div class="mgmt-review-grid">${sectors()
        .map(
          (s, i) =>
            `<button data-management-open="${s.id}"><span class="mgmt-review-index">0${i + 1} / ${e(s.title)}</span><h4>${e(view === "direccion" ? s.missing[0] : s.nextStep)}</h4><small>${e(view === "direccion" ? s.nextStep : s.suggestedOwner + " · referente propuesto")}</small><span class="mgmt-review-link">Ver evidencia y próximo paso ↗</span></button>`,
        )
        .join("")}</div>`,
    );
  }
}
function renderDetail(): void {
  const s = sectors().find((x) => x.id === area)!;
  const plan = SECTOR_PLAN[area];
  const rows = data()?.sections.find((x) => x.id === area)?.records ?? [];
  const centers =
    area === "salud"
      ? `<div class="mgmt-centers"><h3>Centros incluidos en la fuente</h3>${rows.length ? rows.map((r) => `<div><strong>${e(r.nombre)}</strong><span>DEIS ${e(r.cod_centro ?? "no informado")} · ${e(r.dependencia ?? "dependencia no informada")}</span><small>${e(r.inscritos ?? "—")} inscritos · ${e(r.anio)}. No representa disponibilidad de atención.</small></div>`).join("") : "<p>Sin registros de centros en esta consulta.</p>"}</div>`
      : "";
  const edu = rows[0];
  const dependences =
    area === "educacion"
      ? `<div class="mgmt-centers"><h3>Matrícula por dependencia · ${e(edu?.anio ?? "sin período")}</h3>${[
          ["mat_municipal", "Municipal"],
          ["mat_slep", "SLEP"],
          ["mat_subvencionado", "Particular subvencionado"],
          ["mat_pagado", "Particular pagado"],
          ["mat_otro", "Otra dependencia"],
        ]
          .map(
            ([key, label]) =>
              `<div><strong>${label}: ${e(edu?.[key!] ?? "No informado")}</strong></div>`,
          )
          .join(
            "",
          )}<p>Asistencia y número de establecimientos del agregado corresponden a toda la comuna. Retiro no equivale a abandono definitivo.</p></div>`
      : "";
  put(
    "management-detail",
    `<div class="mgmt-detail-heading"><span class="eyebrow">FICHA DE GESTIÓN · ${e(MANAGEMENT_VIEWS[view].label)}</span><h2 id="management-title">${e(s.title)}: ${e(s.question)}</h2><p>Base documental y alternativas para revisión. No es una orden de trabajo ni confirma una brecha operativa actual.</p></div><div class="mgmt-detail-body"><div class="mgmt-chain" aria-label="Cadena de gestión">${["Necesidad", "Capacidad", "Brecha", "Intervención", "Costo", "Responsable", "Resultado"].map((x, i) => `<div><span>0${i + 1}</span><strong>${x}</strong><small>${i === 1 ? "Antecedentes disponibles" : i === 3 ? "Alternativas propuestas" : i === 5 ? "Referente por validar" : "Requiere validación"}</small></div>`).join("")}</div><h3>Evidencia de base</h3><div class="mgmt-resource-metrics">${s.evidence.map(metric).join("")}</div>${centers}${dependences}<div class="mgmt-detail-columns"><section><span class="eyebrow">ANTES DE DECIDIR</span><h3>Registros que faltan</h3><ul>${s.missing.map((x) => `<li>${e(x)}</li>`).join("")}</ul><p>Disponibilidad, demanda y costo incremental: no calculables con esta cobertura.</p></section><section><span class="eyebrow">PRÓXIMO PASO PROPUESTO</span><h3>${e(s.nextStep)}</h3><p>Referente institucional propuesto: ${e(s.suggestedOwner)}.</p><p>Responsable asignado, plazo y resultado: no registrados.</p></section></div><h3>Alternativas a evaluar</h3><div class="mgmt-options">${plan.options.map((x) => `<article><h4>${e(x.title)}</h4><p>${e(x.evidence)}</p><small>Costo e impacto pendientes de evidencia.</small></article>`).join("")}</div><div class="mgmt-detail-actions"><button class="text-button" data-management-dimension="${area}">Ver registros de origen ↗</button><button class="text-button" data-management-research="${s.issue}">Ver investigación del problema ↗</button><button class="text-button" data-management-export>Descargar ficha de revisión ↓</button></div></div>`,
  );
}
function sectorIcon(id: ManagementArea): string {
  const paths = {
    seguridad:
      '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    salud: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
    educacion:
      '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v6c4 3 8 3 12 0v-6M22 9v8"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${paths[id]}</svg>`;
}
function renderVisualSummary(): void {
  const execution = comparableExecution(data());
  const percent = execution ? Math.min(100, Math.max(0, execution.value)) : 0;
  const budget = managementMetric(
    data(),
    "presupuesto",
    "monto_clp",
    "Presupuesto vigente",
    "clp",
    "",
    ["cuenta", "Presupuesto vigente gastos"],
  );
  const spent = managementMetric(
    data(),
    "presupuesto",
    "monto_clp",
    "Devengado",
    "clp",
    "",
    ["cuenta", "Gasto total devengado"],
  );
  const education = sectors().find((s) => s.id === "educacion")!;
  const municipal = education.evidence[0]!;
  const total = education.evidence[1]!;
  const share =
    municipal.value !== null &&
    total.value !== null &&
    total.value > 0 &&
    municipal.period === total.period &&
    municipal.value <= total.value
      ? (100 * municipal.value) / total.value
      : null;
  put(
    "civic-summary",
    `<button class="civic-budget" data-municipality-section="presupuesto"><div class="visual-heading"><span>RECURSOS MUNICIPALES</span><span>${e(execution?.period ?? "Sin período")} ↗</span></div><div class="budget-visual"><div class="budget-ring" style="--progress:${percent}%"><div><strong>${execution ? e(execution.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })) + "%" : "—"}</strong><span>Ejecución</span></div></div><div class="budget-values"><span>Presupuesto vigente</span><strong>${e(formatManagementValue(budget))}</strong><span>Gasto devengado</span><strong>${e(formatManagementValue(spent))}</strong></div></div><small>SINIM · devengado / vigente · no mide saldo libre</small></button><button class="civic-education" data-management-open="educacion"><div class="visual-heading"><span>EDUCACIÓN EN LA COMUNA</span><span>${e(total.period)} ↗</span></div><div class="education-total"><strong>${e(formatManagementValue(total))}</strong><span>estudiantes · todas las dependencias</span></div><div class="enrollment-track" aria-label="Proporción de matrícula municipal"><span style="width:${share ?? 0}%"></span></div><div class="enrollment-legend"><span><i></i>Municipal <b>${e(formatManagementValue(municipal))}</b></span><span>Participación <b>${share !== null ? e(share.toLocaleString("es-CL", { maximumFractionDigits: 1 })) + "%" : "—"}</b></span></div><small>MINEDUC · matrícula anual</small></button>`,
  );
}
export function renderManagement(next?: CommuneSnapshot): void {
  snapshot = next;
  const info = MANAGEMENT_VIEWS[view];
  const state = sourceState(next?.sources.municipios, 26 * 60);
  put(
    "management-workspace",
    `<div class="mgmt-header"><div><span class="eyebrow">PANORAMA COMUNAL</span><h2>${e(info.headline)}</h2></div><div class="mgmt-view-switch" role="group" aria-label="Perspectiva de gestión">${views.map((v) => `<button data-management-view="${v}" aria-pressed="${view === v}">${e(MANAGEMENT_VIEWS[v].label)}</button>`).join("")}</div></div><div class="mgmt-coverage"><span class="mgmt-coverage-dot"></span><span>${state === "fresh" ? "Consulta municipal actualizada" : state === "stale" ? "Consulta municipal desactualizada" : "Base municipal no disponible"} · cifras históricas con período</span><span>Operación diaria: sin registros conectados</span></div><div class="mgmt-sector-grid">${sectors()
      .map(
        (s) =>
          `<article class="mgmt-sector" data-sector="${s.id}"><div class="mgmt-sector-heading"><span class="sector-icon">${sectorIcon(s.id)}</span><h3>${e(s.title)}</h3><span class="mgmt-historical">${e(s.evidence[0]?.period)}</span></div><div class="mgmt-sector-metrics">${s.evidence.map(metric).join("")}</div><button data-management-open="${s.id}" aria-label="Explorar ${e(s.title)}">Explorar área <span>↗</span></button></article>`,
      )
      .join(
        "",
      )}</div><details class="management-analysis"><summary>Análisis y recursos · ${e(info.label)} <span>Ver detalle ↗</span></summary><section id="management-review" class="mgmt-review"></section><section id="management-resources" class="mgmt-resources"></section></details>`,
  );
  renderVisualSummary();
  renderReview();
  renderResources();
  if (document.querySelector<HTMLDialogElement>("#management-dialog")?.open)
    renderDetail();
}
function exportBrief(): void {
  const s = sectors().find((x) => x.id === area)!;
  const lines = [
    `# Independencia · ${s.title}`,
    `Vista: ${MANAGEMENT_VIEWS[view].label}`,
    `Consulta de la base: ${data()?.exportedAt ?? "no disponible"}`,
    `Estado de fuente: ${sourceState(snapshot?.sources.municipios, 26 * 60)}`,
    "",
    "Ficha de revisión; no instrucción ni asignación operativa.",
    s.question,
    "",
    "## Evidencia",
    ...s.evidence.map(
      (m) =>
        `- ${m.label}: ${formatManagementValue(m)} · ${m.period} · ${m.source}. ${m.scope}`,
    ),
    "",
    "## Recursos",
    ...s.resources.map(
      (m) =>
        `- ${m.label}: ${formatManagementValue(m)} · ${m.period} · ${m.source}. ${m.scope}`,
    ),
    "",
    "Las partidas pueden solaparse; no sumarlas ni interpretarlas como caja disponible.",
    "",
    "## Registros pendientes",
    ...s.missing.map((x) => `- ${x}`),
    "",
    "## Próximo paso",
    s.nextStep,
    `Referente propuesto: ${s.suggestedOwner}. No asignado.`,
    "Plazo, costo incremental y resultado: no registrados.",
    "",
    "## Alternativas",
    ...SECTOR_PLAN[area].options.map((x) => `- ${x.title}: ${x.evidence}`),
    "",
    "Origen: Monitor Municipios · CUT 13108. Detalle disponible en el explorador de dimensiones de esta pantalla.",
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `independencia-${area}-revision.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function setupManagement(): void {
  const requested = new URLSearchParams(location.search).get("vista");
  if (views.includes(requested as ManagementView))
    view = requested as ManagementView;
  document.addEventListener("click", (event) => {
    const b = (event.target as Element).closest<HTMLElement>("button");
    if (!b) return;
    const perspective = b.dataset.managementView as ManagementView | undefined;
    if (perspective && views.includes(perspective)) {
      view = perspective;
      const url = new URL(location.href);
      url.searchParams.set("vista", view);
      history.replaceState(null, "", url);
      renderManagement(snapshot);
    }
    const selected = b.dataset.managementOpen ?? b.dataset.managementArea;
    if (selected && selected in SECTOR_PLAN) {
      area = selected as ManagementArea;
      renderResources();
      if (b.dataset.managementOpen) {
        renderDetail();
        document
          .querySelector<HTMLDialogElement>("#management-dialog")
          ?.showModal();
      }
    }
    if (b.hasAttribute("data-close-management"))
      document.querySelector<HTMLDialogElement>("#management-dialog")?.close();
    if (b.hasAttribute("data-management-export")) exportBrief();
    if (b.dataset.managementDimension || b.dataset.managementResearch) {
      if (b.dataset.managementDimension && !data()) {
        b.textContent = "Base municipal no disponible";
        return;
      }
      document.querySelector<HTMLDialogElement>("#management-dialog")?.close();
      const action = document.createElement("button");
      if (b.dataset.managementDimension)
        action.dataset.municipalitySection = b.dataset.managementDimension;
      else action.dataset.issue = b.dataset.managementResearch;
      document.body.append(action);
      action.click();
      action.remove();
    }
  });
}
