import type { MunicipalityData } from "@/types/independencia";
import type {
  ManagementArea,
  ManagementMetric,
  ManagementSector,
  ManagementView,
} from "@/types/independencia-management";
import { SECTOR_PLAN } from "@/config/independencia/management";
export function managementMetric(
  data: MunicipalityData | null,
  dimension: string,
  field: string,
  label: string,
  unit: ManagementMetric["unit"],
  scope: string,
  match?: [string, string],
): ManagementMetric {
  const section = data?.sections.find((s) => s.id === dimension);
  const rows =
    section?.records.filter((r) => !match || r[match[0]] === match[1]) ?? [];
  const row = [...rows].sort(
    (a, b) => Number(b.anio ?? 0) - Number(a.anio ?? 0),
  )[0];
  return {
    label,
    value:
      typeof row?.[field] === "number" && Number.isFinite(row[field])
        ? (row[field] as number)
        : null,
    unit,
    period: row?.anio != null ? String(row.anio) : "Período no informado",
    source: section?.source ?? "Monitor Municipios",
    scope,
    dimension,
  };
}
export function buildManagementSectors(
  data: MunicipalityData | null,
  view: ManagementView,
): ManagementSector[] {
  const metric = (
    d: string,
    f: string,
    l: string,
    u: ManagementMetric["unit"],
    s: string,
    m?: [string, string],
  ) => managementMetric(data, d, f, l, u, s, m);
  const budget = (account: string, label: string) =>
    metric(
      "presupuesto",
      "monto_clp",
      label,
      "clp",
      "Antecedente anual · no saldo disponible",
      ["cuenta", account],
    );
  const evidence: Record<ManagementArea, ManagementMetric[]> = {
    seguridad: [
      metric(
        "seguridad",
        "valor",
        "Cámaras reportadas",
        "count",
        "Inventario · sin estado del turno",
        ["indicador", "Cámaras de vigilancia"],
      ),
      metric(
        "seguridad",
        "valor",
        "Camionetas reportadas",
        "count",
        "Inventario · sin disponibilidad actual",
        ["indicador", "Camionetas de seguridad/patrullaje"],
      ),
      metric(
        "seguridad",
        "valor",
        "Guardias e inspectores",
        "count",
        "Dotación reportada · no presencia efectiva",
        ["indicador", "Guardias e inspectores municipales"],
      ),
    ],
    salud: [
      metric(
        "gestion",
        "valor",
        "Consultas médicas APS",
        "count",
        "Producción anual · no capacidad de hoy",
        ["indicador", "Consultas médicas APS"],
      ),
      budget("Gasto salud (devengado)", "Gasto de salud devengado"),
      budget("Gasto personal salud", "Personal de salud"),
    ],
    educacion: [
      metric(
        "educacion",
        "mat_municipal",
        "Estudiantes municipales",
        "count",
        "Dependencia municipal · no incluye SLEP",
      ),
      metric(
        "educacion",
        "matricula_total",
        "Matrícula de toda la comuna",
        "count",
        "Todas las dependencias · no sólo municipal",
      ),
      metric(
        "educacion",
        "asistencia_promedio",
        "Asistencia comunal",
        "percent",
        "Agregado anual de todas las dependencias",
      ),
    ],
  };
  const resources: Record<ManagementArea, ManagementMetric[]> = {
    seguridad: evidence.seguridad,
    salud: [
      budget("Gasto salud (devengado)", "Gasto de salud devengado"),
      budget("Gasto personal salud", "Personal de salud"),
      budget(
        "Ingresos sector salud (percibido)",
        "Ingresos de salud percibidos",
      ),
    ],
    educacion: [
      budget("Transferencias a educación", "Transferencias a educación"),
      budget(
        "Ingresos sector educación (percibido)",
        "Ingresos de educación percibidos",
      ),
      metric(
        "educacion",
        "mat_municipal",
        "Estudiantes municipales",
        "count",
        "Dependencia municipal",
      ),
    ],
  };
  return (Object.keys(SECTOR_PLAN) as ManagementArea[]).map((id) => ({
    id,
    title: SECTOR_PLAN[id].title,
    question: SECTOR_PLAN[id].questions[view],
    evidence: evidence[id],
    resources: resources[id],
    missing: SECTOR_PLAN[id].missing,
    nextStep: SECTOR_PLAN[id].nextStep,
    suggestedOwner: SECTOR_PLAN[id].owner,
    issue: SECTOR_PLAN[id].issue,
  }));
}
export function formatManagementValue(m: ManagementMetric): string {
  if (m.value === null) return "—";
  const n = (v: number, max = 1) =>
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: max }).format(v);
  return m.unit === "clp"
    ? `$${n(m.value / 1000000)} M`
    : m.unit === "percent"
      ? `${n(m.value)}%`
      : n(m.value, 0);
}
export function comparableExecution(
  data: MunicipalityData | null,
): { value: number; period: string } | null {
  const read = (account: string) =>
    managementMetric(data, "presupuesto", "monto_clp", account, "clp", "", [
      "cuenta",
      account,
    ]);
  const budget = read("Presupuesto vigente gastos"),
    spent = read("Gasto total devengado");
  if (
    budget.value === null ||
    budget.value <= 0 ||
    spent.value === null ||
    spent.value < 0 ||
    budget.period !== spent.period ||
    budget.period === "Período no informado"
  )
    return null;
  return { value: (100 * spent.value) / budget.value, period: budget.period };
}
