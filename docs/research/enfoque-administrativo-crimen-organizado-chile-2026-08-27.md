# Chile Monitor: piloto de enfoque administrativo contra el crimen organizado

**Deep research y plan de implementación**

**Fecha de corte:** 27 de agosto de 2026

## Resumen ejecutivo

Chile ya tiene suficientes datos y suficiente infraestructura para iniciar un piloto serio, pero no para construir un “detector de crimen organizado”. Lo viable es un sistema de **priorización de revisiones administrativas**: identifica combinaciones anómalas, arma un expediente trazable y propone qué antecedente revisar o qué organismo competente podría fiscalizar. La calificación jurídica, la inspección y cualquier medida quedan siempre en manos humanas y de la autoridad facultada.

La auditoría de los repositorios muestra una base considerable:

- Mercado Público cubre prácticamente todo el universo histórico relevante: 37,9 millones de órdenes de compra, 105 millones de ítems, 4,2 millones de licitaciones y 23,7 millones de participaciones de oferentes, con reconciliación mensual y reglas de anomalía ya operativas.
- Monitor Municipios aporta las 346 comunas, SINIM 2001–2025, compras municipales, 55.651 observaciones de Contraloría, litigios, autoridades, actas y una primera capacidad de conflictos de interés.
- Inteligencia Ambiental aporta 18.573 expedientes SEIA, 463 mil documentos y una arquitectura madura de linaje, evidencia y evaluación.
- Inteligencia Inmobiliaria documenta un producto nacional en Enigma con aproximadamente 5,9 millones de geometrías prediales y 697 mil paños. Su pipeline de transmisión y agua analiza un subconjunto de 34.522 predios y 64.611 roles; esos números no representan el universo inmobiliario.
- El corpus legal aporta legislación BCN estructurada y búsqueda verificable, aunque todavía carece de un conector productivo de dictámenes CGR.
- `decidechile-pipeline` implementa ingesta y releases para fuentes tabulares compartidas. Nogaleda Alternativos, Inteligencia Ambiental y Claude Legal Chile aportan además patrones productivos que deben reutilizarse: ledger de hechos y autoridad, Data/Capability/Use Case, evals, cadena de custodia de corpus e índices promovibles con reversa.

La brecha no es principalmente tecnológica. Faltan los datos administrativos que conectan una empresa aparentemente lícita con la actuación cotidiana del Estado: **patentes y licencias individualizadas, permisos DOM, fiscalizaciones, clausuras y revocaciones, ejecución y modificaciones de contratos, subsidios, concesiones y arriendos**, todos con historia y claves comunes. También falta el flujo institucional que convierte una señal en revisión, descargo, inspección, decisión y resultado.

La recomendación es un piloto de seis meses, en tres municipios y sobre un problema acotado: **integridad de compras y habilitación municipal de proveedores/establecimientos**, enriquecido con ciclo de vida societario, permisos DOM, antecedentes ambientales y territoriales. `chile-monitor` debe ser la capa operacional que compone capabilities y abre releases fijados. Cada monitor conserva su fuente de verdad; `decidechile-pipeline` se usa sólo donde ya corresponde para fuentes tabulares compartidas.

## Qué significa “tener el dato”

La cobertura se auditó en tres niveles:

1. **Disponible:** existe una fuente o un dataset local.
2. **Integrado:** está normalizado, versionado, con claves y controles de calidad.
3. **Apto para decisión:** tiene historia, procedencia y detalle suficientes para respaldar una revisión administrativa.

Los porcentajes siguientes son una **estimación de madurez del inventario**, no una medición estadística de cobertura nacional. De quince familias críticas, hoy hay cuatro en nivel A, seis en B y cinco en C. Aproximadamente **dos tercios del sustrato analítico están disponibles o parcialmente disponibles**, pero sólo **un tercio está listo para una decisión administrativa**.

