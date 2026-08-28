# Plan de producto: integridad de patentes comerciales

**Fecha:** 28 de agosto de 2026

**Horizonte del piloto:** 16 semanas

**Caso base:** otorgamiento, seguimiento, renovación y fiscalización de patentes de operación comercial.

## 1. Decisión ejecutiva

La patente comercial será el objeto operacional central. Chile Monitor no creará un repositorio paralelo de patentes ni volverá a procesar los datos de los demás productos.

La cadena de responsabilidades será:

```text
Municipalidades
    │ actos, registros y resultados oficiales
    ▼
Inteligencia Inmobiliaria
    │ patente + establecimiento + dirección + rol + predio
    │ release promovido + capabilities read-only
    ▼
Chile Monitor
    │ ReviewCase + acciones humanas + evidencia + resultado
    ├── consume Legal Chile
    ├── consume Inteligencia Ambiental
    ├── consume Mercado Público
    ├── consume Monitor Municipios
    └── consume identidad societaria/RES
```

Los sistemas cumplen funciones distintas:

- La municipalidad sigue siendo la autoridad jurídica de la patente y de sus actos.
- Inteligencia Inmobiliaria será el data product canónico para consultar patentes y establecimientos, siempre referenciando la fuente municipal.
- Chile Monitor será el sistema operacional de revisión, coordinación y trazabilidad. No cambia el estado jurídico de una patente por inferencia.

## 2. Principios no negociables

1. **No reingesta:** predios, roles, compras, SEIA, normas y empresas se consumen desde releases promovidos existentes.
2. **La patente vive upstream:** Chile Monitor no implementa loaders municipales ni parsers de patentes.
3. **Municipio como autoridad:** un estado derivado nunca reemplaza el acto o registro municipal.
4. **Hechos antes que señales:** patente, permiso, pago, inspección y clausura son hechos con fuente y vigencia.
5. **Acción humana:** no hay otorgamiento, rechazo, clausura ni denuncia automática.
6. **Ausencia no es incumplimiento:** falta de publicación produce `data_gap`.
7. **Release fijado:** todo expediente conserva los releases exactos utilizados.
8. **Propiedad por dominio:** cada capacidad tiene un único productor semántico.

## 3. Ownership por producto

| Producto/repositorio | Datos que debe poseer | Capabilities que debe publicar | Lo que no debe hacer |
|---|---|---|---|
| `inteligencia-inmobiliaria-pipeline` | patentes, establecimientos, direcciones, roles, predios, relación patente–establecimiento–predio | `patents.get`, `patents.search`, `patents.timeline`, `patents.coverage`, `establishments.resolve`, `parcel.resolve` | interpretar jurídicamente requisitos o mantener casos operacionales |
| `monitor-municipios` | municipios, unidades, autoridades, ordenanzas, actas, CGR, litigios y capacidad institucional | `municipality.get`, `municipality.organization`, `municipality.audit-context`, `municipality.ordinances` | duplicar patentes o geometrías |
| `decidechile-pipeline` | eventos públicos RES de personas jurídicas y releases tabulares compartidos | `legal-entity.timeline`, `legal-entity.resolve` | producir relaciones privadas/licenciadas en el plano público |
| `inteligencia-ambiental` | expedientes, permisos y contexto ambiental/sectorial | `environmental.context`, `sectoral-permits.context`, `gis.context` | copiar patente municipal o decidir compatibilidad legal definitiva |
| `monitor-mercado-publico` | proveedor, compras, licitaciones, concentración, sanciones y ejecución disponible | `supplier.profile`, `procurement.timeline`, `procurement.integrity-facts` | puntuar patentes o establecimientos |
| `claude-for-legal-chile` | legislación, dictámenes, jurisprudencia y citas | `legal.search`, `legal.authority`, `legal.cite` | persistir casos o emitir decisiones administrativas |
| `chile-monitor` | Ontology operacional, casos, asignaciones, acciones, explicaciones y resultados | `cases.*`, `actions.*`, `campaigns.*`, UI operacional | ingerir archivos upstream, recalcular dominios o publicar rankings de riesgo |

Mallas u otros enriquecimientos licenciados permanecen restringidos y nunca constituyen evidencia única.

