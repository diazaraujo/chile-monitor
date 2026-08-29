# Handoff a Inteligencia Inmobiliaria: `commercial-licenses`

**Estado:** listo para revisión del productor

**Consumidor:** Chile Monitor

**Objetivo:** habilitar expedientes reproducibles de patentes sin reingesta.

## Decisión solicitada

Confirmar que Inteligencia Inmobiliaria será el productor canónico de la relación:

```text
patente → establecimiento → dirección/rol → predio
```

La municipalidad conserva la autoridad sobre la patente y sus actos. Chile Monitor
consume releases promovidos y sólo administra casos, revisión y acciones internas.

## Entrega requerida para iniciar

| Entrega | Contenido | Responsable | Fecha |
|---|---|---|---|
| Revisión contractual | observaciones o aprobación del OpenAPI v0.1 | por asignar | por acordar |
| Staging | base URL accesible desde Chile Monitor | por asignar | por acordar |
| Autenticación | mecanismo, audiencia, header, rotación y autorización | por asignar | por acordar |
| Compatibilidad | major de `schema_version` y política de cambio | por asignar | por acordar |
| Release piloto | `release_id`, metadata y quality report | por asignar | por acordar |
| Fixtures | diez casos reales anonimizados/sintéticos con resultados esperados | por asignar | por acordar |
| Operación | frecuencia, SLA, contacto y procedimiento de incidentes | por asignar | por acordar |

## Capabilities v0.1

1. `patents.get`
2. `patents.search`
3. `patents.timeline`
4. `patents.coverage`
5. `establishments.resolve`

El contrato está en
[`contracts/commercial-licenses.openapi.yaml`](contracts/commercial-licenses.openapi.yaml)
y se acepta mediante
[`contracts/commercial-licenses-acceptance.md`](contracts/commercial-licenses-acceptance.md).

## Reglas operacionales

- Cada respuesta identifica el release exacto.
- Un release solicitado explícitamente nunca cambia silenciosamente a `latest`.
- Las respuestas conservan valor fuente, normalizado, fechas y `source_ref`.
- Los matches informan método, confianza y candidatos; la ambigüedad permanece visible.
- La falta de publicación se comunica como brecha y no como cumplimiento o incumplimiento.
- Una caída usa el último release bueno de forma visible o falla explícitamente.
- Se aplica la política de acceso y publicación ya acordada; este handoff no la reabre.

## Alcance diferido

El contrato v0.1 no agrega una segunda implementación de `parcel.resolve`: consume el
release predial existente mediante `establishments.resolve` y `parcel_matches`.

Pagos, mora e inspecciones permanecen en el modelo de datos del productor, pero no
bloquean la primera conexión read-only orientada a patentes provisorias. Se agregan
al contrato cuando el municipio piloto confirme cobertura y grano; su ausencia debe
aparecer en `patents.coverage`.

## Respuesta solicitada

Para cerrar el handoff basta responder:

```text
Owner técnico:
Owner del dato:
OpenAPI v0.1: aprobado / comentarios adjuntos
URL staging:
Autenticación:
Schema major soportada:
Primer release estimado:
Frecuencia de actualización:
SLA/incidentes:
Limitaciones conocidas:
```

Con esos datos Chile Monitor puede iniciar el cliente server-side sin acceso a
tablas internas ni archivos municipales.
