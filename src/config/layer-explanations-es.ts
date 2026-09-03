import type { LayerExplanation } from './map-layer-definitions';

/**
 * Chile Monitor: traducciones al español de las fichas de capas (layer-explanation
 * cards). Solo contenido — la estructura viene del upstream. `__fallback` cubre
 * las capas sin ficha curada.
 */
export const LAYER_EXPLANATIONS_ES: Record<string, Partial<LayerExplanation>> = {
  __fallback: {
    category: 'Capa',
    purpose: 'Esta capa se puede activar en el mapa, pero aún no tiene una ficha curada de fuente y confianza.',
    source: 'No curada en el set v1 de explicaciones de capas.',
    freshness: 'No hay contrato de frescura declarado a nivel de capa. Revisa los badges del panel, los popups o el estado de frescura de datos cuando estén disponibles.',
    confidence: 'Desconocida hasta que se agregue metadata específica de la fuente.',
    limitations: [
      'Que no exista ficha curada no significa que la capa no esté soportada.',
      'Usa los popups de la capa y los paneles relacionados para contexto de la fuente.',
    ],
    related: ['Guía de capas'],
  },
  ais: {
    category: 'Marítimo',
    purpose: 'Muestra densidad de naves y señales de interrupción AIS alrededor de aguas estratégicas y puntos de estrangulamiento.',
    source: 'Snapshots del relay AISStream, servicio marítimo de WorldMonitor y clasificadores de interrupción de chokepoints.',
    freshness: 'Los snapshots AIS se reconstruyen cada 5 segundos por defecto; el servidor puede cachear la densidad base por 5 minutos, y la capa se desactiva o queda obsoleta sin credenciales/conectividad del relay.',
    confidence: 'Útil para el cribado de anomalías marítimas, pero AIS es autorreportado y las naves pueden apagarlo.',
    limitations: [
      'La cobertura AIS terrestre es dispareja; hay menor visibilidad documentada en Medio Oriente, Asia y océano abierto.',
      'El "dark shipping" se infiere de vacíos y patrones de congestión, no es prueba directa de intención.',
    ],
    related: ['Panel de cadena de suministro', 'Franja de chokepoints', 'Naves militares', 'Señales AIS del brief por país'],
  },
  flights: {
    category: 'Aviación',
    purpose: 'Destaca interrupciones aeroportuarias, cierres, problemas de espacio aéreo derivados de NOTAM y posiciones de aeronaves en vivo cuando hay tracking disponible.',
    source: 'FAA ASWS, AviationStack, NOTAM de OACI, adsb.lol (ODbL), Wingbits, recuperación del servicio OpenSky y relleno opcional no comercial de airplanes.live/adsb.fi.',
    freshness: 'Las semillas de interrupción aeroportuaria corren cada 30 minutos; el panel de aviación refresca vistas operacionales cada 5 minutos.',
    confidence: 'Mejor para triaje de interrupciones; la cobertura de aeronaves en vivo depende de la disponibilidad ADS-B y los proveedores configurados.',
    limitations: [
      'Puede aparecer data de demostración simulada de AviationStack si falta una API key.',
      'Las posiciones en vivo pueden atrasarse o faltar donde la cobertura ADS-B es débil o está bloqueada.',
    ],
    related: ['Panel Airline Intel', 'Barra de comandos de aviación', 'Señales de aviación del brief por país'],
  },
  natural: {
    category: 'Desastres naturales',
    purpose: 'Muestra sismos, alertas graves de desastre y eventos activos de observación terrestre para conciencia situacional.',
    source: 'Sismos USGS, alertas GDACS y eventos NASA EONET fusionados en el servicio de eventos naturales.',
    freshness: 'Los eventos naturales se siembran cada 3 horas; los sismos USGS tienen cadencia de fuente documentada de ~5 minutos.',
    confidence: 'Fuerte para señales públicas de desastre detectadas; la confianza varía por tipo de amenaza y latencia del reporte aguas arriba.',
    limitations: [
      'Las alertas GDACS de baja severidad se filtran para mantener el mapa legible.',
      'Los incendios EONET se filtran por frescura, por lo que eventos abiertos antiguos pueden no aparecer como puntos activos.',
    ],
    related: ['Popups de la capa de eventos naturales', 'Alertas de clima severo (NWS, ECCC, WMO SWIC)', 'Señales naturales del brief por país'],
  },
  weather: {
    category: 'Clima',
    purpose: 'Muestra alertas oficiales activas de clima severo de servicios meteorológicos nacionales, fusionadas en un solo feed.',
    source: 'NWS (EE. UU.), ECCC (Canadá) y agregación CAP del WMO Severe Weather Information Centre (SWIC), sembradas vía el relay de WorldMonitor.',
    freshness: 'Las alertas NWS, ECCC y SWIC se siembran cada 15 minutos con presupuesto de frescura de 45 minutos.',
    confidence: 'Autoritativa para alertas emitidas por los servicios nacionales contribuyentes, sujeta a los tiempos de publicación aguas arriba.',
    limitations: [
      'La mayoría de los miembros SWIC publican geocódigos, no polígonos; esas alertas aparecen como puntos a nivel país.',
      'La cobertura SWIC depende de qué miembros de la OMM publican al agregador en cada momento.',
    ],
    related: ['Capa de alertas de clima severo', 'Señales de clima del brief por país'],
  },
};
