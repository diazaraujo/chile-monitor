# Plan data-first para el enfoque administrativo

**Fecha:** 28 de agosto de 2026

**Horizonte inicial:** 16 semanas

**Objetivo:** mejorar disponibilidad, identidad, historia y calidad de los datos antes de desarrollar señales operacionales contra el uso criminal de infraestructura legal.

## Decisión de diseño

El programa debe comenzar por datos y no por modelos de riesgo. Durante las primeras doce semanas no se construirá un score de crimen organizado. El resultado será una red federada de capacidades y releases versionados que permita responder preguntas administrativas concretas:

- ¿Qué persona jurídica recibió qué contrato, permiso, patente o beneficio, cuándo y bajo qué acto?
- ¿Qué establecimiento, predio y comuna corresponden al acto?
- ¿Qué cambió después en la empresa, el contrato o la autorización?
- ¿Qué fiscalización, sanción, revocación o resultado ocurrió?
- ¿Qué parte del dato falta y qué organismo debería tenerla?

La arquitectura ya existe, distribuida entre tres implementaciones maduras. No se construirá otro warehouse, ledger ni orquestador transversal. Cada dominio conservará su fuente de verdad y adoptará un contrato común mínimo para exponer fuentes, hechos, capacidades, calidad y releases. `decidechile-pipeline` seguirá siendo útil para ingestas tabulares compartidas, pero no absorberá PostGIS, OpenSearch, el corpus legal ni los ledgers de cada producto. Chile Monitor consumirá capacidades y releases; no leerá tablas internas ni volverá a calcular hechos.

## Arquitecturas existentes que se reutilizan

### 1. Nogaleda Alternativos: evidencia, hechos, autoridad y publicación

La reformulación reciente de Nogaleda ya resolvió buena parte de los problemas que este piloto enfrentará:

- censo completo de fuentes y documentos antes de extraer;
- documento canónico ligado a la representación física y su SHA-256;
- hechos candidatos tipados, inmutables, con ancla, alcance, vigencia y precedencia;
- candidatos aceptados, rechazados, superseded o en conflicto, sin borrar al perdedor;
- separación estricta entre evidencia documental, evidencia transaccional y workflow;
- corridas, artifacts y revisiones append-only, con replay y hashes;
- `DataRelease` como conjunto cerrado, promoción atómica por CAS, puntero `CURRENT` y rollback exacto;
- expand-contract, shadow diff y canarios antes del cutover;
- decisiones humanas derivadas de sesión/autoridad del servidor, nunca declaradas por el cliente;
- fail-closed: `partial`, `blocked` o evidencia obsoleta no publican.

**Aplicación aquí:** patente, permiso, contrato, inspección o sanción serán hechos administrativos con evidencia y vigencia. Una alerta no editará esos hechos ni adquirirá autoridad por sí misma. Chile Monitor abrirá un release fijo y mostrará exactamente las fuentes que lo sostienen.

### 2. Inteligencia Ambiental: Data Layer → Capability Layer → Use Case Layer

Ambiental ya implementa el desacople correcto:

- Bronze append-only con hash y blobs originales;
- Silver con modelo de dominio, `pipeline_version`, `source_hash`, método de extracción y confianza;
- Gold especializado en Postgres/PostGIS, OpenSearch y materializaciones;
- capabilities con schemas tipados, API estable, lineage y evals propios;
- casos de uso que componen capabilities sin tocar el core;
- regex/catálogos primero y LLM sólo para campos ambiguos;
- golden sets con precisión, recall, F1 y bloqueo ante degradación;
- wiki/proyecciones con citas obligatorias al documento fuente.

**Aplicación aquí:** `identity.resolve`, `administrative.timeline`, `procurement.integrity`, `gis.context`, `legal.authority` y `evidence.packet` serán capabilities, no tablas que cada interfaz vuelva a implementar. El piloto de crimen organizado será un Use Case que las compone.

### 3. Claude Legal Chile: cadena de custodia del corpus y serving verificable

Legal Chile aporta el patrón para fuentes masivas y productos derivados:

```text
autoridad oficial → manifest → raw en disco → texto normalizado → índice FTS/vectorial → API servida
```