| Familia de datos | Disponible | Integrado | Apto para decisión | Diagnóstico y brecha principal |
|---|---:|---:|---:|---|
| Compras y licitaciones públicas | A | A | A− | Muy alta cobertura y QA. Falta completar ejecución contractual, cotizaciones y subcontratos. |
| Proveedores y beneficiarios finales | B+ | B | B | ChileCompra ya usa beneficiarios finales; falta acceso masivo versionado, porcentaje/control e historia efectiva. |
| Registro de Empresas y Sociedades | A− | B | B | La descarga pública trae eventos societarios básicos; no entrega por sí sola una red histórica completa de socios y administradores. |
| Finanzas y desempeño municipal | A | A | B+ | SINIM y métricas nacionales fuertes; son agregados, no actos individualizados. |
| Auditorías CGR y litigios | A− | B+ | B | Buen corpus municipal, pero falta exportación uniforme por hallazgo, seguimiento y conector de dictámenes. |
| Patentes y licencias municipales | B− | C | C | Hay ingresos agregados SINIM y publicaciones dispersas; falta registro nacional nominativo e histórico. |
| Permisos y autorizaciones DOM | B | C+ | C+ | Existe obligación de publicación mensual en CSV, pero no una ingesta nacional consolidada ni historia depurada. |
| Fiscalizaciones, sanciones, clausuras y revocaciones | B− | C | C | Fragmentadas por organismo; son la etiqueta operacional más importante que hoy falta. |
| Ejecución contractual y pagos | B | B− | B− | Hay OC y algunos estados; faltan recepciones, multas, modificaciones, garantías, cesiones y término efectivo. |
| Subsidios, concesiones, arriendos y permisos sectoriales | B− | C | C | Publicación heterogénea, sin identidad y temporalidad comunes. |
| SEIA, fiscalización y sanción ambiental | A− | A− | B+ | SEIA muy sólido; SMA abierta pero requiere crosswalk, historia y validación de datos reportados por regulados. |
| Catastro, parcelas y contexto territorial | A− | B+ | B | Buen cruce geoespacial; cartografía SII es referencial y los datos de propietarios requieren régimen restringido. |
| Derechos de agua e infraestructura | A− | B | B− | Fuentes oficiales accesibles; DGA advierte que el registro no prueba titularidad vigente. |
| Normativa y jurisprudencia administrativa | A− | B+ | B | BCN fuerte; faltan dictámenes CGR y validación jurídica de reglas específicas. |
| Padrón electoral individual | A | — | **Excluido** | No aporta una finalidad necesaria y proporcional; eleva radicalmente el riesgo de perfilamiento personal. Sólo usar agregados comunales. |

## Comparación europea y planes individuales en Chile Monitor

