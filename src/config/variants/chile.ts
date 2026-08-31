// Chile variant — Chile Monitor (Enigma / chile.worldmonitor)
// Runtime wiring lives in src/config/panels.ts (CHILE_PANELS, CHILE_MAP_LAYERS)
// and src/config/feeds.ts (CHILE_FEEDS). Keep both in sync with this file.
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

export * from './base';

export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  map: { name: 'Mapa Chile', enabled: true, priority: 1 },
  insights: { name: 'Brief Chile', enabled: true, priority: 1 },
  territorial: { name: 'Brief territorial', enabled: true, priority: 1 },
  politics: { name: 'Titulares Chile', enabled: true, priority: 1 },
  us: { name: 'Política', enabled: true, priority: 1 },
  gov: { name: 'Estado', enabled: true, priority: 1 },
  climate: { name: 'Clima y territorio', enabled: true, priority: 1 },
  latam: { name: 'Cono Sur', enabled: true, priority: 2 },
  monitors: { name: 'Mis monitores', enabled: true, priority: 2 },
  'threat-timeline': { name: 'Línea de amenazas', enabled: true, priority: 2 },
  'live-webcams': { name: 'Webcams en vivo', enabled: true, priority: 2 },
  camaras: { name: 'Cámaras por comuna', enabled: true, priority: 2 },
};

export const DEFAULT_MAP_LAYERS: MapLayers = {
  gpsJamming: false,
  satellites: false,
  conflicts: false,
  bases: true,
  cables: true,
  pipelines: true,
  hotspots: false,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: false,
  weather: true,
  canadaRoads: false,
  canadaAlerts: false,
  economic: false,
  waterways: false,
  outages: false,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: true,
  military: true,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: true,
  ucdpEvents: false,
  displacement: false,
  climate: true,
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  iranAttacks: false,
  ciiChoropleth: false,
  resilienceScore: false,
  dayNight: false,
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  webcams: false,
  diseaseOutbreaks: false,
  chileAgua: true,
  chileTierras: true,
  chilePueblos: true,
  chileSeia: true,
};

export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  ...DEFAULT_MAP_LAYERS,
  flights: false,
  bases: true,
  military: true,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'chile',
  description: 'Chile Monitor — territorio, prensa, riesgos y Estado',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