Cada salto se reconcilia por denominador. Sus incidentes muestran por qué no basta contar la tabla final: el corpus descubrió universos omitidos, archivos descargados que no llegaron al servidor, base64 que era 91,9% del texto, documentos duplicados en FTS y un índice FAISS descalzado de su lista de rutas. La promoción actual exige conteos, pares índice/rutas construidos juntos, smoke de comportamiento, backup y reversa.

**Aplicación aquí:** Legal Chile seguirá siendo responsable de esa cadena. Chile Monitor confiará en su release promovido y consumirá la API read-only con sus citas y estado de calidad; no descargará normas, reconstruirá índices ni copiará el corpus. La cadena completa se exige sólo al productor de una fuente nueva.

### Contrato común mínimo

No se unificarán los stores. Se unificará el envelope que cada capacidad publica:

| Pieza | Precedente | Contenido mínimo |
|---|---|---|
| `SourceManifest` | Legal Chile + Inmobiliaria | productor, `upstream_release_id`, autoridad, cobertura declarada, quality report, licencia, clasificación y referencias a linaje/raw sin copiarlo |
| `ProcessingArtifact` | Ambiental + Nogaleda | capability/etapa, input/output hash, versión, estado, método, costo y error |
| `AdministrativeFact` | ledger de Nogaleda | tipo, entidad, valor/estado, `effective_at`, `observed_at`, fuente, ancla, precedencia y disposición |
| `CapabilityContract` | Ambiental | input/output tipado, semver, lineage, evals, scopes y SLA |
| `DataRelease` | Nogaleda | conjunto cerrado de artifacts, watermark, calidad, puntero CURRENT, predecessor y rollback |
| `EvidencePacket` | Nogaleda + wiki Ambiental | hechos consumidos, citas, limitaciones, conflictos, gaps y revisión humana |

Estos nombres describen interfaces; no obligan a crear seis tablas centrales. Cada repositorio puede mapear sus modelos actuales al envelope y conservar su implementación interna.

## Regla de confianza y no reingesta

Chile Monitor no vuelve a consumir los archivos que ya procesaron los productos de dominio. La frontera de confianza es el release promovido por su productor:

| Estado upstream | Tratamiento en el piloto |
|---|---|
| `promoted/trusted` | Consumir `release_id`, contrato, quality report y API/vista read-only. No reingestar ni repetir QA de dominio. |
| `shadow/candidate` | Puede usarse para desarrollo y comparación, nunca para una actuación administrativa. |
| `legacy` estable sin envelope | Envolver el snapshot/endpoint actual una sola vez y declarar sus límites; no copiar el corpus. |
| `blocked/partial/stale` | Mantener el último release bueno o mostrar indisponibilidad; no reconstruirlo desde Chile Monitor. |
| Fuente nueva | El productor designado sí ejecuta autoridad→manifest→raw→Silver→capability→release. |

La validación transversal cubre sólo el **contrato de frontera** y el **cruce nuevo**. Por ejemplo, no se recalculan los 5,9 millones de predios: se verifica que `parcel.resolve` responde al release declarado y que una nueva unión patente→establecimiento→predio conserva IDs, vigencias y tasas de match explicables.

## Qué aporta realmente Inteligencia Inmobiliaria

Sí es una columna central del plan. La auditoría encontró dos universos que deben mantenerse separados:

| Capa | Magnitud documentada | Uso correcto | Límite actual |
|---|---:|---|---|
| Producto inmobiliario nacional en Enigma | 5.925.647 geometrías `predio`; 697.527 `pano`; 697.527 registros `valor` | Contexto predial, armado territorial, avalúos y localización | El inventario compartido todavía no reconoce claramente al productor vigente ni sus fuentes |
| Roles asociados | La relación rol–geometría puede ser muchos-a-uno | Vincular identidad tributaria con unidad geométrica sin duplicar áreas o largos | Un rol no es una geometría; una geometría de Vicuña contiene 733 roles |
| Subconjunto línea/cauce | 34.522 predios; 64.611 roles; 15.952,9 km de línea | Analizar predios tocados por transmisión e hidrografía | No representa el universo inmobiliario nacional |
| Transporte | 34.926 paradas; 2.055–11.663 paños candidatos según definición | Contexto de accesibilidad y cambios regulatorios | Falta red caminable y clasificación oficial de ejes estructurantes |
| Coquimbo, conjunto dorado | 2.645 predios y 4.085 roles, verificados por PostGIS y GDAL | Regresión independiente y calibración | Las otras quince regiones están fijadas, no verificadas independientemente |

