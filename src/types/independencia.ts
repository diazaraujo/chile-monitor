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
    municipal: CommuneSource<MunicipalNews[]>;
    territory: CommuneSource<CommuneTerritory>;
  };
}