## 4. Data product de patentes en Inteligencia Inmobiliaria

El contrato máquina-a-máquina inicial está documentado en
[`contracts/commercial-licenses.openapi.yaml`](contracts/commercial-licenses.openapi.yaml).
Es un borrador de interoperabilidad para revisión conjunta; no implica que Chile Monitor
sea productor ni que el endpoint ya esté desplegado.

Su aceptación se prueba con la pauta
[`contracts/commercial-licenses-acceptance.md`](contracts/commercial-licenses-acceptance.md),
incluyendo fixtures temporales, privacidad, matches ambiguos, cobertura y fallback al
último release bueno.

El consumidor server-side y sus gates están definidos en
[`contracts/commercial-licenses-client-design.md`](contracts/commercial-licenses-client-design.md).

El expediente reproducible que construirá Chile Monitor está formalizado en
[`contracts/evidence-packet.schema.yaml`](contracts/evidence-packet.schema.yaml).

El pedido operativo al productor está listo en
[`handoff-inteligencia-inmobiliaria-commercial-licenses.md`](handoff-inteligencia-inmobiliaria-commercial-licenses.md)
y el trabajo del consumidor en
[`issues/implement-commercial-licenses-client.md`](issues/implement-commercial-licenses-client.md).

### 4.1 Por qué debe vivir allí

La patente grava una actividad ejercida por un contribuyente en un local, oficina, establecimiento o lugar determinado. Su revisión depende de resolver correctamente dirección, rol, predio, uso del suelo y establecimiento. Ese es el dominio natural de Inteligencia Inmobiliaria.