Las prácticas que el productor inmobiliario ya garantiza y que el piloto debe respetar son: raw con SHA-256, denominador consultado al origen, manifiesto que no permite fuentes silenciosamente ausentes, `IN = OUT + DROP`, geometría en `geography`, regresiones que realmente fallan y separación entre dato público y atributos de propietarios. Chile Monitor recibe la declaración y el release resultante; no repite esas operaciones.

## Principios de ordenamiento

1. **Release antes que archivos:** para datos existentes se consume la salida promovida y su quality report; sólo el productor inspecciona raw y manifiestos internos.
2. **Identidad antes que cruce:** no unir por nombre libre si existe RUT, CUT, ID de acto, rol o identificador fuente.
3. **Tiempo antes que red:** una relación societaria, patente o contrato debe tener vigencia; una foto actual no explica un acto de 2022.
4. **Denominador antes que cobertura:** “345 comunas” sólo vale si sabemos cuántas debían existir y para qué período.
5. **Ausencia no es infracción:** falta de publicación genera `data_gap`, no una señal contra una empresa.
6. **Dato personal separado:** propietarios, personas naturales y parentescos permanecen restringidos y minimizados.
7. **Resultado antes que machine learning:** primero registrar revisión, descargo, fiscalización y medida; después evaluar si existen etiquetas suficientes.
8. **Capability antes que integración directa:** Chile Monitor consume contratos estables; no hace joins contra tablas internas de otros productos.
9. **Release antes que “latest”:** toda vista operacional abre un release coherente y reproducible, no el último registro disponible de cada fuente.

## Priorización de datos

Se usará una combinación de valor administrativo, reutilización entre monitores, factibilidad y riesgo legal.

| Prioridad | Paquete | Estado | Por qué va en este orden |
|---:|---|---|---|
| P0 | Catálogo de fuentes, clasificación y contratos | Parcial | Sin autoridad y versión no existe trazabilidad ni release confiable |
| P0 | Identidad territorial y de organismos | Parcial/duplicada | CUT, municipio, unidad compradora y región conectan todos los dominios |
| P0 | Identidad jurídica temporal | Parcial | RUT normalizado + eventos RES + beneficiario efectivo son la columna empresarial |
| P0 | Compras, licitaciones y ejecución contractual | Compras fuertes; ejecución parcial | Es el mejor universo para validar casos y resultados conocidos |
| P1 | Predio, rol, establecimiento y dirección | Fuerte pero fragmentado | Permite unir empresa, patente, permiso, obra y territorio sin confundir unidades |
| P1 | Patentes y licencias municipales | Crítico ausente | Es la puerta administrativa local más directa |
| P1 | Permisos DOM, recepciones y modificaciones | Publicación parcial | Conecta habilitación jurídica y realidad inmobiliaria |
| P1 | Fiscalizaciones, sanciones, clausuras y revocaciones | Crítico ausente | Entrega resultados y etiquetas operacionales |
| P2 | SEIA/SMA/DGA y permisos sectoriales | Fuerte/parcial | Añade barreras ambientales y sectores vulnerables después del núcleo |
| P2 | Concesiones, arriendos, subvenciones y comodatos | Fragmentado | Amplía la infraestructura legal utilizada, pero no debe retrasar el piloto |
| Excluido | Padrón electoral individual | Disponible | No es necesario ni proporcional; sólo se permiten agregados comunales |

## Fase 0 — Mapear y envolver lo existente (semanas 1–2)

### Trabajo

- Escribir un ADR que mapee los modelos reales de Nogaleda, Ambiental, Legal, Mercado Público, Municipios e Inmobiliaria al contrato común mínimo.
- Resolver explícitamente la autoridad de Inteligencia Inmobiliaria: producto Enigma, pipeline nacional, PostGIS local de desarrollo y API/UI legacy.
- Exponer `SourceManifest` como referencia a los manifests/catálogos y releases ya existentes; no copiar raw ni crear un registro manual paralelo.
- Etiquetar cada source/release como `public`, `public-minimized`, `restricted-licensed`, `restricted-personal` o `authority-only`.
- Identificar qué capabilities ya existen y cuáles son adaptadores pequeños; sólo las ausentes entran al backlog.
- Registrar en `decidechile-pipeline` únicamente las fuentes compartidas que realmente usen su runtime. Para las demás, guardar sólo el contrato del consumidor y la URL/version del release.