La ENAA no propone una gran base policial europea. Promueve coordinación entre autoridades administrativas, fiscalizadoras y policiales, intercambio legal de información y uso más eficaz de facultades existentes. Su hoja de ruta insiste en inspecciones coordinadas donde cada servicio actúa bajo su propia competencia. Es una distinción esencial para Chile: el sistema debe preparar evidencia y coordinación, no simular facultades públicas. [ENAA](https://administrativeapproach.eu/about-enaa/who-we-are) y su [roadmap de implementación](https://administrativeapproach.eu/sites/default/files/publication/files/2304_PAPER_ENG_Roadmap_LR.pdf).

| Línea europea | Qué hace Europa | Plan individual colgado de Chile Monitor | Datos actuales y faltantes | Calidad y control | Salida operacional |
|---|---|---|---|---|---|
| **1. Bibob, Países Bajos: debida diligencia antes de permisos y contratos** | La autoridad revisa integridad antes de conceder permisos, subsidios o contratos y puede pedir un análisis especializado. | **Módulo “Debida diligencia administrativa”**: expediente previo a adjudicación, renovación de patente o concesión. Reglas determinísticas sobre ciclo societario, concentración contractual, sanciones, domicilios y coherencia de actividad. | Ya: compras, RES básico, CGR, litigios. Falta: patentes, permisos, beneficiarios finales versionados, sanciones sectoriales, ejecución contractual. | 100% de hechos con fuente/fecha; RUT válido ≥99%; ninguna decisión automática; revisión y descargo registrados. | Informe “revisar / solicitar antecedentes / sin observaciones”, nunca “empresa criminal”. |
| **2. RIEC/LIEC, Países Bajos: centro regional de información y expertise** | Diez centros regionales y uno nacional articulan estrategia administrativa, tributaria y penal. | **Módulo “Mesa territorial”**: bandeja de casos por región/comuna, roles, permisos, bitácora y paquetes compartibles por ámbito. Chile Monitor muestra; el plano de datos aplica scopes. | Ya: CUT, autoridades, compras, actas, geografía. Falta: acuerdos de intercambio, catálogo de competencias, directorio y SLA de cada organismo. | Acceso por rol, propósito, minimización, logs inmutables, exportaciones con marca y caducidad. | Reunión de triage con decisiones y responsables; no acceso indiscriminado a una “mega-base”. |
| **3. ARIEC, Bélgica: equipos pequeños de apoyo a municipios** | Equipos regionales —incluyendo perfiles jurídico, criminológico y de información— ayudan a gobiernos locales. | **Módulo “Unidad de apoyo municipal”**: plantillas de consultas, análisis de redes, fundamento legal y seguimiento de solicitudes. Equipo piloto: analista de datos, abogado administrativo y coordinador municipal. | Ya: Monitor Municipios y corpus legal. Falta: dictámenes CGR, ordenanzas, procedimientos locales, resultados históricos. | Toda regla debe tener ficha jurídica, dueño, fecha de revisión y test de falsos positivos. | Recomendación explicada para alcalde/DOM/rentas/control, con competencia y próximo paso. |
| **4. Flex-actions, Bélgica: fiscalización conjunta** | Vivienda, seguridad contra incendios, trabajo, salud y policía inspeccionan coordinadamente; cada cual usa su potestad. | **Módulo “Operativo coordinado”**: checklist, mapa del establecimiento, antecedentes, hipótesis alternativas, riesgos de seguridad y acta de resultados. | Ya: propiedad/contexto territorial, permisos ambientales, empresa y compras. Falta: patentes, DOM, fiscalizaciones laborales/sanitarias/incendio, clausuras y horarios. | Separar dato previo de hallazgo en terreno; cadena de custodia documental; no inferir infracción por ausencia de dato. | Paquete previo y acta posterior; Chile Monitor aprende sólo del resultado validado. |
| **5. Italia: controles antimafia en obras y contratación** | Prefecturas integran bases, listas, protocolos de legalidad, seguimiento financiero y controles de obra. | **Módulo “Integridad de obra pública”**: contrato→proveedor→subcontratista→predio→permiso→avance→pago; alertas de fragmentación, cambios societarios, concentración y multas. | Ya: compras, licitaciones, predios, SEIA, DOM parcial. Falta: subcontratos, estados de pago, garantías, modificaciones, recepción, dotación y beneficiario efectivo histórico. | Reconciliar monto adjudicado/OC/pagado; completitud por etapa; snapshot societario válido a fecha del acto. | Expediente por obra y alerta temprana antes del siguiente pago o modificación. |
| **6. Italia: verificación documental y en terreno** | Se contrasta la documentación con la realidad operacional y el avance físico. | **Módulo “Verificación de existencia y ejecución”**: coherencia entre giro, patente, domicilio, permiso, huella territorial, contrato y evidencia pública. No usa “direcciones compartidas” como culpabilidad. | Ya: domicilios RES limitados, cartografía, imágenes/documentos públicos, actas. Falta: establecimientos vigentes, visitas, fotos oficiales georreferenciadas y recepciones. | Geocodificación con nivel de confianza; fechas de vigencia; revisión humana de homónimos y edificios multiempresa. | Lista de verificaciones concretas, no score opaco. |
| **7. Suecia/EMPACT: operaciones administrativas conjuntas por sector** | Acciones conjuntas enfocadas en sectores vulnerables —incluida salud— y uso coordinado de reguladores. | **Módulo “Campaña sectorial”**: seleccionar un sector y construir barreras específicas; primera campaña recomendada: construcción/mantención municipal, no todos los sectores a la vez. | Ya: categorías de compra, empresas, territorio, permisos ambientales. Falta: registros sectoriales, acreditaciones, personal habilitado y sanciones. | Línea base sectorial; muestreo de control; precisión@20 y tasa de explicación alternativa. | Campaña trimestral con universo, reglas, muestra revisada, hallazgos y mejoras regulatorias. |
| **8. Modelo de barreras ENAA** | Descompone el proceso criminal en pasos, facilitadores, actores y barreras administrativas. | **Módulo “Diseñador de barreras”**: mapa versionado de actividad→trámite→dato→competencia→medida→resultado. Cada caso y señal debe vincularse a una barrera. | Ya: fuentes multitemáticas y corpus legal. Falta: talleres con organismos y evidencia de efectividad de cada medida. | Versión, responsable, base legal, indicadores y fecha de retiro; prohibido mantener señales que no mejoran decisiones. | Biblioteca reusable para patentes, obras, residuos, alcohol, comercio y contratación. |

Los ejemplos europeos de [RIEC/ARIEC](https://administrativeapproach.eu/administrative-approach/riecariec), [Bélgica](https://administrativeapproach.eu/publications/field-visit-belgium), [Italia](https://administrativeapproach.eu/publications/field-visit-italy-winter-olympic-games-2026) y [EMPACT 2026](https://administrativeapproach.eu/publications/empact-action-days-prevention-and-administrative-approach) respaldan estas correspondencias. Son referencias de diseño, no instituciones que puedan trasplantarse sin una base legal chilena.

## Arquitectura integrada

### Distribución de responsabilidades

```text
 Autoridades oficiales y solicitudes de transparencia
                         │
        releases promovidos + quality reports
                         │
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
 Mercado/Municipios   Ambiental/Inmob.    Legal Chile
 stores y releases    PostGIS/OpenSearch  corpus/FTS/vector
       └─────────────────┼──────────────────┘
                         ▼
        capabilities + envelopes + DataRelease fijado
                         ▼
 Chile Monitor: fuentes + calidad + mapa + expedientes + flujo
```

`chile-monitor` no debe ingerir ZIP, documentos, geometrías ni reconciliar nuevamente los 37 millones de compras. Debe confiar en los releases promovidos por cada producto, consumir capabilities y mostrar el release fijado, su quality report y frescura. El patrón se toma de tres precedentes existentes: autoridad/hechos/CURRENT/rollback de Nogaleda, Data/Capability/Use Case de Ambiental y releases servidos por la API de Legal Chile. La cadena raw permanece bajo responsabilidad del productor; sólo las fuentes nuevas recorren una ingesta completa.

La decisión de producto tiene un Gate 0 adicional: Chile Monitor deriva de World Monitor y usa AGPL-3.0. Antes de desplegar una instancia cerrada o integrar código con productos propietarios hay que resolver cumplimiento de licencia, estrategia de fork/upstream y costo de mantener una base muy amplia para un caso chileno.

### Modelo mínimo, temporal y trazable

No conviene crear otro grafo estático. Se necesita un modelo de eventos:

- `entity` e `identity`: persona jurídica, órgano, establecimiento, contrato, predio; RUT normalizado y CUT cuando corresponda.
- `relationship`: socio, beneficiario, administrador, contratista o vínculo, con `valid_from`, `valid_to`, fuente y nivel de confianza.
- `administrative_event`: constitución, modificación, patente, permiso, inspección, sanción, pago, revocación o término.
- `artifact`: acto, resolución, contrato, informe, CSV o página fuente, con hash.
- `signal`: regla versionada, hechos que la activaron y explicaciones alternativas.
- `case`, `review`, `referral`, `outcome`: flujo humano y resultado verificable.
- `source_run` y `quality_assertion`: identidad del snapshot, checks y linaje.

Claves canónicas iniciales: RUT normalizado; CUT de comuna; IDs de compra/licitación/contrato; ID RES y fecha de actuación; rol SII y `gkey` separados; expediente SEIA; ID de patente/permiso y establecimiento. El rol tributario no debe confundirse con geometría ni un domicilio con una empresa.

### Tres zonas de información

| Zona | Contenido | Publicación |
|---|---|---|
| Pública | Cobertura, frescura, estadísticas, metodología, reglas y resultados agregados | Web abierta, sin rankings nominativos |
| Analista restringida | Entidades identificables provenientes de fuentes lícitas, expedientes y revisiones | Acceso por rol, propósito, auditoría y plazos de retención |
| Autoridad bajo convenio | Datos no públicos, resultados de inspección o cruces protegidos | Sólo organismo competente; no pasan al plano publicable |

Mallas y Audiencias pueden enriquecer investigación interna únicamente si licencias, finalidad y trazabilidad lo permiten. Nunca deben ser el fundamento único de una alerta pública ni copiarse al `decidechile-pipeline` publicable.

## Solicitudes de transparencia y adquisición de datos

La Ley 20.285 contempla un plazo ordinario de veinte días hábiles, prorrogable excepcionalmente por diez. El trabajo debe manejarse como un producto de datos: cada solicitud tiene esquema esperado, cobertura, respuesta, recurso, parser, control y SLA. [Ley de Transparencia](https://www.bcn.cl/leychile/Navegar?idNorma=276363).

### Paquete municipal para tres comunas piloto

Solicitar 2021–2026 en CSV/XLSX, con diccionario y frecuencia de actualización:

1. **Patentes y licencias:** ID, RUT de persona jurídica, razón social, nombre de fantasía, giro, dirección/rol, fecha de otorgamiento y renovación, estado, acto, caducidad, suspensión o revocación. Para titulares personas naturales, pedir una salida minimizada o seudonimizada y conservar la identificable sólo si existe base legal.
2. **Permisos DOM:** ID, tipo, solicitante persona jurídica, dirección/rol, fechas, estado, modificaciones, caducidad, recepción y enlace al acto. La obligación de publicar mensualmente los permisos del artículo 116 bis C en planilla permite priorizar primero recolección de transparencia activa y solicitar sólo historia/faltantes. [Plantillas CPLT](https://www.consejotransparencia.cl/portal-de-transparencia/plantillas/).
3. **Fiscalizaciones:** establecimiento/ID de patente o permiso, fecha, unidad, materia, resultado, infracción, medida, clausura/reapertura y acto; sin datos personales innecesarios de denunciantes o trabajadores.
4. **Concesiones, arriendos, comodatos y subvenciones:** beneficiario jurídico, monto/bien, objeto, acto, vigencia, modificaciones, incumplimientos y término.
5. **Ejecución contractual:** contrato, proveedor, subcontratistas declarados, estados de pago, recepción, multas, garantías, modificaciones, cesiones y término anticipado.

### Solicitudes y convenios nacionales

- **ChileCompra:** exportación histórica/versionada de declaraciones de beneficiario final, porcentajes/control, vigencia y sanciones; cotizaciones y participantes de Compra Ágil; modificaciones y ejecución contractual. El Observatorio ya demuestra valor: detectó 1.131 órdenes por $3.452 millones con potenciales conflictos y ha automatizado alertas de fragmentación. [Conflictos](https://www.chilecompra.cl/2026/01/chilecompra-detecta-potenciales-conflictos-de-interes-por-3-452-millones-tras-cruce-de-datos-masivo/) y [fragmentación](https://www.chilecompra.cl/2026/05/nuevo-panel-del-observatorio-levanta-alertas-por-casi-40-mil-millones-en-fragmentacion-en-compra-agil/).
- **Ministerio de Economía/RES:** actuaciones históricas completas, modificaciones, disoluciones y campos societarios legalmente publicables. El [dataset público RES](https://datos.gob.cl/es/dataset/registro-de-empresas-y-sociedades) es el baseline; no debe confundirse con escrituras enriquecidas internas.
- **Contraloría:** exportación por hallazgo con entidad, tema, severidad, recomendación, enlace y estado de cumplimiento; API o dump de dictámenes para completar el monitor legal.
- **SMA/SEA/DGA:** identificadores/RUT jurídicos estables, historia y crosswalk. Los [datos abiertos SMA](https://snifa.sma.gob.cl/DatosAbiertos) y los [derechos registrados DGA](https://dga.mop.gob.cl/derechos-de-agua/derechos-registrados/) deben conservar sus advertencias de calidad y alcance.
- **SII:** inicio de actividades, giros y domicilio tributario sólo mediante base jurídica/convenio. No intentar obtener información protegida por secreto tributario vía transparencia.
- **UAF y Ministerio Público:** establecer canal autorizado de derivación. No pedir ROS ni antecedentes de investigaciones reservadas.

Chile Monitor debe incluir `/chile/transparencia`: solicitud, organismo, dataset, estado, fecha límite, respuesta, recurso, cobertura obtenida, parser y último release. Esto hace visible que un vacío de datos no equivale a ausencia de riesgo.

## Medidas de calidad

Cada fuente debe tener un contrato con seis dimensiones mínimas:

| Dimensión | Métrica/gate inicial |
|---|---|
| Cobertura | comunas, períodos y tipos de acto; no se publica “nacional” bajo 340/346 comunas sin etiqueta explícita |
| Completitud | RUT/CUT/fecha/acto/estado; campos críticos ≥95% o bloqueo según fuente |
| Validez | RUT con dígito verificador ≥99%; fechas y estados dentro de catálogo; geometrías válidas |
| Unicidad e integridad | duplicados por clave; `IN = OUT + DROP`; toda caída con razón; relaciones apuntan a entidades existentes |
| Consistencia | montos OC/contrato/pago; fechas societarias y administrativas; rol y geometría no intercambiables |
| Frescura y linaje | última observación upstream, hash, `Last-Modified`, parser, release, fuente y enlace |

Además:

- Baselines estacionales sólo se activan con historia suficiente; hoy el control plane declara que ChileCompra aún está en `collecting`, por lo que no se deben inventar bandas de normalidad.
- Toda señal tiene conjunto de casos conocidos, muestra negativa y revisión de precisión. El objetivo inicial es **precision@20**, no “accuracy” sobre un universo sin etiquetas.
- Medir tiempo ahorrado, anticipación respecto del hallazgo, porcentaje de expedientes con hipótesis alternativa y tasa de señales retiradas.
- Una ausencia en transparencia activa genera `data_gap`, no una alerta sobre la entidad.
- Los modelos de lenguaje sólo extraen o resumen documentos ambiguos; no asignan riesgo ni sustituyen reglas y evidencia.

## Señales para el MVP

El piloto debe comenzar con 10–12 reglas explicables y reconstruir casos históricos antes de operar en prospectivo:

- compras repetidas del mismo organismo/proveedor/categoría bajo umbral en ventanas cortas;
- proveedor con constitución o cambio material próximo a adjudicación;
- concentración extrema organismo–proveedor, ajustada por distribuidores nacionales y tamaño del mercado;
- adjudicación seguida de cambio de domicilio, socios/beneficiarios o disolución;
- contrato u OC material sin patente/giro/permiso coherente, sólo cuando la cobertura municipal sea comprobada;
- múltiples entidades jurídicas vinculadas que comparten establecimiento y compiten/contratan en el mismo mercado, con revisión de explicaciones lícitas;
- multas, término, sanción o hallazgo CGR seguido de nueva contratación o renovación administrativa;
- divergencia entre permiso/recepción/SEIA y objeto o lugar de ejecución;
- modificaciones, pagos o fragmentación que superan umbrales de control;
- concentración de patentes sensibles, permisos o contratos en una red y territorio acotados.

Ninguna regla aislada prueba ilícito. Los expedientes deben mostrar hechos, fechas, documentos, limitaciones y el antecedente exacto que falta.

## Plan por etapas

### Etapa 0 — Fundamento y diseño (0–4 semanas)

- Nombrar dueño institucional del piloto y tres municipios socios.
- Evaluación de impacto en protección de datos, finalidad, base jurídica, retención, derechos y respuesta a incidentes.
- Resolver AGPL/fork/upstream de Chile Monitor.
- Mapear cada dominio a manifests, capabilities y releases existentes; registrar en `decidechile-pipeline` sólo las fuentes tabulares que realmente usen su runtime.
- Definir taxonomía de barreras y diez casos históricos conocidos.
- Redactar solicitudes de transparencia y convenios.

**Gate:** no avanzar sin autoridad que pueda revisar/actuar, fundamento jurídico y protocolo de derivación.

### Etapa 1 — Integrar lo existente y medirlo (4–8 semanas)

- Variante `chile` de Chile Monitor con `/fuentes`, `/calidad`, `/casos` y `/transparencia`.
- Releases Gold de compras, municipios, RES, CGR/litigios, SEIA/SMA y contexto inmobiliario.
- Modelo temporal de entidades/eventos y expedientes de evidencia.
- Reconstrucción ciega de diez casos históricos y clasificación de falsos positivos.

**Gate:** procedencia completa, reconciliación y evidencia útil en al menos 8/10 casos; no alertas públicas nominativas.

### Etapa 2 — Cerrar la brecha administrativa (8–16 semanas)

- Ingesta de patentes, DOM, fiscalizaciones y ejecución contractual de tres municipios.
- Crosswalk de establecimientos, direcciones, roles y RUT jurídicos.
- 10–12 reglas determinísticas; cola de revisión y registro de descargos.
- Campaña sectorial acotada a construcción/mantención municipal.

**Gate:** cobertura de los tres municipios ≥90% en período acordado, RUT válido ≥99%, precision@20 aceptada por equipo jurídico/operacional y cero decisiones automáticas.

### Etapa 3 — Operación controlada (16–24 semanas)

- Bandeja de triage y paquete para inspección coordinada.
- Ejecución de una campaña con autoridades competentes.
- Captura estructurada de inspección, medida, descargo y resultado.
- Auditoría externa de privacidad, sesgo, seguridad y utilidad.

**Gate:** cada señal revisada; resultados y tiempos medidos; proceso de rectificación probado; capacidad real para absorber la carga.

### Etapa 4 — Escala regional (6–12 meses)

- Unidad tipo ARIEC chilena, primero como convenio de apoyo, no como nueva policía de datos.
- Incorporar nuevas regiones/sectores sólo con contrato y baseline.
- Añadir barreras ambientales, inmobiliarias, residuos, alcohol u otros sectores según evidencia.
- Publicar metodología, cobertura y resultados agregados; compartir expedientes nominativos sólo por canal autorizado.

## Reportería en línea

Chile Monitor debiera ofrecer:

- `/chile/fuentes`: disponibilidad, licencia, clasificación, períodos, geografía, frescura y fallas.
- `/chile/calidad`: checks, reconciliación, drift, cobertura y último release bueno.
- `/chile/transparencia`: cartera de solicitudes y brechas.
- `/chile/municipio/:cut`: barreras y métricas agregadas.
- `/chile/casos`: flujo restringido con evidencia, revisión, derivación y resultado.
- `/chile/red/:rut`: vista restringida, temporal y explicable; nunca un ranking público.
- `/chile/campanas/:id`: universo, reglas, muestra, resultados y aprendizaje.

El tablero ejecutivo debe privilegiar cinco KPI: cobertura apta para decisión; frescura; precisión de revisión; días de anticipación; y porcentaje de derivaciones que generan una actuación válida. Contar “alertas” incentiva ruido.

## Límites legales y éticos

La Ley 21.719 entra en vigencia el 1 de diciembre de 2026 e impone protección desde el diseño. La combinación o clasificación de datos personales obtenidos de fuentes públicas sigue protegida; las decisiones automatizadas significativas exigen información, explicación, intervención humana y revisión. Esto vuelve técnicamente incorrecto y jurídicamente riesgoso un score público de riesgo. [Ley 21.719](https://www.bcn.cl/leychile/navegar?i=1209272).

La Ley 21.802 fortalece el papel preventivo y colaborativo municipal, pero no entrega a los municipios funciones policiales exclusivas. El piloto debe mapear cada recomendación a una potestad concreta y escalar los indicios penales a la autoridad competente. [Ley de Seguridad Municipal](https://www.bcn.cl/leychile/navegar?idNorma=1221320).

Los organismos públicos obligados por la Ley 19.913 deben reportar a la UAF operaciones sospechosas que adviertan en el ejercicio de sus funciones. Chile Monitor puede estructurar antecedentes para el organismo; no reemplaza su análisis ni accede a los reportes reservados. [Ley 19.913](https://www.bcn.cl/leychile/navegar?idNorma=219119).

El padrón electoral individual queda fuera. Tampoco se debe publicar parentesco, domicilio personal, edad o perfiles de personas naturales sólo porque algún antecedente sea accesible. La unidad principal del piloto son actos, contratos, personas jurídicas y establecimientos, con minimización estricta de personas naturales.

## Decisión recomendada

Sí: `chile-monitor` es un buen lugar para partir **como producto operacional**, siempre que no se lo convierta en el repositorio maestro de datos. La secuencia recomendada es:

1. aceptar el diseño federado: cada dominio conserva su autoridad y Chile Monitor consume capabilities y releases fijados;
2. escoger tres municipios y un socio público con facultades;
3. ejecutar Etapa 0 y lanzar de inmediato las solicitudes de patentes, DOM, fiscalizaciones y ejecución contractual;
4. construir la variante chilena sólo hasta fuentes/calidad/casos/transparencia;
5. validar con casos históricos antes de emitir alertas prospectivas.

El activo diferencial de DecideChile no será “más IA”. Será unir compras, actos municipales, empresas y territorio con historia, evidencia y calidad suficiente para que una autoridad cierre una puerta administrativa antes de que el sistema penal llegue tarde.

## Fuentes y activos auditados

Fuentes oficiales principales: [ENAA](https://administrativeapproach.eu/about-enaa/who-we-are), [modelo de barreras](https://administrativeapproach.eu/administrative-approach/barrier-model), [ChileCompra API](https://www.chilecompra.cl/api/), [sanciones de proveedores 2026](https://www.chilecompra.cl/2026/03/chilecompra-aplica-sanciones-a-39-proveedores-por-infracciones-al-reglamento-de-compras/), [RES](https://datos.gob.cl/es/dataset/registro-de-empresas-y-sociedades), [CPLT](https://www.consejotransparencia.cl/portal-de-transparencia/plantillas/), [SMA](https://snifa.sma.gob.cl/DatosAbiertos), [DGA](https://dga.mop.gob.cl/derechos-de-agua/derechos-registrados/) y la [columna de Luis Cordero](https://www.theclinic.cl/2026/07/12/columna-de-luis-cordero-mas-que-jueces-y-fiscales/).

Repositorios locales auditados en modo lectura: `chile-monitor`, `decidechile-pipeline`, `monitor-mercado-publico`, `monitor-municipios`, `inteligencia-ambiental`, `inteligencia-inmobiliaria-pipeline`, `claude-for-legal-chile`, `gran-mapa-datos-chile` y documentación interna de RES/Mallas. Las cantidades corresponden a la documentación y snapshots locales disponibles a la fecha de corte; antes de un anuncio público deben reproducirse desde releases firmados por el plano de control.
