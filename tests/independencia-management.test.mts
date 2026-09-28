import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagementSectors,
  comparableExecution,
} from "../src/services/independencia-management.ts";
import type { MunicipalityData } from "../src/types/independencia.ts";
const fixture = (
  records: MunicipalityData["sections"][number]["records"],
): MunicipalityData => ({
  schemaVersion: 1,
  cut: "13108",
  exportedAt: "2026-09-28T12:00:00Z",
  sections: [
    {
      id: "presupuesto",
      source: "SINIM",
      title: "",
      note: "",
      limit: 100,
      columns: [],
      records,
    },
  ],
});
test("execution refuses unmatched years, missing values and zero budgets", () => {
  const records = [
    { cuenta: "Presupuesto vigente gastos", monto_clp: 100, anio: 2025 },
    { cuenta: "Gasto total devengado", monto_clp: 80, anio: 2024 },
  ];
  assert.equal(comparableExecution(fixture(records)), null);
  records[1]!.anio = 2025;
  assert.deepEqual(comparableExecution(fixture(records)), {
    value: 80,
    period: "2025",
  });
  records[0]!.monto_clp = 0;
  assert.equal(comparableExecution(fixture(records)), null);
  assert.equal(comparableExecution(null), null);
});
test("missing municipal enrollment never falls back to the whole commune", () => {
  const d: MunicipalityData = {
    schemaVersion: 1,
    cut: "13108",
    exportedAt: "2026-09-28T12:00:00Z",
    sections: [
      {
        id: "educacion",
        source: "MINEDUC",
        title: "",
        note: "",
        limit: 100,
        columns: [],
        records: [
          { anio: 2025, matricula_total: 19313, asistencia_promedio: 89.1 },
        ],
      },
    ],
  };
  const education = buildManagementSectors(d, "alcaldia").find(
    (s) => s.id === "educacion",
  )!;
  assert.equal(education.evidence[0]!.value, null);
  assert.equal(education.evidence[1]!.value, 19313);
  assert.match(education.evidence[2]!.scope, /todas las dependencias/);
  for (const s of buildManagementSectors(null, "direccion"))
    assert.ok(s.evidence.every((m) => m.value === null));
});