### Entregables

1. ADR de arquitectura federada con mapeo exacto a código existente.
2. Scorecard `/chile/fuentes` generado desde manifests con estado `ready`, `partial`, `missing`, `blocked`.
3. Matriz productor→release confiable→capability→consumidor, con referencias al linaje upstream.
4. Primer envelope reproducible de Mercado Público, Inmobiliaria, Ambiental y Legal sin mover ni reprocesar sus datos.

### Gate

- 100% de los assets prioritarios tiene autoridad, manifest, clasificación, dueño y consumidor.
- Ningún productor vigente aparece como `unresolved`.
- Ningún dato privado/licenciado está registrado en el plano publicable.
- El mismo release/envelope puede releerse y reproducir sus hashes.

## Fase 1 — Publicar capabilities comunes, no una base común (semanas 2–5)

### 1. Dimensión territorial

Una capability `territory.resolve` sirve un único catálogo versionado de región, provincia, comuna y CUT, con vigencias y crosswalks históricos. Puede materializarse donde convenga, pero los consumidores usan el contrato y no mantienen variantes propias.

**Calidad:** 346/346 comunas vigentes; CUT válido y único; cero nombres como clave primaria; cambios territoriales fechados.

### 2. Dimensión de organismos públicos

Una capability `organization.resolve` resuelve municipio, corporación, unidad compradora, servicio, DOM y razón institucional a un `organization_id`, conservando los IDs de cada fuente.

**Calidad:** ≥99% del monto de compras resuelve a organismo; colisiones y unidades huérfanas revisadas; historia de nombres preservada.

### 3. Identidad jurídica temporal

La capability `legal-entity.timeline` compone RUT, RES y registros de proveedor. Separa persona jurídica de persona natural. Beneficiarios y administradores son hechos/relaciones con vigencia y procedencia, no columnas actuales pegadas a toda la historia.

**Calidad:** RUT con DV válido ≥99%; duplicados por RUT = 0; fecha efectiva presente en ≥95% de eventos; resolución de nombres nunca sobrescribe el original.

### 4. Identidad territorial inmobiliaria

La capability `parcel.resolve` conserva claves separadas:

- `parcel_geometry_id`: geometría predial versionada;
- `sii_role_id`: región/comuna/manzana/predio o esquema oficial aplicable;
- `establishment_id`: local o establecimiento administrativo;
- `address_id`: dirección normalizada y geocodificada;
- `source_feature_id`: ID original de cada capa.

`gkey` puede seguir siendo la llave técnica del snapshot, pero se debe probar su estabilidad ante normalización, orden de vértices y republicaciones. Nunca se usará el hash geométrico como identidad jurídica permanente sin un crosswalk versionado.

**Calidad:** geometrías válidas = 100%; roles huérfanos = 0; predios sin rol justificados; match rol–geometría con fecha; confianza y método para cada geocodificación.

### Entregable

Cuatro `CapabilityContract` versionados y sus releases de referencia: `territory.resolve`, `organization.resolve`, `legal-entity.timeline` y `parcel.resolve`. Cada uno mantiene su store de autoridad. No se crea `core_identity_v1` como copia física transversal.

## Fase 2 — Confiar e integrar los releases que ya tenemos (semanas 3–8)

Integrar uno por uno mediante adaptadores read-only; no migrar ni reingestar:

| Asset | Productor actual | Mejora requerida antes de promover |
|---|---|---|
| Órdenes e ítems de compra | Mercado Público | Consumir el release que el monitor ya considere promovido; no repetir su cold store ni reconciliación |
| Licitaciones y oferentes | Mercado Público | Exponer un release coherente con órdenes y su contrato de frontera |
| Sanciones y alertas de compra | Mercado Público/ChileCompra | Regla, resolución, estado y resultado; no sólo bandera |
| Eventos RES | Economía/RES | Historia, disoluciones/modificaciones, esquema público versus enriquecido restringido |
| Observaciones CGR | Municipios | Hallazgo, severidad, acto, enlace y seguimiento uniformes |
| Actas municipales | Municipios | Cobertura por comuna/período, hash documental y acuerdos extraídos con confianza |
| Predio–rol–valor | Inmobiliaria | Envolver el producto Enigma existente y heredar su quality report; no reexportar geometrías |
| Expedientes SEIA | Ambiental | Consumir sus capabilities/API y linaje existentes; no reindexar documentos |
| Fiscalización/sanción SMA | Ambiental | Crosswalk de titular/proyecto, historia y distinción entre declarado y verificado |
| Corpus legal | Legal | Consumir la API y el release/estado de serving existentes; no descargar ni reindexar el corpus |

