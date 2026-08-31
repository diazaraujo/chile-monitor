const CHILE_PANEL_TITLES: Readonly<Record<string, string>> = Object.freeze({
  map: 'Mapa Chile',
  insights: 'Brief Chile',
  territorial: 'Brief territorial',
  politics: 'Titulares Chile',
  us: 'Política',
  gov: 'Estado',
  climate: 'Clima y territorio',
  latam: 'Cono Sur',
  monitors: 'Mis monitores',
  'threat-timeline': 'Línea de amenazas',
  'live-webcams': 'Webcams en vivo',
});

export function getVariantPanelTitle(variant: string, panelId: string): string | undefined {
  return variant === 'chile' ? CHILE_PANEL_TITLES[panelId] : undefined;
}