La Ley de Rentas Municipales vincula expresamente contribuyente, actividad y local, y contempla requisitos de zonificación y autorizaciones sanitarias o sectoriales. [Ley de Rentas Municipales](https://www.bcn.cl/leychile/Navegar?idNorma=7054&idParte=8739650).

### 4.2 Fuentes nuevas

Inteligencia Inmobiliaria incorporará únicamente los archivos nuevos del dominio patente:

1. Transparencia activa municipal.
2. Respuestas a solicitudes de acceso.
3. Exportación estructurada del municipio socio.
4. Actos o resoluciones municipales enlazados.
5. En una etapa posterior, APIs o convenios de actualización.

No volverá a descargar ni reconstruir el catastro predial que ya posee.

### 4.3 Granos que no se pueden mezclar

| Entidad | Grano |
|---|---|
| `patente` | una patente municipal identificada por municipio y número/ID fuente |
| `patente_evento` | un otorgamiento, renovación, modificación, suspensión, caducidad, revocación o reapertura |
| `establecimiento` | un lugar físico operacional, aunque varias personas jurídicas lo usen en distintos períodos |
| `patente_titular` | relación temporal entre patente y persona jurídica/natural |
| `patente_giro` | giro autorizado y su período de vigencia |
| `patente_requisito` | requisito y estado informado por la fuente municipal |
| `patente_pago` | período, monto/estado y mora cuando la fuente lo entregue |
| `fiscalizacion` | actuación de fiscalización y resultado oficial |
| `medida_administrativa` | multa, requerimiento, clausura, reapertura u otra medida formal |
| `direccion_fuente` | dirección textual tal como fue publicada |
| `establecimiento_predio_match` | candidato rol/predio, método, confianza, vigencia y revisión |

No se usará la patente como sinónimo de empresa ni la dirección como sinónimo de predio.

### 4.4 Capas siguiendo la arquitectura existente

#### Raw

- conservar el archivo o respuesta original;
- registrar municipio, período, URL, fecha de observación y SHA-256;
- mantener encabezados y tipos originales;
- no sobrescribir publicaciones anteriores;
- separar raw identificable/restringido de raw publicable.

#### Mart

- normalizar CUT, número de patente, tipo, estado, fechas y giro;
- validar RUT jurídico cuando esté disponible;
- conservar el valor original además del normalizado;
- construir timeline, no una ficha actual que borre historia;
- resolver establecimiento y predio mediante capacidades inmobiliarias existentes;
- guardar matches ambiguos como candidatos, no elegir arbitrariamente.

#### Serving/capability

El consumidor nunca leerá las tablas internas. El contrato mínimo de cada respuesta será:

```json
{
  "producer": "inteligencia-inmobiliaria",
  "product": "commercial-licenses",
  "release_id": "...",
  "schema_version": "...",
  "data_as_of": "...",
  "quality_status": "promoted",
  "license": {},
  "establishment": {},
  "parcel_matches": [],
  "source_refs": [],
  "limitations": []
}
```

### 4.5 Capabilities requeridas

#### `patents.get`

Entrada: municipio + ID/número de patente. Salida: patente, timeline, titular, establecimiento, requisitos, medidas y fuentes.

#### `patents.search`

Filtros: CUT, estado, tipo, giro, período, persona jurídica, dirección, establecimiento y cobertura fuente.

#### `patents.timeline`

Entrega eventos ordenados con `effective_at`, `observed_at`, acto y fuente. No reconstruye eventos ausentes.

#### `patents.coverage`

Por municipio y período: universo declarado, registros recibidos, campos, frescura, gaps y restricciones de publicación.

#### `establishments.resolve`

Entrada: dirección/rol/municipio. Salida: candidatos de establecimiento y predio con método, confianza y release.

### 4.6 Quality gates upstream

| Dimensión | Gate inicial |
|---|---|
| Fuente | archivo/respuesta con hash, municipio, período y URL/acto |
| Contabilidad | `IN = OUT + DROP`, cada drop con causa |
| Unicidad | cero duplicados por clave fuente; posibles duplicados semánticos quedan en revisión |
| CUT | 100% válido en datasets admitidos |
| RUT jurídico | ≥99% válido cuando la fuente lo informa |
| Timeline | eventos sin fechas imposibles ni estados terminales contradictorios sin conflicto explícito |
| Dirección | original siempre conservada; normalizada nunca reemplaza la fuente |
| Match predial | tasa publicada; ambiguos y no resueltos visibles |
| Privacidad | cero RUT de persona natural en release público |
| Frescura | presupuesto por municipio y último release bueno |

Las patentes y modificaciones son información pública, pero el RUT de una persona natural debe excluirse de la publicación. [CPLT](https://www.consejotransparencia.cl/consejo/site/artic/20150609/asocfile/20150609174154/presentacioninstrucciongeneral10_.pdf).

## 5. Solicitudes y exportaciones municipales

### 5.1 Dataset de stock y eventos

Pedir el stock vigente a la fecha de corte y eventos desde 2021:

- ID/número de patente;
- tipo: comercial, industrial, profesional, provisoria u otra categoría;
- estado y fecha efectiva;
- RUT de persona jurídica;
- razón social y nombre de fantasía;
- giro(s);
- dirección, local, rol y comuna;
- fecha de solicitud, otorgamiento y renovación;
- carácter provisorio/definitivo y vencimiento;
- acto administrativo y enlace;
- modificaciones, transferencias, suspensiones, caducidades, revocaciones y reaperturas.

### 5.2 Requisitos

- requisito;
- organismo responsable;
- documento presentado;
- fecha de emisión/vencimiento;
- estado informado por el municipio;
- fecha de verificación;
- observación y acto asociado.

### 5.3 Pagos y mora

- patente y período;
- estado pagado/moroso/convenio;
- fecha de pago o inicio de mora;
- regularización;
- acto de clausura cuando corresponda.

### 5.4 Fiscalizaciones y medidas

- patente/establecimiento;
- fecha y unidad fiscalizadora;
- materia;
- resultado;
- hallazgo constatado;
- requerimiento/plazo;
- multa, clausura, reapertura o archivo;
- acto, evidencia y estado de cumplimiento.

Solicitudes y convenios deben pedir tablas separadas, CSV/XLSX, diccionario, claves y periodicidad. No se pedirán datos personales de denunciantes, trabajadores o titulares naturales que no sean necesarios.

## 6. Integraciones upstream complementarias

### 6.1 Identidad societaria

`legal-entity.timeline` debe entregar constitución, modificaciones, disolución y nombres vigentes a la fecha del evento. Chile Monitor no aplicará la ficha societaria actual retrospectivamente.

### 6.2 Monitor Municipios

Debe resolver municipio/unidad y exponer contexto institucional, auditorías, ordenanzas y actos, sin duplicar la tabla de patentes.

### 6.3 Inteligencia Ambiental

Debe recibir persona jurídica, establecimiento/predio y actividad, y devolver hechos ambientales/sectoriales con sus propios releases. La ausencia de un resultado no se interpreta como ausencia de permiso.

### 6.4 Mercado Público

Debe responder si la persona jurídica es proveedora, qué contratos tiene y qué sanciones o hechos de integridad están registrados. Esta información enriquece el caso, pero no determina la patente.

### 6.5 Legal Chile

Debe devolver la norma, dictamen o jurisprudencia pertinente con cita verificable. Para el MVP se requieren al menos:

- otorgamiento y renovación;
- patentes provisorias;
- zonificación y uso del suelo;
- mora y clausura;
- transferencias/cambios de titular;
- requisitos sanitarios y sectoriales;
- debido procedimiento, notificación y recursos.

No se copiará el corpus. Se consume su API read-only.

## 7. Ontology operacional en Chile Monitor

### 7.1 Objetos

- `CommercialLicense`
- `LicenseApplication`
- `Establishment`
- `LegalEntity`
- `Parcel`
- `Requirement`
- `Inspection`
- `AdministrativeFinding`
- `AdministrativeMeasure`
- `EvidenceArtifact`
- `SourceRelease`
- `ReviewCase`
- `Organization`

Los objetos leídos desde upstream conservan `producer`, `release_id` y `source_ref`. Chile Monitor sólo es autoridad para `ReviewCase`, sus acciones y resultados internos.

### 7.2 Relaciones temporales

```text
LegalEntity ─holds→ CommercialLicense
CommercialLicense ─authorizes→ Establishment
Establishment ─located_on→ Parcel
CommercialLicense ─requires→ Requirement
Inspection ─evaluates→ Establishment
AdministrativeFinding ─results_from→ Inspection
AdministrativeMeasure ─addresses→ AdministrativeFinding
ReviewCase ─reviews→ CommercialLicense
EvidenceArtifact ─supports→ AdministrativeFinding
```

Toda relación que pueda cambiar lleva vigencia y fuente.

### 7.3 Actions

| Action | Actor | Efecto en Chile Monitor | Efecto jurídico |
|---|---|---|---|
| `OpenLicenseReview` | Rentas/Control | abre caso y fija releases | ninguno |
| `AssignReviewer` | coordinador | asigna dueño y SLA | ninguno |
| `RequestMissingRequirement` | funcionario autorizado | registra solicitud y plazo | el que tenga la comunicación oficial externa |
| `ResolveEstablishment` | analista/revisor | acepta un match con justificación | ninguno |
| `RecordAlternativeExplanation` | revisor | preserva explicación lícita | ninguno |
| `RecommendInspection` | revisor | genera recomendación | no programa ni ordena por sí sola |
| `RecordInspectionOutcome` | fiscalizador | registra resultado y acto | depende del acto municipal fuente |
| `RecommendAdministrativeMeasure` | jurídico/control | prepara propuesta | no multa, clausura ni revoca |
| `RecordOfficialDecision` | funcionario autorizado | enlaza acto y resultado | refleja el acto externo; no lo inventa |
| `RequestCorrection` | revisor/titular por canal | bloquea decisión mientras se revisa | según procedimiento aplicable |
| `CloseReview` | rol autorizado | cierra con outcome y causa | ninguno adicional |

## 8. Workflow del MVP

```text
trigger de revisión
  → abrir release de patente
  → resolver empresa/establecimiento/predio
  → consultar requisitos y capacidades complementarias
  → producir EvidencePacket
  → revisión humana
      ├── sin observaciones
      ├── dato incorrecto → corrección
      ├── antecedente faltante → solicitud
      ├── explicación suficiente → cierre
      └── requiere actuación → inspección/derivación
  → registrar acto/resultado oficial
  → cerrar caso
  → evaluar utilidad de la regla
```

El `EvidencePacket` debe contener:

- patente y timeline;
- establecimiento y predio;
- titular a la fecha relevante;
- requisitos y estados conocidos;
- evidencia y citas;
- releases exactos;
- gaps;
- conflictos;
- explicaciones alternativas;
- base jurídica consultada;
- próxima acción permitida.

## 9. Primeras cohortes

### Cohorte A — Patentes provisorias

Es la recomendada para comenzar:

- universo acotado;
- fecha y plazo claros;
- requisitos pendientes identificables;
- actuación municipal concreta;
- resultado verificable: definitiva, regularizada, vencida, clausurada o pendiente.

### Cohorte B — Sector regulado

Escoger un solo sector según datos del municipio: alimentos, talleres, bodegas, residuos u otro que requiera permisos verificables. No seleccionar por reputación de criminalidad.

### Cohorte C — Renovación

Sólo después de validar A y B: revisiones próximas a renovación con cambios de titular, domicilio, giro, permisos o mora.

## 10. Fases concatenables

Cada bloque declara qué recibe, qué entrega y su gate. El bloque siguiente consume el resultado; no repite el trabajo.

### Bloque A — Contratos y municipio piloto (semanas 1–2)

**Recibe:** arquitectura y productos existentes.

**Trabajo:**

- seleccionar un municipio socio y responsables de Rentas, DOM, Jurídica/Control y fiscalización;
- aprobar el modelo de ownership;
- acordar cohortes y outcomes;
- definir schemas de capabilities y `TrustedDataProduct`;
- presentar solicitudes/exportaciones.

**Entrega:** ADR, diccionario municipal, contrato de datos, matriz de permisos y 20 casos históricos.

**Gate:** autoridad municipal involucrada, acceso al registro y usuario operacional identificado.

### Bloque B — Data product de patentes (semanas 2–6)

**Recibe:** exportaciones municipales y catastro inmobiliario ya promovido.

**Trabajo:** raw nuevo de patentes, mart temporal, matches de establecimiento/predio, QA y capabilities.

**Entrega:** release candidato de `commercial-licenses` y reporte de cobertura.

**Gate:** contabilidad completa, privacidad aprobada, timeline reproducible y matches ambiguos visibles.

### Bloque C — Adaptadores complementarios (semanas 4–7)

**Recibe:** releases promovidos de cada dominio.

**Trabajo:** adaptadores read-only para entidad, municipio, ambiente, compras y Legal.

**Entrega:** cinco `CapabilityContract` probados con releases fijados.

**Gate:** cero reingesta, contratos compatibles y fallas upstream visibles.

### Bloque D — Ontology y lectura operacional (semanas 6–9)

**Recibe:** release de patentes y capabilities complementarias.

**Trabajo:** objetos, relaciones, EvidencePacket, cola y expediente read-only.

**Entrega:** reconstrucción de 20 casos históricos.

**Gate:** al menos 16/20 casos reproducidos con evidencia suficiente; diferencias clasificadas.

### Bloque E — Actions y seguridad (semanas 8–12)

**Recibe:** expedientes reproducibles y matriz de roles.

**Trabajo:** action ledger, asignación, solicitudes, revisión, corrección, derivación, resultado y cierre.

**Entrega:** workflow completo en shadow.

**Gate:** ninguna action adquiere facultad no autorizada; permisos por objeto/propiedad/action; auditoría y reversa probadas.

### Bloque F — Piloto vivo (semanas 12–16)

**Recibe:** workflow shadow aprobado.

**Trabajo:** cohorte provisoria, revisión humana, inspecciones/derivaciones reales cuando correspondan y captura de outcomes.

**Entrega:** evaluación operacional y decisión de escala.

**Gate:** carga absorbible, rectificación probada, resultados medidos y ausencia de decisiones automáticas.

## 11. Seguridad

### Markings

- `PUBLIC`
- `PII`
- `LICENSED`
- `MUNICIPAL_INTERNAL`
- `ACTIVE_REVIEW`
- `AUTHORITY_ONLY`

### Controles

- acceso por municipio y caso;
- propiedades personales ocultas aunque el objeto sea visible;
- permiso separado para ver, asignar, recomendar, registrar acto y cerrar;
- exportación controlada y auditada;
- sesión y actor derivados del servidor;
- ninguna identidad/rol aceptado desde el body del cliente;
- logs append-only de actions;
- retención y corrección definidas.

## 12. Calidad transversal sin duplicar QA upstream

Chile Monitor verifica únicamente:

1. el release está `promoted/trusted`;
2. schema y capability version son compatibles;
3. `data_as_of` está dentro del presupuesto;
4. el objeto conserva source refs;
5. el cruce nuevo entrega match, método y confianza;
6. el EvidencePacket puede reproducirse contra los mismos releases;
7. una caída upstream mantiene el último release bueno o muestra degradación.

No vuelve a contar predios, normas, compras o expedientes.

## 13. Métricas

### Datos de patente

- cobertura por municipio/período/tipo;
- completitud de estado, giro, fecha, dirección y acto;
- porcentaje resuelto a establecimiento y predio;
- porcentaje ambiguo/no resuelto;
- frescura y gaps de publicación.

### Operación

- tiempo hasta expediente completo;
- casos revisados dentro del plazo;
- provisionales regularizadas antes de vencimiento;
- solicitudes de antecedentes y tasa de respuesta;
- inspecciones recomendadas/realizadas;
- casos cerrados por explicación lícita;
- correcciones de datos;
- actuaciones oficiales resultantes;
- falsos positivos y reglas retiradas.

La métrica principal será:

> porcentaje de revisiones de patente con expediente completo y outcome administrativo trazable dentro del plazo aplicable.

## 14. Definition of Done

El piloto no está terminado si:

- Chile Monitor ingiere un archivo que corresponde a otro productor;
- la patente no existe primero en Inteligencia Inmobiliaria;
- un caso no fija `release_id` de cada capacidad;
- se pierde la dirección o valor original publicado;
- una relación actual se aplica retrospectivamente;
- un match ambiguo se convierte silenciosamente en cierto;
- falta un dato y se interpreta como incumplimiento;
- una recomendación se muestra como decisión oficial;
- no existe actor, fundamento, evidencia y outcome;
- los datos de personas naturales aparecen en el producto público;
- el municipio no puede corregir el dato o el caso;
- no se puede mantener el último release bueno ante una caída.

## 15. Backlog inicial por repositorio

### `inteligencia-inmobiliaria-pipeline`

1. ADR de ownership de patentes/establecimientos.
2. Inventario de fuentes municipales y clasificación.
3. Contrato raw de patentes.
4. Modelo temporal de patente y establecimiento.
5. Resolver dirección/rol/predio reutilizando las capacidades existentes.
6. Quality report y golden de matches.
7. `patents.get/search/timeline/coverage`.
8. `establishments.resolve`.
9. Release candidato, canary y promoción.

### `monitor-municipios`

1. Contrato de municipio/unidades/autoridades.
2. Exposición de contexto CGR, litigios, ordenanzas y actas.
3. Eliminar cualquier duplicación de patente usada como autoridad.

### `decidechile-pipeline`

1. Eventos RES versionados.
2. `legal-entity.resolve` y `legal-entity.timeline`.
3. Separación pública/restringida.

### `inteligencia-ambiental`

1. Contrato de consulta por persona jurídica/establecimiento/predio.
2. Contexto de permisos y fiscalizaciones con source refs.
3. Quality/release en cada respuesta.

### `monitor-mercado-publico`

1. `supplier.profile` por RUT jurídico.
2. Timeline de compras/sanciones con release fijado.
3. Hechos, no score de patente.

### `claude-for-legal-chile`

1. Endpoint/contrato para autoridad legal citada.
2. Golden queries de patentes municipales.
3. Cobertura visible de leyes, dictámenes y jurisprudencia usada.

### `chile-monitor`

1. Cliente de `TrustedDataProduct`.
2. Ontology de patentes.
3. EvidencePacket.
4. Cola y expediente.
5. Actions, permisos y audit log.
6. Campaña de provisorias.
7. Data Health de releases upstream.

## 16. Orden de concatenación con el plan general

Este documento debe incorporarse después de la decisión arquitectónica federada y antes del roadmap de implementación general:

1. enfoque administrativo europeo y justificación;
2. arquitectura federada y confianza en releases;
3. **producto vertical de patentes comerciales — este plan**;
4. solicitudes de transparencia;
5. seguridad y protección de datos;
6. roadmap de piloto y expansión a otros instrumentos.

Una vez validado el vertical de patentes, la misma estructura puede extenderse a alcoholes, permisos DOM, concesiones, subsidios y contratación pública sin cambiar la arquitectura central.