Para un dato existente, el trabajo termina en: identificar el release promovido → publicar envelope → probar contrato de frontera → consumirlo. Expand-contract, shadow diff y canary se ejecutan únicamente cuando se cambia el productor, el reader productivo o la semántica del release. La reconciliación autoridad→manifest→raw→índice/capability sigue siendo responsabilidad de Legal, Ambiental, Inmobiliaria o el productor correspondiente.

## Fase 3 — Integración inmobiliaria sin reingesta (semanas 3–7)

### A. Aceptar la autoridad del producto

- Consumir el producto vigente de Enigma por API/vista read-only y fijar su `upstream_release_id`.
- Importar por referencia sus conteos, checks, fecha y limitaciones; no recalcular el universo nacional.
- Mantener Coquimbo y las regresiones nacionales como evidencia del productor, no como suite de Chile Monitor.
- Si el release upstream está bloqueado o stale, mostrar ese estado y conservar el último bueno; no reconstruirlo.

### B. Contrato espacial de frontera

- Exigir que `parcel.resolve` devuelva release, fecha, `gkey`, rol, confianza y condición referencial declarada por Inmobiliaria.
- No inventar un ID predial nuevo: usar las identidades/crosswalks que publique el producto.
- Si `gkey` no es estable entre releases, pedir al productor un crosswalk; Chile Monitor no recalcula geometrías canónicas.
- Abrir una tarea upstream para fusiones, subdivisiones o versionamiento que el producto todavía no exponga.

### C. Validar solamente los cruces nuevos

- Patentes/DOM normalizan sus direcciones en su propio pipeline nuevo.
- `parcel.resolve` recibe esa dirección/rol y devuelve candidatos con método y confianza.
- Se evalúa la unión establecimiento→predio→rol con goldens y casos ambiguos; no se vuelve a evaluar el catastro completo.
- Edificios multiempresa, direcciones masivas y matches inciertos quedan pendientes de revisión.

### D. Privacidad

- Retirar RUT, edad y fallecimiento de propietarios de releases publicables.
- Mantener esos campos en zona restringida con propósito, acceso y retención.
- Crear agregados públicos por tipo de propietario y comuna cuando sean necesarios.

### Gate inmobiliario

- Release upstream identificado como promovido/trusted y dentro de su presupuesto de frescura.
- Contrato `parcel.resolve` reproducible contra ese release.
- Calidad heredada visible, incluida la diferencia entre Coquimbo verificado y regresiones nacionales fijadas.
- El cruce nuevo patente/DOM→predio cumple su golden y reporta la tasa de match/ambigüedad.
- Diferencia predio/rol documentada en contratos y UI.
- Ningún atributo de propietario en Chile Monitor público.

## Fase 4 — Adquirir la capa administrativa faltante (semanas 2–12)

### Tres municipios piloto

Elegirlos por disponibilidad y capacidad institucional, no por presunción de riesgo:

- uno metropolitano con alto volumen de compras y permisos;
- uno intermedio con buena transparencia activa;
- uno pequeño/rural para probar heterogeneidad y costos de normalización.

### Paquetes de datos

| Paquete | Campos mínimos | Adquisición inicial | Quality gate |
|---|---|---|---|
| Patentes/licencias | ID, RUT jurídico, giro, dirección/rol, acto, otorgamiento, renovación, estado, suspensión/revocación | Transparencia activa + solicitud 2021–2026 | ≥90% período; estados catalogados; RUT válido ≥99% |
| DOM | permiso, solicitante jurídico, dirección/rol, tipo, fechas, modificaciones, recepción, caducidad, enlace | CSV mensual art. 116 bis C + historia solicitada | acto enlazable ≥95%; rol/dirección ≥90% |
| Fiscalizaciones | establecimiento/patente, fecha, materia, resultado, infracción, medida, reapertura | Solicitud estructurada, minimizada | resultado presente ≥95%; denunciantes excluidos |
| Ejecución contractual | contrato, subcontratista, estados de pago, recepción, multa, garantía, modificación, término | Municipio + ChileCompra/convenio | monto adjudicado/OC/pagado reconciliado |
| Concesiones/beneficios | beneficiario jurídico, acto, objeto, monto/bien, vigencia, cambio/término | Transparencia activa + solicitud | RUT/acto/vigencia ≥95% |

