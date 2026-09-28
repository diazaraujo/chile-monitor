export type ManagementArea = "seguridad" | "salud" | "educacion";
export type ManagementView = "alcaldia" | "concejo" | "direccion";
export interface ManagementMetric {
  label: string;
  value: number | null;
  unit: "count" | "clp" | "percent";
  period: string;
  source: string;
  scope: string;
  dimension: string;
}
export interface ManagementSector {
  id: ManagementArea;
  title: string;
  question: string;
  evidence: ManagementMetric[];
  resources: ManagementMetric[];
  missing: string[];
  nextStep: string;
  suggestedOwner: string;
  issue: string;
}
