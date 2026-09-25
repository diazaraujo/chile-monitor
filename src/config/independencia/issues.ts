// Reviewed research cut. These are historical evidence, never active incidents.
export const RESEARCH_DATE = "2026-09-25";
export const COMMUNE_ISSUES = [
  {
    id: "seguridad_camaras",
    problema: "Seguridad y televigilancia",
    frecuencia_sugerida: "diaria",
    monitores: ["municipios", "mercado-publico", "chile-monitor"],
    llaves: [
      "CUT",
      "RUT comprador institucional",
      "licitacion_codigo",
      "oc_codigo",
      "id_activo",
    ],
    evidencia: [
      "SINIM 2025: 100 cámaras; flota 4 autos, 5 camionetas y 8 motos",
      "OC 584264-233-SE25: $90.315.806, 2026-01-26, recepción conforme",
      "Anuncio de 99 cámaras en julio de 2026",
    ],
    pregunta_de_gestion:
      "Resolver si anuncio, OC e inventario describen los mismos activos; comprobar funcionamiento",
    limites: "Sin unión anuncio/activo ni estado del turno",
    cifra: "100",
    periodo: "cámaras · SINIM 2025",
    grupo: "gestion",
    dimension: "seguridad",
    enlace: {
      titulo: "Anuncio de cámaras",
      url: "https://subprevenciondeldelito.gob.cl/noticia/con-financiamiento-de-la-subsecretaria-de-prevencion-del-delito-independencia-instalara-99-camaras-de-seguridad-en-sectores-estrategicos-de-la-comuna/",
    },
  },
  {
    id: "vif_amenazas",
    problema: "Violencia intrafamiliar y amenazas",
    frecuencia_sugerida: "diaria",
    monitores: ["municipios", "chile-monitor"],
    llaves: ["CUT", "periodo", "tipo de registro"],
    evidencia: [
      "VIF 693 a 781 casos, 2024 a 2025",
      "Amenazas 864 a 961 casos, 2024 a 2025",
    ],
    pregunta_de_gestion:
      "Revisar atención y coordinación pendientes con indicadores agregados",
    limites:
      "Sin registros recientes de derivación; no publicar datos de víctimas",
    cifra: "+12,7%",
    periodo: "casos VIF · 2024 → 2025",
    grupo: "cuidados",
    dimension: "delitos",
    enlace: {
      titulo: "Reporte comunal BCN",
      url: "https://www.bcn.cl/siit/reportescomunales/comunas_v.html?idcom=13108",
    },
  },
  {
    id: "comercio",
    problema: "Comercio y accesibilidad del espacio público",
    frecuencia_sugerida: "territorial",
    monitores: [
      "municipios",
      "inteligencia-inmobiliaria",
      "datos-sii",
      "chile-monitor",
    ],
    llaves: [
      "CUT 13108",
      "codigo SII 13167",
      "patente_id",
      "direccion validada",
    ],
    evidencia: [
      "Fiscalización pública 2026 en Profesor Zañartu y Av. La Paz",
      "Fuente admitida de patentes con corte 2015-10-13",
    ],
    pregunta_de_gestion:
      "Evaluar accesibilidad y continuidad del uso del espacio tras intervenciones",
    limites: "No hay padrón vigente verificado para 2026",
    cifra: "Accesos",
    periodo: "zona de hospitales · 2026",
    grupo: "calle",
    dimension: "economia",
    enlace: {
      titulo: "Fiscalización en hospitales",
      url: "https://www.independencia.cl/fiscalizacion-municipal-desaloja-comercio-ilegal-en-zona-de-hospitales/",
    },
  },
  {
    id: "aseo",
    problema: "Aseo, microbasurales y áreas verdes",
    frecuencia_sugerida: "diaria",
    monitores: [
      "municipios",
      "mercado-publico",
      "integridad",
      "inteligencia-ambiental",
    ],
    llaves: ["oc_codigo", "licitacion_codigo", "sector", "acta inspeccion"],
    evidencia: [
      "Gasto SINIM 2025 aseo: $4.300.753.000",
      "OC 584264-1-SE25 áreas verdes: $952.188.897",
      "Antecedente de denuncia municipal 2025, sin estado judicial actual verificado",
    ],
    pregunta_de_gestion:
      "Cruzar servicio contratado, inspección y reclamo resuelto",
    limites:
      "Compras no prueban prestación; no vincular automáticamente OCs con denuncia",
    cifra: "$4.301 M",
    periodo: "gasto aseo · SINIM 2025",
    grupo: "calle",
    dimension: "ambiente",
    enlace: {
      titulo: "Ficha SINIM",
      url: "https://datos.sinim.gov.cl/impresion_ficha_comunal.php?municipio=13108&provincia=T&region=T",
    },
  },
  {
    id: "riesgo_invernal",
    problema: "Anegamientos y continuidad de servicios",
    frecuencia_sugerida: "condicionada a amenaza",
    monitores: [
      "municipios",
      "chile-monitor",
      "inteligencia-ambiental",
      "inteligencia-inmobiliaria",
      "monitorelectrico",
    ],
    llaves: ["CUT", "punto critico", "tiempo pronostico", "infraestructura"],
    evidencia: [
      "16 puntos críticos 2026, uno alto",
      "Prestadores: Aguas Andinas y Enel",
    ],
    pregunta_de_gestion:
      "Verificar mantenimiento de puntos y continuidad en equipamientos sensibles",
    limites:
      "Unión espacial no ejecutada; sin feed de cortes en vivo acreditado",
    cifra: "16",
    periodo: "puntos críticos · 2026",
    grupo: "calle",
    dimension: "riesgo",
    enlace: {
      titulo: "SENAPRED",
      url: "https://www.senapred.cl/",
    },
  },
  {
    id: "vivienda",
    problema: "Vivienda, hacinamiento y obras",
    frecuencia_sugerida: "semanal",
    monitores: [
      "municipios",
      "inteligencia-inmobiliaria",
      "inteligencia-ambiental",
    ],
    llaves: ["CUT", "codigo SII", "rol", "permiso", "id_expediente"],
    evidencia: [
      "BCN RSH junio 2026: hacinamiento 9,4%",
      "Base municipal vivienda 2024: déficit cuantitativo 7.502",
      "DOM: 153 permisos; sin mediana de plazos",
    ],
    pregunta_de_gestion:
      "Localizar presión habitacional y servicios; verificar proyectos y obras",
    limites: "Universos no sumables; no hay evidencia de demora DOM",
    cifra: "9,4%",
    periodo: "hacinamiento · RSH jun. 2026",
    grupo: "cuidados",
    dimension: "vivienda",
    enlace: {
      titulo: "Reporte comunal BCN",
      url: "https://www.bcn.cl/siit/reportescomunales/comunas_v.html?idcom=13108",
    },
  },
  {
    id: "medicamentos",
    problema: "Acceso a medicamentos y cuidados",
    frecuencia_sugerida: "semanal",
    monitores: ["municipios", "mercado-publico", "remedios"],
    llaves: [
      "oc_codigo",
      "registro ISP",
      "dosis",
      "forma",
      "presentacion",
      "periodo",
    ],
    evidencia: [
      "2024: gasto $156.988.979",
      "Referencia P50: diferencia potencial $12.199.303",
      "Algoritmo actual usa código/unidad; no homologación ISP",
    ],
    pregunta_de_gestion:
      "Homologar productos y revisar contratos, precios y stock",
    limites: "No ahorro confirmado ni sobreprecio probado; no stock consultado",
    cifra: "$12,2 M",
    periodo: "diferencia potencial P50 · 2024",
    grupo: "cuidados",
    dimension: "salud",
    enlace: {
      titulo: "Farmacia comunal",
      url: "https://www.independencia.cl/independencia-relanza-su-farmacia-comunal-con-mayor-surtido-de-medicamentos-y-precios-hasta-60-mas-bajos/",
    },
  },
  {
    id: "vialidad",
    problema: "Seguridad vial y accesibilidad",
    frecuencia_sugerida: "territorial",
    monitores: ["municipios", "mercado-publico", "inteligencia-inmobiliaria"],
    llaves: ["punto accidente", "tramo", "establecimiento", "obra"],
    evidencia: [
      "CONASET integrado 2024: 376 siniestros, 30 atropellos",
      "Acciones municipales 2026 sobre veredas Vivaceta y ciclovías de hospitales",
    ],
    pregunta_de_gestion:
      "Cruzar accidentes con recorridos y obras que requieren recepción",
    limites: "Cruce espacial pendiente; cobertura georreferenciada parcial",
    cifra: "376",
    periodo: "siniestros georreferenciados · 2024",
    grupo: "calle",
    dimension: "transito",
    enlace: {
      titulo: "Veredas en Vivaceta",
      url: "https://www.independencia.cl/realizan-trabajos-para-instalar-sistema-de-riego-del-proyecto-de-mejoramiento-de-veredas-en-avenida-vivaceta/",
    },
  },
  {
    id: "educacion",
    problema: "Trayectorias educativas",
    frecuencia_sugerida: "semanal",
    monitores: ["municipios", "mercado-publico"],
    llaves: ["establecimiento", "periodo", "acuerdo", "oc_codigo"],
    evidencia: ["2025: matrícula 19.313, asistencia 89,1%, retiro 3,04%"],
    pregunta_de_gestion:
      "Revisar barreras de acceso y compromisos de apoyo e infraestructura",
    limites: "Retiro no equivale a abandono definitivo; falta corte reciente",
    cifra: "89,1%",
    periodo: "asistencia escolar · 2025",
    grupo: "cuidados",
    dimension: "educacion",
    enlace: {
      titulo: "Ficha SINIM",
      url: "https://datos.sinim.gov.cl/impresion_ficha_comunal.php?municipio=13108&provincia=T&region=T",
    },
  },
  {
    id: "control",
    problema: "Presupuesto, fiscalización y acuerdos",
    frecuencia_sugerida: "semanal",
    monitores: ["municipios", "mercado-publico", "integridad"],
    llaves: [
      "cuenta",
      "anio",
      "informe",
      "hallazgo",
      "acuerdo",
      "documento cierre",
    ],
    evidencia: [
      "Ejecución aritmética 2025: 85,6%",
      "CGR 2025: 30 hallazgos, 17 altamente complejos",
    ],
    pregunta_de_gestion:
      "Vincular cada compromiso u observación con responsable, plazo y cierre",
    limites:
      "No estado de subsanación; diferencia presupuestaria no es caja libre",
    cifra: "30",
    periodo: "hallazgos CGR · 2025",
    grupo: "gestion",
    dimension: "fiscalizacion",
    enlace: {
      titulo: "Contraloría",
      url: "https://www.contraloria.cl/",
    },
  },
] as const;