Las solicitudes deben pedir CSV/XLSX, diccionario, identificador estable y frecuencia. El tracker de Chile Monitor registrará fecha, plazo, prórroga, respuesta, recurso, campos recibidos, parser, cobertura y release.

## Fase 5 — Gold administrativo y expedientes (semanas 9–16)

Sólo después de superar los gates anteriores se publican mediante el ledger/envelopes existentes:

- `administrative_event`: contrato, patente, permiso, inspección, sanción, pago o revocación;
- `entity_relationship`: vínculo temporal y sourced;
- `evidence_artifact`: acto/documento con URL y hash;
- `data_gap`: ausencia o incumplimiento de publicación separado de cualquier riesgo;
- `case_packet`: hechos, línea de tiempo, fuentes, limitaciones y antecedente faltante;
- `review` y `outcome`: decisión humana, descargo, derivación y resultado.

No se construye un grafo público de personas. Los grafos derivados y Mallas quedan en plano restringido y nunca sustituyen las fuentes oficiales. El `EvidencePacket` consume hechos; no los copia, edita ni transforma en autoridad.

## Tablero de calidad

Chile Monitor mostrará, por fuente y asset:

| Eje | Indicadores |
|---|---|
| Disponibilidad | fuente accesible, observación exitosa, hash, tamaño, `Last-Modified` |
| Cobertura | períodos, comunas, tipos de acto y denominador esperado/recibido |
| Completitud | RUT, CUT, fecha, acto, estado, dirección/rol y enlace |
| Validez | DV, catálogo, rangos, geometría, SRID y unidades |
| Integridad | huérfanos, duplicados, `IN = OUT + DROP`, reconciliación monetaria |
| Consistencia temporal | vigencias superpuestas, hechos futuros, relación válida a fecha del acto |
| Frescura | edad upstream y del release; último bueno si falla la fuente |
| Privacidad/licencia | clasificación, campos suprimidos, propósito, retención y consumidores |

Un asset nuevo no promueve si un check está ausente, `skipped`, fallido o carece de denominador. Para un asset existente se respeta el veredicto de su productor: Chile Monitor no repite el check, pero bloquea el consumo si el release declara `partial`, `blocked` o stale. Un warning visible no debe convertirse silenciosamente en éxito.

## Organización y responsables

| Frente | Responsable propuesto | Repositorio principal |
|---|---|---|
| Envelope común y fuentes tabulares compartidas | plataforma de datos | `decidechile-pipeline` + adaptadores por dominio |
| Compras y proveedores | equipo Mercado Público | `monitor-mercado-publico` |
| Municipios y transparencia | equipo municipal | `monitor-municipios` |
| Predios, roles y espacial | equipo inmobiliario | `inteligencia-inmobiliaria-pipeline` |
| SEIA, SMA y capabilities documentales/geoespaciales | equipo ambiental | `inteligencia-ambiental` |
| Corpus, búsqueda, normas y citas jurídicas | equipo legal | `claude-for-legal-chile` |
| Ledger, autoridad y patrón de releases | referencia/paquete compartido | `nogaleda-alt` |
| Cobertura, composición de capabilities y operación | producto transversal | `chile-monitor` |

Cada asset tendrá un único dueño semántico. Compartir infraestructura no autoriza a que el plano central redefina el significado del dominio.

## Hitos de 30, 60, 90 y 120 días

### Día 30

- ADR, envelopes y autoridad reconciliados;
- catálogo CUT/organismos diseñado;
- releases existentes inventariados sin reingesta, incluido Inmobiliaria;
- solicitudes presentadas a tres municipios;
- scorecard de fuentes funcionando con datos reales.

### Día 60

- cuatro capabilities de identidad en shadow;
- cinco assets existentes bajo envelopes y gates federados;
- `parcel.resolve` integrado contra el release inmobiliario existente;
- primeros parsers de patente y DOM;
- diez casos históricos seleccionados, todavía sin scoring.

### Día 90

