#!/usr/bin/env node
/** Read-only adapter for Monitor Municipios. Credentials stay on its trusted host.
 * WM_SEED_ENV_FILE points to its existing environment; MUNICIPIOS_REPO supplies pg.
 * Writes only explicitly selected public columns for CUT 13108, atomically.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvFile } from "./_seed-utils.mjs";
loadEnvFile(import.meta.url, {
  only: [
    "POSTGRES_URL",
    "DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
  ],
});
const cut = "13108";
const spec = (
  id,
  title,
  source,
  table,
  fields,
  order = "",
  filter = "",
  note = "",
) => ({ id, title, source, table, fields, order, filter, note });
// Explicit allowlist: no family relationships, RUTs, private conflicts or raw documents.
const specs = [
  spec(
    "seguridad",
    "Seguridad municipal",
    "SINIM / SUBDERE",
    "gestion",
    [
      ["indicador", "Indicador"],
      ["valor", "Cantidad"],
      ["unidad", "Unidad"],
      ["anio", "Año"],
    ],
    "indicador, anio desc",
    "and indicador ~* 'vigilancia|seguridad|patrullaje|guardias|casetas'",
    "Inventario reportado; no disponibilidad del turno ni transmisión de cámaras.",
  ),
  spec(
    "riesgo",
    "Riesgo invernal",
    "SENAPRED",
    "riesgo_invernal",
    [
      ["temporada", "Temporada"],
      ["n_puntos", "Puntos críticos"],
      ["n_alto", "Riesgo alto"],
      ["n_muy_alto", "Riesgo muy alto"],
      ["causa_principal", "Causa principal"],
    ],
    "temporada desc",
    "",
    "Catastro de puntos críticos, no emergencias activas.",
  ),
  spec(
    "presupuesto",
    "Presupuesto y gasto",
    "SINIM / SUBDERE",
    "finanza",
    [
      ["cuenta", "Cuenta"],
      ["monto_clp", "Monto CLP"],
      ["anio", "Año"],
    ],
    "cuenta, anio desc",
  ),
  spec(
    "compras",
    "Compras públicas",
    "ChileCompra",
    "compra_agg",
    [
      ["periodo_mes", "Mes"],
      ["n_ocs", "Órdenes de compra"],
      ["monto_clp", "Monto CLP"],
      ["n_proveedores", "Proveedores"],
    ],
    "periodo_mes desc",
    "",
    "Serie mensual. Los montos corresponden al período mostrado.",
  ),
  spec(
    "mecanismos",
    "Mecanismos de compra",
    "ChileCompra",
    "compra_mecanismo",
    [
      ["mecanismo", "Mecanismo"],
      ["monto_clp", "Monto CLP"],
      ["n_ocs", "Órdenes"],
      ["anio", "Año"],
    ],
    "anio desc, monto_clp desc",
  ),
  spec(
    "fiscalizacion",
    "Fiscalización",
    "Contraloría General de la República",
    "fiscalizacion",
    [
      ["anio", "Año"],
      ["n_hallazgos", "Hallazgos"],
      ["ac", "Altamente complejos"],
      ["n_informes", "Informes"],
    ],
    "anio desc",
    "",
    "Observaciones de auditoría; no equivalen a delitos ni a pendientes de subsanación.",
  ),
  spec(
    "delitos",
    "Casos policiales",
    "CEAD / Ministerio de Seguridad Pública",
    "delito",
    [
      ["delito", "Tipo"],
      ["casos", "Casos"],
      ["tasa_100k", "Tasa por 100.000"],
      ["anio", "Año"],
    ],
    "anio desc, casos desc",
    "",
    "Casos policiales registrados, no victimización ni incidentes del día.",
  ),
  spec(
    "salud",
    "Red de atención primaria",
    "FONASA",
    "aps_centro",
    [
      ["nombre", "Centro"],
      ["tipo", "Tipo"],
      ["inscritos", "Inscritos"],
      ["anio", "Año"],
    ],
    "anio desc, inscritos desc",
  ),
  spec(
    "gestion",
    "Gestión y capacidades",
    "SINIM / SUBDERE",
    "gestion",
    [
      ["indicador", "Indicador"],
      ["valor", "Valor"],
      ["unidad", "Unidad"],
      ["anio", "Año"],
    ],
    "indicador, anio desc",
    "and indicador !~* 'vigilancia|seguridad|patrullaje|guardias|casetas'",
  ),
  spec(
    "educacion",
    "Educación",
    "MINEDUC",
    "educacion",
    [
      ["anio", "Año"],
      ["n_establecimientos", "Establecimientos"],
      ["matricula_total", "Matrícula"],
      ["asistencia_promedio", "Asistencia %"],
      ["tasa_retiro", "Retiro %"],
      ["pct_prioritarios", "Prioritarios %"],
    ],
    "anio desc",
  ),
  spec(
    "vivienda",
    "Vivienda",
    "MINVU / INE",
    "vivienda",
    [
      ["anio", "Año"],
      ["deficit_cuantitativo", "Déficit de viviendas"],
      ["deficit_pct", "Déficit %"],
      ["campamentos_n", "Campamentos"],
      ["permisos_viviendas", "Viviendas autorizadas"],
    ],
    "anio desc",
  ),
  spec(
    "transito",
    "Seguridad vial",
    "CONASET",
    "transito",
    [
      ["anio", "Año"],
      ["siniestros", "Siniestros"],
      ["fallecidos", "Fallecidos"],
      ["lesionados", "Lesionados"],
      ["atropellos", "Atropellos"],
    ],
    "anio desc",
    "",
    "Cobertura de siniestros georreferenciados del catastro; no partes en tiempo real.",
  ),
  spec(
    "social",
    "Indicadores sociales",
    "CASEN / INE / DEMRE",
    "social",
    [
      ["indicador", "Indicador"],
      ["valor", "Valor"],
      ["unidad", "Unidad"],
      ["anio", "Año"],
      ["fuente", "Fuente"],
    ],
    "indicador, anio desc",
  ),
  spec(
    "rsh",
    "Registro Social de Hogares",
    "MDSF / ADIS",
    "rsh_comuna",
    [
      ["periodo", "Período"],
      ["hogares", "Hogares"],
      ["personas", "Personas"],
      ["tramo40", "Tramo 40"],
      ["ninos", "Niños"],
      ["p60mas", "Mayores de 60"],
    ],
    "",
    "",
    "Universo inscrito en el RSH; no es el total censal de habitantes.",
  ),
  spec(
    "servicios",
    "Prestadores de servicios",
    "Catastro Monitor Municipios",
    "comuna_servicio",
    [
      ["tipo", "Servicio"],
      ["empresa", "Prestador"],
    ],
    "tipo",
    "",
    "Prestadores identificados; el catastro no informa cortes actuales.",
  ),
  spec(
    "equipamiento",
    "Equipamiento comunal",
    "OSM / DEIS / Itrend",
    "equipamiento",
    [
      ["tipo", "Tipo"],
      ["n", "Cantidad"],
    ],
    "n desc",
  ),
  spec(
    "concejo",
    "Última sesión del concejo",
    "Video municipal / Monitor Municipios",
    "concejo_sesion",
    [
      ["fecha", "Fecha"],
      ["url", "Video"],
      ["resumen_md", "Resumen"],
      ["modelo", "Modelo de extracción"],
    ],
    "fecha desc nulls last",
    "",
    "Resumen generado por IA; verificar acuerdos en el acta o video de origen.",
  ),
  spec(
    "actas",
    "Actas del concejo",
    "Transparencia Activa",
    "acta_documento",
    [
      ["anio", "Año"],
      ["numero", "Número"],
      ["denominacion", "Acta"],
      ["fecha_acto", "Fecha del acto"],
      ["url_pdf", "Documento"],
    ],
    "anio desc nulls last, id desc",
  ),
  spec(
    "acuerdos",
    "Acuerdos del concejo",
    "Actas / extracción Monitor Municipios",
    "acta_acuerdo",
    [
      ["fecha_sesion", "Fecha"],
      ["numero_acuerdo", "Acuerdo"],
      ["materia", "Materia"],
      ["categoria", "Categoría"],
      ["monto_clp", "Monto CLP"],
      ["votacion", "Votación"],
    ],
    "fecha_sesion desc nulls last, id desc",
    "and categoria <> '_sin_acuerdos'",
    "Extracción automatizada parcial, no seguimiento de ejecución de acuerdos.",
  ),
  spec(
    "autoridades",
    "Gobierno comunal",
    "SERVEL / DecideChile",
    "autoridad",
    [
      ["nombre", "Nombre"],
      ["cargo", "Cargo"],
      ["partido", "Partido"],
      ["pacto", "Pacto"],
      ["periodo", "Período"],
    ],
    "cargo, votos desc nulls last",
    "and periodo='2024-2028'",
  ),
  spec(
    "aire",
    "Calidad del aire",
    "SINCA / MMA",
    "aire_calidad",
    [
      ["anio", "Año"],
      ["contaminante", "Contaminante"],
      ["promedio_anual", "Promedio anual µg/m³"],
      ["dias_sobre_norma", "Días sobre norma"],
      ["n_estaciones", "Estaciones"],
    ],
    "anio desc",
  ),
  spec(
    "sinca",
    "Mediciones de aire",
    "SINCA / MMA",
    "sinca_aire_comuna",
    [
      ["pm25_fecha", "Fecha MP2,5"],
      ["pm25_ultimo", "MP2,5 µg/m³"],
      ["pm10_fecha", "Fecha MP10"],
      ["pm10_ultimo", "MP10 µg/m³"],
      ["url", "Fuente"],
    ],
    "",
    "",
    "Última observación disponible en Monitor Municipios; revisar su fecha.",
  ),
  spec(
    "organizaciones",
    "Tejido comunitario",
    "Registro Civil / RPJSFL",
    "organizacion_comuna",
    [
      ["total", "Organizaciones"],
      ["vecinal", "Vecinales"],
      ["adulto_mayor", "Adultos mayores"],
      ["deportiva", "Deportivas"],
      ["bomberos", "Bomberos"],
      ["salud_social", "Salud y apoyo social"],
    ],
  ),
  spec(
    "economia",
    "Actividad económica",
    "SII",
    "empresa_tramo",
    [
      ["anio", "Año"],
      ["tramo", "Tramo SII"],
      ["n_empresas", "Empresas"],
      ["trabajadores", "Trabajadores"],
      ["ventas_uf", "Ventas UF"],
    ],
    "anio desc, tramo desc",
  ),
  spec(
    "litigios",
    "Causas judiciales",
    "Poder Judicial / pjud-catalog",
    "litigio",
    [
      ["anio", "Año"],
      ["competencia", "Competencia"],
      ["rol", "Rol municipal"],
      ["n_causas", "Causas"],
    ],
    "anio desc",
  ),
  spec(
    "demografia",
    "Proyección demográfica",
    "INE / Monitor Municipios",
    "proyeccion_poblacion",
    [
      ["anio", "Año"],
      ["poblacion", "Habitantes"],
      ["pct_60mas", "Mayores de 60 %"],
      ["es_estimacion", "Estimación propia"],
    ],
    "anio",
    "and anio in (2025,2026,2035,2050)",
    "2036 en adelante: estimación propia anclada a INE, no censo.",
  ),
  spec(
    "migracion",
    "Población extranjera",
    "Censo / INE",
    "migracion",
    [
      ["anio", "Año"],
      ["extranjeros_total", "Habitantes extranjeros"],
      ["venezuela", "Venezuela"],
      ["peru", "Perú"],
      ["colombia", "Colombia"],
    ],
    "anio desc",
  ),
  spec(
    "mayores",
    "Cuidados de personas mayores",
    "SENAMA / catastro",
    "adulto_mayor",
    [
      ["n_eleam", "ELEAM"],
      ["camas", "Camas"],
    ],
  ),
  spec(
    "patrimonio",
    "Patrimonio",
    "Consejo de Monumentos Nacionales",
    "patrimonio",
    [
      ["monumentos", "Monumentos"],
      ["mh", "Monumentos históricos"],
      ["zt", "Zonas típicas"],
    ],
  ),
  spec(
    "ambiente",
    "Emisiones industriales",
    "RETC / MMA",
    "aire_emision",
    [
      ["anio", "Año"],
      ["contaminante", "Contaminante"],
      ["toneladas", "Toneladas"],
    ],
    "anio desc, toneladas desc",
    "",
    "No incluye emisiones residenciales.",
  ),
  spec(
    "escasez",
    "Escasez hídrica",
    "DGA",
    "escasez_hidrica",
    [
      ["vigente", "Vigencia al cargar"],
      ["decreto_vigente", "Decreto"],
      ["caducidad", "Caducidad"],
      ["anos_bajo_decreto", "Años bajo decreto"],
    ],
    "",
    "",
    "Estado registrado al cargar; revisar caducidad del decreto.",
  ),
  spec(
    "beneficios",
    "Beneficios territoriales",
    "Normativa / Monitor Municipios",
    "beneficio_comuna",
    [
      ["nombre", "Beneficio"],
      ["norma", "Norma"],
      ["monto", "Monto o fórmula"],
      ["destinatario", "Destinatario"],
      ["vigencia", "Vigencia"],
      ["fuente", "Fuente"],
    ],
    "nombre",
  ),
];
const keyCols = {
  seguridad: "indicador",
  gestion: "indicador",
  presupuesto: "cuenta",
  social: "indicador",
};
const latestYear = new Set([
  "delitos",
  "salud",
  "educacion",
  "vivienda",
  "transito",
  "economia",
  "mecanismos",
]);
const limitFor = (id) =>
  id === "concejo"
    ? 1
    : ["actas", "acuerdos", "compras"].includes(id)
      ? 12
      : 100;
const pieces = specs.map((s) => {
  const distinct = keyCols[s.id] ? `distinct on (t.${keyCols[s.id]}) ` : "";
  const latest = latestYear.has(s.id)
    ? `and t.anio=(select max(anio) from ${s.table} where cut=$1)`
    : "";
  const fields = s.fields.map(([name]) => `t.${name}`).join(",");
  const sql = `select ${distinct}${fields}, fc.descargado as loaded_at from ${s.table} t left join fuente_carga fc on fc.id=t.fuente_carga_id where t.cut=$1 ${s.filter} ${latest} ${
    s.order
      ? `order by ${s.order
          .split(",")
          .map((v) => `t.${v.trim()}`)
          .join(",")}`
      : ""
  } limit ${limitFor(s.id)}`;
  return `'${s.id}', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (${sql}) r)`;
});
let client;
try {
  if (!process.env.MUNICIPIOS_REPO)
    throw new Error("MUNICIPIOS_REPO is required");
  const require = createRequire(
    resolve(process.env.MUNICIPIOS_REPO, "package.json"),
  );
  const { Client } = require("pg");
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error("Database configuration missing");
  client = new Client({
    connectionString,
    connectionTimeoutMillis: 20000,
    statement_timeout: 90000,
  });
  await client.connect();
  await client.query(
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  const result = await client.query(
    `select jsonb_build_object(${pieces.join(",")}) as data`,
    [cut],
  );
  await client.query("ROLLBACK");
  const data = result.rows[0].data;
  const sections = specs.map((s) => ({
    id: s.id,
    title: s.title,
    source: s.source,
    note: s.note,
    columns: s.fields.map(([key, label]) => ({ key, label })),
    records: data[s.id],
    limit: limitFor(s.id),
  }));
  const output = resolve(
    process.argv[2] || "public/chile/municipios-13108.json",
  );
  mkdirSync(dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  writeFileSync(
    temp,
    JSON.stringify({
      schemaVersion: 1,
      cut,
      exportedAt: new Date().toISOString(),
      sections,
    }),
    { mode: 0o644 },
  );
  renameSync(temp, output);
  console.log(
    JSON.stringify({
      cut,
      sections: sections.length,
      populated: sections.filter((s) => s.records.length).length,
      records: sections.reduce((n, s) => n + s.records.length, 0),
    }),
  );
} catch (error) {
  // Never emit a connection URL or database error message, which may contain credentials.
  console.error("Monitor Municipios export failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await client?.end();
}
