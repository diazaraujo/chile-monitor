import type {
  MunicipalityData,
  MunicipalitySection,
} from "@/types/independencia";
import { safeSourceUrl } from "@/services/independencia";
import { escapeHtml } from "@/utils/sanitize";
import { setTrustedHtml, trustedHtml } from "@/utils/dom-utils";
const e = (v: unknown) => escapeHtml(String(v ?? ""));
const num = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(v)
    : v == null
      ? "—"
      : String(v);
const html = (target: string, markup: string) => {
  const el = document.querySelector<HTMLElement>(target);
  if (el)
    setTrustedHtml(
      el,
      trustedHtml(
        markup,
        "All Monitor Municipios fields are escaped; links use safeSourceUrl; records pass isMunicipalityData.",
      ),
    );
};
let current: MunicipalityData | null = null;
let selected = "seguridad";
const get = (id: string) => current?.sections.find((s) => s.id === id);
const value = (
  id: string,
  key: string,
  predicate?: (r: MunicipalitySection["records"][number]) => boolean,
) => {
  const section = get(id);
  const row = predicate
    ? section?.records.find(predicate)
    : section?.records[0];
  return {
    value: row?.[key],
    period: String(
      row?.anio ??
        row?.temporada ??
        row?.periodo ??
        row?.periodo_mes ??
        "Período no informado",
    ),
  };
};
function cards(): {
  id: string;
  label: string;
  value: string;
  detail: string;
}[] {
  const cam = value(
    "seguridad",
    "valor",
    (r) => r.indicador === "Cámaras de vigilancia",
  );
  const risk = value("riesgo", "n_puntos");
  const budget = value(
    "presupuesto",
    "monto_clp",
    (r) => r.cuenta === "Presupuesto vigente gastos",
  );
  const cgr = value("fiscalizacion", "n_hallazgos");
  const edu = value("educacion", "matricula_total");
  const rsh = value("rsh", "hogares");
  return [
    {
      id: "seguridad",
      label: "Cámaras reportadas",
      value: num(cam.value),
      detail: `SINIM ${cam.period} · inventario`,
    },
    {
      id: "riesgo",
      label: "Puntos de riesgo invernal",
      value: num(risk.value),
      detail: `SENAPRED · temporada ${risk.period}`,
    },
    {
      id: "presupuesto",
      label: "Presupuesto vigente",
      value:
        typeof budget.value === "number"
          ? `$${num(budget.value / 1_000_000)} M`
          : "—",
      detail: `SINIM ${budget.period} · CLP`,
    },
    {
      id: "fiscalizacion",
      label: "Hallazgos de Contraloría",
      value: num(cgr.value),
      detail: `CGR ${cgr.period} · observaciones`,
    },
    {
      id: "educacion",
      label: "Matrícula escolar",
      value: num(edu.value),
      detail: `MINEDUC ${edu.period}`,
    },
    {
      id: "rsh",
      label: "Hogares inscritos en RSH",
      value: num(rsh.value),
      detail: `ADIS · ${rsh.period}`,
    },
  ];
}
function renderDetail(): void {
  const s = get(selected);
  if (!s) return;
  html(
    "#municipality-tabs",
    current!.sections
      .map(
        (section) =>
          `<button data-municipality-section="${e(section.id)}" class="${section.id === selected ? "active" : ""}" aria-pressed="${section.id === selected}">${e(section.title)}<span>${section.records.length ? "●" : "—"}</span></button>`,
      )
      .join(""),
  );
  html(
    "#municipality-detail",
    `<div class="municipality-detail-heading"><span class="eyebrow">${e(s.source)}</span><h3>${e(s.title)}</h3><p>${e(s.note || "Datos del período indicado en cada registro.")}</p></div>${
      s.records.length
        ? `<div class="municipality-table-wrap"><table><thead><tr>${s.columns.map((c) => `<th scope="col">${e(c.label)}</th>`).join("")}<th scope="col">Carga en Monitor Municipios</th></tr></thead><tbody>${s.records
            .map(
              (r) =>
                `<tr>${s.columns
                  .map((c) => {
                    const v = r[c.key];
                    const display =
                      v === null
                        ? "No informado"
                        : typeof v === "boolean"
                          ? v
                            ? "Sí"
                            : "No"
                          : ["anio", "temporada", "tramo"].includes(c.key)
                            ? String(v)
                            : num(v);
                    return `<td class="${c.key === "resumen_md" || c.key === "materia" ? "long-text" : ""}">${["url", "url_pdf", "fuente"].includes(c.key) && typeof v === "string" && /^https?:/.test(v) ? `<a href="${e(safeSourceUrl(v))}" target="_blank" rel="noopener noreferrer">Abrir fuente ↗</a>` : e(display)}</td>`;
                  })
                  .join(
                    "",
                  )}<td>${e(String(r.loaded_at ?? "No informada").slice(0, 10))}</td></tr>`,
            )
            .join(
              "",
            )}</tbody></table></div><p class="source-note">${s.records.length} registros mostrados${s.records.length === s.limit ? ` · vista limitada a ${s.limit}` : ""}. Un registro ausente no equivale a cero. Fecha de carga distinta del período observado.</p>`
        : '<div class="empty-state">Sin registros para Independencia en esta dimensión.<span>La consulta a Monitor Municipios se completó; no se infiere un valor cero.</span></div>'
    }`,
  );
}
export function renderMunicipality(
  data: MunicipalityData | null,
  state: string,
): void {
  current = data;
  const brief = document.querySelector("#municipal-brief");
  if (brief && data) {
    const risk = value("riesgo", "n_puntos");
    const high = value("riesgo", "n_alto");
    const cgr = value("fiscalizacion", "n_hallazgos");
    brief.textContent = `${num(risk.value)} puntos críticos de invierno (${risk.period}), ${num(high.value)} de riesgo alto. ${num(cgr.value)} hallazgos CGR en ${cgr.period}. Revisar antecedentes y seguimiento con las áreas responsables.`;
  }

  const count = data?.sections.filter((s) => s.records.length).length ?? 0;
  html(
    "#municipality-overview",
    `<div class="municipality-heading"><div><span class="eyebrow">MONITOR MUNICIPIOS · CUT 13108</span><h2>La comuna que gestionamos</h2><p>${data ? `${count} dimensiones con datos de ${data.sections.length} consultadas. Cada cifra conserva su período.` : "Esperando la base de Monitor Municipios."}</p></div><button data-municipality-section="seguridad" class="text-button">Explorar todas las dimensiones ↗</button></div><div class="municipality-card-grid">${cards()
      .map(
        (c) =>
          `<button class="municipality-card" data-municipality-section="${c.id}"><span>${e(c.label)}</span><strong>${e(c.value)}</strong><small>${e(c.detail)}</small></button>`,
      )
      .join(
        "",
      )}</div><p class="source-note">${state === "fresh" ? "Consulta de la base al día" : state === "stale" ? "La sincronización de Monitor Municipios requiere actualización" : "Sin sincronización disponible"}${data ? ` · consultada ${e(new Date(data.exportedAt).toLocaleString("es-CL", { timeZone: "America/Santiago" }))}` : ""}. Las series históricas no representan actividad de hoy.</p>`,
  );
  html(
    "#dispatch-context",
    `<span class="eyebrow">BASE MUNICIPAL · ${count} DIMENSIONES</span><div class="dispatch-context-grid">${cards()
      .slice(0, 4)
      .map(
        (c) =>
          `<button data-municipality-section="${c.id}"><strong>${e(c.value)}</strong><span>${e(c.label)}</span><small>${e(c.detail)}</small></button>`,
      )
      .join("")}</div>`,
  );
  const security = get("seguridad");
  const services = get("servicios");
  html(
    "#municipal-capacity",
    `${
      security?.records.length
        ? security.records
            .filter((r) =>
              [
                "Cámaras de vigilancia",
                "Autos de seguridad/patrullaje",
                "Camionetas de seguridad/patrullaje",
                "Motos de seguridad/patrullaje",
                "Guardias e inspectores municipales",
              ].includes(String(r.indicador)),
            )
            .map(
              (r) =>
                `<div><span><strong>${e(r.indicador)}</strong><small>Inventario SINIM ${e(r.anio)} · sin estado del turno</small></span><b>${e(num(r.valor))}</b></div>`,
            )
            .join("")
        : '<div class="empty-state">Inventario SINIM no disponible.</div>'
    }${services?.records.map((r) => `<div><span><strong>${e(r.empresa)}</strong><small>${e(r.tipo)} · prestador catastrado</small></span></div>`).join("") ?? ""}<p class="source-note">Incidentes 1469: sin acceso al registro municipal en vivo. La dotación y los prestadores sí están integrados desde Monitor Municipios.</p>`,
  );
  renderDetail();
}
export function setupMunicipality(): void {
  document.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      "[data-municipality-section]",
    );
    if (target && current) {
      selected = target.dataset.municipalitySection!;
      renderDetail();
      const dialog = document.querySelector<HTMLDialogElement>(
        "#municipality-dialog",
      )!;
      if (!dialog.open) dialog.showModal();
    }
    if ((event.target as Element).closest("[data-close-municipality]"))
      document
        .querySelector<HTMLDialogElement>("#municipality-dialog")
        ?.close();
  });
}