- diez assets existentes promovibles o con bloqueador explícito;
- patentes/DOM de al menos dos municipios normalizados;
- ejecución/fiscalización con cobertura medida;
- expedientes Gold reconstruyen al menos 8/10 casos históricos.

### Día 120

- tres municipios con cobertura administrativa ≥90% en el período acordado;
- revisión legal y de privacidad aprobada;
- 10–12 señales explicables listas para evaluación prospectiva controlada;
- decisión informada de seguir, corregir o detener el piloto.

## Criterios para no avanzar

El piloto no pasa a señales si ocurre cualquiera de estas condiciones:

- no existe organismo socio con facultad y flujo de respuesta;
- patentes/DOM/fiscalizaciones no alcanzan cobertura suficiente;
- la identidad societaria se aplica retrospectivamente sin historia;
- la geometría o dirección genera demasiadas uniones ambiguas;
- los expedientes no reconstruyen casos conocidos;
- datos personales o licenciados no pueden separarse del producto público;
- el equipo no puede revisar y registrar resultados de las alertas generadas.

## Primer backlog ejecutable

1. Escribir el ADR de arquitectura federada, citando clases, manifests, stores y endpoints reales de los tres precedentes.
2. Definir el envelope común como schema, sin implementar un store nuevo.
3. Corregir el inventario de Inteligencia Inmobiliaria y mapear su producto Enigma a `SourceManifest` y `parcel.resolve`.
4. Construir adaptadores read-only para un release existente de Mercado Público, Inmobiliaria y Ambiental, más una consulta citada de Legal; cero reingesta.
5. Generar `/chile/fuentes` desde esos cuatro envelopes; probar gaps en cada eslabón de la cadena.
6. Importar por referencia el quality report de `predio`, `pano`, `rol` y `valor`; solicitar al productor el crosswalk si `gkey` cambia entre releases.
7. Publicar `territory.resolve`, `organization.resolve`, `legal-entity.timeline` y `parcel.resolve` sobre stores existentes.
8. Consumir el release promovido de órdenes/ítems y agregar licitaciones al productor usando `DataRelease`/CURRENT y rollback, no replicarlas en Chile Monitor.
9. Elegir tres municipios y preparar solicitudes de patente, DOM, fiscalización, ejecución y concesiones.
10. Implementar `/chile/calidad` y `/chile/transparencia`; postergar `/casos` hasta que un `EvidencePacket` pueda reproducirse desde releases fijados.

## Anclas de implementación que deben revisarse antes de escribir código

El ADR inicial no parte de una hoja en blanco. Debe mapear explícitamente estas implementaciones:

### Nogaleda Alternativos

- `backend/PLAN_REESTRUCTURACION_PIPELINE_ALTERNATIVOS.md`: decisiones, fases, gates y métricas.
- `document_census_matrix_product.py`: rendición completa de corpus/documentos.
- `economic_document_facts.py` y `economic_document_fact_store.py`: hechos, precedencia y persistencia.
- `economic_event_authority.py` y `economic_event_authority_store.py`: autoridad, revisiones y CAS.
- `pipeline_shadow_reconciliation.py`: comparación independiente sin autocorrección.
- `unified_source_release_store.py`: releases, CURRENT y rollback.
- `docs/operations/PR7B_CANARY_EVIDENCE_2026-08-28.md`: evidencia real de canary y reversa.

### Inteligencia Ambiental

- `ARCHITECTURE.md`: separación Data/Capability/Use Case y Bronze/Silver/Gold.
- `api/src/permisos/capabilities/`: contratos reales de capacidades reutilizables.
- `bronze.processing_event`: patrón de lineage por paso.
- `evals/`: golden sets y métricas por extractor/capability.
- `docs/PLUGIN_SDK.md`: incorporación de nuevos casos de uso sin modificar el core.

### Claude Legal Chile

- `chile/scripts/bcn/audit-corpus-chain.py`: autoridad→manifest→disco→índice.
- `chile/LIMPIEZA-BASE64.md`: incidentes y gates de corpus/índices.
- `chile/scripts/build-newsources-faiss.py`: construcción atómica de índice y rutas.
- `chile/scripts/deploy/promover-indice-leychile.sh`: promoción, mínimos y reversa.
- `chile/legalchile/backend/apps/corpus/semantic.py`: guard de alineación vector→ruta.
- `chile/legalchile/docs/CORPUS_API.md`: fachada read-only que deben consumir otros productos.
