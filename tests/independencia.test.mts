import assert from "node:assert/strict";
import test from "node:test";
import {
  sourceState,
  isCommuneSnapshot,
  safeSourceUrl,
  isMunicipalityData,
} from "../src/services/independencia.ts";

const now = Date.parse("2026-09-24T12:00:00Z");
test("missing and stale sources are not presented as live", () => {
  assert.equal(sourceState(undefined, 90, now), "unavailable");
  assert.equal(
    sourceState(
      { status: "error", fetchedAt: null, url: "", data: null },
      90,
      now,
    ),
    "unavailable",
  );
  assert.equal(
    sourceState(
      { status: "error", fetchedAt: "2026-09-24T11:59:00Z", url: "", data: [] },
      90,
      now,
    ),
    "stale",
  );
  assert.equal(
    sourceState(
      {
        status: "ok",
        fetchedAt: "2026-09-24T11:59:00Z",
        observedAt: "2026-09-23T11:59:00Z",
        url: "",
        data: {},
      },
      90,
      now,
    ),
    "stale",
  );
  assert.equal(
    sourceState(
      { status: "ok", fetchedAt: "2026-09-25T11:59:00Z", url: "", data: {} },
      90,
      now,
    ),
    "unavailable",
  );
});
test("an empty successfully checked municipal feed is valid", () => {
  assert.equal(
    sourceState(
      { status: "ok", fetchedAt: "2026-09-24T11:59:00Z", url: "", data: [] },
      90,
      now,
    ),
    "fresh",
  );
});
test("wrong commune, missing source and malformed weather fail validation", () => {
  assert.equal(
    isCommuneSnapshot({
      schemaVersion: 1,
      commune: { cut: "13101" },
      generatedAt: new Date(now).toISOString(),
    }),
    false,
  );
  const source = { status: "error", fetchedAt: null, url: "", data: null };
  const d = {
    schemaVersion: 1,
    commune: { cut: "13108" },
    generatedAt: new Date(now).toISOString(),
    sources: { weather: source, municipal: source, territory: source },
  };
  assert.equal(isCommuneSnapshot(d), true);
  assert.equal(
    isCommuneSnapshot({
      ...d,
      sources: {
        ...d.sources,
        weather: { ...source, data: { temperature: "warm" } },
      },
    }),
    false,
  );
});
test("source links reject script and data protocols", () => {
  assert.equal(safeSourceUrl("javascript:alert(1)"), "#");
  assert.equal(safeSourceUrl("data:text/html,hello"), "#");
  assert.equal(
    safeSourceUrl("https://www.independencia.cl/news/"),
    "https://www.independencia.cl/news/",
  );
});

test("municipal adapter rejects another CUT and nested unreviewed payloads", () => {
  const data = {
    schemaVersion: 1,
    cut: "13108",
    exportedAt: new Date(now).toISOString(),
    sections: [
      {
        id: "seguridad",
        title: "Seguridad",
        source: "SINIM",
        note: "Inventario 2025",
        limit: 100,
        columns: [{ key: "valor", label: "Valor" }],
        records: [{ valor: 100, anio: 2025, loaded_at: "2026-07-03" }],
      },
    ],
  };
  assert.equal(isMunicipalityData(data), true);
  assert.equal(isMunicipalityData({ ...data, cut: "13101" }), false);
  assert.equal(
    isMunicipalityData({
      ...data,
      sections: [
        { ...data.sections[0], records: [{ raw: { rut: "private" } }] },
      ],
    }),
    false,
  );
  assert.equal(
    isMunicipalityData({
      ...data,
      sections: [{ ...data.sections[0], records: [null] }],
    }),
    false,
  );
});
