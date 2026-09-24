import type { CommuneSnapshot, CommuneSource } from "@/types/independencia";

export const COMMUNE_TIMEZONE = "America/Santiago";
export const COMMUNE_REFRESH_MS = 60_000;

export function sourceState(
  source: CommuneSource<unknown> | undefined,
  maxAgeMinutes: number,
  now = Date.now(),
): "fresh" | "stale" | "unavailable" {
  if (!source?.data || !source.fetchedAt) return "unavailable";
  const stamp = Date.parse(source.observedAt || source.fetchedAt);
  if (!Number.isFinite(stamp) || stamp > now + 5 * 60_000) return "unavailable";
  return source.status === "ok" && now - stamp <= maxAgeMinutes * 60_000
    ? "fresh"
    : "stale";
}

export function isCommuneSnapshot(value: unknown): value is CommuneSnapshot {
  if (!value || typeof value !== "object") return false;
  const d = value as CommuneSnapshot;
  if (
    d.schemaVersion !== 1 ||
    d.commune?.cut !== "13108" ||
    !Number.isFinite(Date.parse(d.generatedAt))
  )
    return false;
  const sources = d.sources;
  if (!sources || !sources.weather || !sources.municipal || !sources.territory)
    return false;
  for (const s of [sources.weather, sources.municipal, sources.territory]) {
    if (
      typeof s !== "object" ||
      !Object.prototype.hasOwnProperty.call(s, "data") ||
      typeof s.url !== "string" ||
      !["ok", "error", "not-connected"].includes(s.status) ||
      (s.fetchedAt !== null && typeof s.fetchedAt !== "string")
    )
      return false;
  }
  const w = sources.weather.data;
  if (
    w &&
    (![
      "temperature",
      "apparentTemperature",
      "wind",
      "code",
      "min",
      "max",
      "rainProbability",
      "precipitation",
      "uv",
    ].every((k) => Number.isFinite(w[k as keyof typeof w])) ||
      !Array.isArray(w.hourly) ||
      !w.hourly.every(
        (h) =>
          h != null &&
          Number.isFinite(h.temperature) &&
          Number.isFinite(h.rainProbability) &&
          Number.isFinite(Date.parse(h.time)),
      ))
  )
    return false;
  const n = sources.municipal.data;
  if (
    n &&
    (!Array.isArray(n) ||
      !n.every(
        (i) =>
          i != null &&
          typeof i.title === "string" &&
          typeof i.url === "string" &&
          typeof i.publishedAt === "string",
      ))
  )
    return false;
  const t = sources.territory.data;
  if (
    t &&
    (!["expedientes", "observations", "participation"].every((k) =>
      Number.isFinite(t[k as keyof typeof t]),
    ) ||
      !Array.isArray(t.facts) ||
      !Array.isArray(t.projects) ||
      !t.facts.every(
        (f) =>
          f != null &&
          typeof f.title === "string" &&
          typeof f.date === "string" &&
          typeof f.type === "string" &&
          typeof f.url === "string",
      ) ||
      !t.projects.every(
        (p) =>
          p != null &&
          typeof p.name === "string" &&
          typeof p.status === "string" &&
          Array.isArray(p.coordinates) &&
          p.coordinates.length === 2 &&
          p.coordinates.every(Number.isFinite),
      ))
  )
    return false;
  return true;
}

export async function fetchCommuneSnapshot(
  signal?: AbortSignal,
): Promise<CommuneSnapshot> {
  const response = await fetch("/chile/independencia.json", {
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error("No fue posible actualizar las fuentes comunales.");
  const data: unknown = await response.json();
  if (!isCommuneSnapshot(data))
    throw new Error("La actualización no tiene un formato comunal válido.");
  return data;
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Despejado";
  if (code <= 3) return "Parcialmente nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 86) return "Chubascos";
  return "Tormenta";
}

export function safeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}
