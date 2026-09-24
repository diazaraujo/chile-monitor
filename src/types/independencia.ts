export interface CommuneSource<T> {
  status: "ok" | "error" | "not-connected";
  fetchedAt: string | null;
  observedAt?: string | null;
  url: string;
  data: T | null;
  error?: string;
}

export interface CommuneWeather {
  temperature: number;
  apparentTemperature: number;
  wind: number;
  code: number;
  min: number;
  max: number;
  rainProbability: number;
  precipitation: number;
  uv: number;
  hourly: { time: string; temperature: number; rainProbability: number }[];
}

export interface MunicipalNews {
  title: string;
  url: string;
  publishedAt: string;
}

export interface CommuneTerritory {
  expedientes: number;
  observations: number;
  participation: number;
  facts: { title: string; date: string; type: string; url: string }[];
  projects: { name: string; status: string; coordinates: [number, number] }[];
  projectsObservedAt: string | null;
}

export interface CommuneSnapshot {
  schemaVersion: 1;
  commune: { cut: "13108"; name: "Independencia" };
  generatedAt: string;
  sources: {
    weather: CommuneSource<CommuneWeather>;
    municipios?: CommuneSource<MunicipalityData>;
    municipal: CommuneSource<MunicipalNews[]>;
    territory: CommuneSource<CommuneTerritory>;
  };
}

export interface MunicipalitySection {
  id: string;
  title: string;
  source: string;
  note: string;
  columns: { key: string; label: string }[];
  records: Record<string, string | number | boolean | null>[];
  limit: number;
}

export interface MunicipalityData {
  schemaVersion: 1;
  cut: "13108";
  exportedAt: string;
  sections: MunicipalitySection[];
}
