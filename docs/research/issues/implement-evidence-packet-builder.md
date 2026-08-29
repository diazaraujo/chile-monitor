# Issue draft: implementar builder reproducible de `EvidencePacket`

**Issue definitivo:** [#6](https://github.com/diazaraujo/chile-monitor/issues/6)

## Título sugerido

`feat(api): build reproducible commercial-license EvidencePackets`

## Secuencia

Este trabajo comienza después de que el PR
[#4](https://github.com/diazaraujo/chile-monitor/pull/4) esté integrado y su
cliente de `commercial-licenses` sea la base vigente. No debe duplicar ni
reemplazar el contrato, transporte, caché o validación upstream entregados por
ese PR.

Antes de implementar, ejecutar el preflight con el número `6` usando Node 24.

## Problema

Chile Monitor ya puede consumir respuestas validadas de Inteligencia
Inmobiliaria, pero todavía no puede convertirlas en un expediente autocontenido,
reproducible y de sólo lectura. Sin un builder común, cada consumidor podría
combinar releases, interpretar una limitación como incumplimiento, perder
referencias de fuente o producir hashes distintos para el mismo contenido.

## Resultado

Implementar un builder server-side tipado y fail-closed que construya un
`EvidencePacket` v0.1.0 conforme al schema contractual. Dado un caso, una patente
y entradas complementarias explícitas, el builder debe:

- consultar `patents.get` y `patents.timeline` con el mismo `release_id` fijado;
- incorporar opcionalmente una resolución de establecimiento ya consultada con
  release fijado;
- aceptar como entradas explícitas los hechos de otros productores que aún no
  tienen cliente en este repositorio;
- preservar temporalidad y provenance sin aplicar datos actuales
  retrospectivamente;
- registrar cada release y cada query utilizada;
- convertir datos ausentes, capabilities no disponibles, releases obsoletos y
  matches no resueltos en `gaps`, nunca en conclusiones de incumplimiento;
- detectar conflictos estructurales sin decidir cuál fuente tiene razón;
- calcular hashes reproducibles sobre representaciones canónicas;
- validar el paquete completo antes de devolverlo.

El resultado no constituye un acto administrativo ni una recomendación
automática.

## Dependencias

### Dependencia de código

- PR #4 integrado en la rama base;
- tipos, parsers y `CommercialLicensesClient` de
  `server/_shared/commercial-licenses-*` disponibles;
- schema contractual
  [`../contracts/evidence-packet.schema.yaml`](../contracts/evidence-packet.schema.yaml)
  mantenido como autoridad para v0.1.0.

### Entradas requeridas al builder

- `case_id`, CUT municipal y clasificación del caso;
- identificador de patente y `release_id` promovido o último release bueno
  explícitamente aceptado;
- fecha efectiva opcional para la fotografía histórica;
- versión inyectada del builder y reloj inyectado;
- política de acciones permitidas evaluada por el servidor;
- explicaciones alternativas, autoridades jurídicas y evidencia adicional como
  entradas ya trazables, no como texto generado por el builder.

Las integraciones reales con Legal Chile, Ambiental, Municipios, Mercado Público
y entidad jurídica no son requisito para probar el builder: sus resultados se
inyectan mediante puertos tipados y fixtures. La aceptación integrada con esos
productores queda para issues posteriores.

## Alcance

- tipos runtime para el documento y para las entradas del builder;
- builder puro en su núcleo, con un orquestador separado para llamadas al
  cliente;
- pinning coherente de release entre snapshot y timeline;
- traducción explícita de metadata upstream a `pinned_releases`;
- deduplicación estable de `source_refs` por `source_ref`, rechazando
  definiciones incompatibles para el mismo identificador;
- verificación de toda referencia entre objetos, evidencia, gaps, conflictos,
  explicaciones, autoridades y acciones;
- invariantes de `resolved`, `ambiguous` y `unresolved` para resolución predial;
- generación determinista de IDs derivados donde el contrato no entregue uno;
- orden estable de colecciones antes del hashing;
- SHA-256 de requests, responses y contenido del paquete mediante una
  serialización canónica documentada;
- exclusión de `reproducibility.packet_content_sha256` al calcular el hash del
  paquete;
- validación fail-closed contra las invariantes de
  `evidence-packet.schema.yaml` antes de devolver el resultado;
- errores tipados y seguros, sin incluir RUT, direcciones, cuerpos o evidencia
  en mensajes o logs;
- fixtures unitarios sintéticos para el happy path y los estados degradados.

## Reglas de composición

- `generated_at`, `queried_at`, `evaluated_at` y `detected_at` provienen del
  reloj inyectado cuando no existen en una entrada fuente.
- El mismo conjunto de entradas, versión del builder y reloj produce exactamente
  el mismo paquete y hashes.
- `pinned_releases` contiene únicamente releases efectivamente consultados; una
  capability fallida se expresa como gap.
- Cada `release_id` registrado coincide con la respuesta que originó los hechos.
- Una respuesta `stale_last_good` se conserva como tal y genera un gap
  `stale_release`.
- Toda limitación upstream material se preserva como gap o conflicto trazable.
- Un match ambiguo o no resuelto nunca adquiere `selected_candidate_id`.
- Un match resuelto sólo selecciona un candidato presente.
- Todo `source_ref` citado existe exactamente una vez en el registro
  autocontenido.
- Un titular o relación fuera del intervalo efectivo no se incorpora a la
  fotografía histórica.
- `recommended_next_action_id` es `null` o referencia una acción presente y
  permitida.
- El builder no inventa autoridades jurídicas, evidencia, explicaciones ni
  facultades del actor.

## Archivos previstos

- `server/_shared/evidence-packet-contract.ts`
- `server/_shared/evidence-packet-builder.ts`
- `server/_shared/evidence-packet-canonical.ts`
- `server/__tests__/evidence-packet-contract.test.ts`
- `server/__tests__/evidence-packet-builder.test.ts`
- `server/__tests__/evidence-packet-canonical.test.ts`
- `tests/fixtures/evidence-packets/`

Si la validación se genera desde el YAML, agregar el script fuente bajo
`scripts/` y mantener cualquier artefacto generado claramente identificado. No
editar `src/generated/` ni exponer el builder al navegador.

## Pruebas

### Contrato

- paquete mínimo válido;
- rechazo de campos adicionales y campos obligatorios ausentes;
- formatos de CUT, fechas, RUT jurídico y SHA-256;
- invariantes condicionales de release obsoleto, titular natural redactado y
  resolución predial;
- al menos una acción `permitted: true` y recomendación coherente.

### Builder

- patente vigente con snapshot y timeline en el mismo release;
- consulta histórica que excluye titulares y relaciones posteriores;
- release solicitado distinto al recibido;
- snapshot y timeline provenientes de releases distintos;
- `stale_last_good` visible y convertido en gap;
- capability complementaria no disponible convertida en gap;
- match resuelto, ambiguo y no resuelto;
- limitación upstream convertida sin inferir incumplimiento;
- conflicto entre dos fuentes preservado con ambas afirmaciones;
- `source_ref` faltante y duplicado incompatible rechazados;
- acción bloqueada por gap o conflicto;
- recomendación inexistente o no permitida rechazada;
- error sin datos de consulta en claro.

### Reproducibilidad

- mismas entradas, reloj y versión producen bytes canónicos y hashes idénticos;
- cambios de orden incidental no cambian el hash;
- un cambio material sí cambia el hash;
- el hash del contenido excluye su propio campo;
- cada `request_sha256` y `response_sha256` corresponde a los bytes canónicos
  acordados.

## Criterios de aceptación

- [ ] El builder produce un documento válido conforme a `EvidencePacket` v0.1.0.
- [ ] Snapshot y timeline quedan fijados al mismo release solicitado.
- [ ] Cada hecho material conserva al menos un `source_ref` resoluble.
- [ ] Todos los releases efectivamente usados aparecen en `pinned_releases`.
- [ ] No se crea un release ficticio para una capability ausente.
- [ ] `stale_last_good`, cobertura incompleta y matches no resueltos quedan
      visibles como gaps.
- [ ] Ninguna ausencia se representa como incumplimiento.
- [ ] Ningún valor actual se aplica retrospectivamente fuera de su vigencia.
- [ ] Conflictos conservan las afirmaciones y fuentes originales.
- [ ] Resoluciones prediales y acciones cumplen sus referencias e invariantes.
- [ ] La acción recomendada, si existe, está presente y permitida.
- [ ] La serialización canónica y todos los SHA-256 son deterministas.
- [ ] El paquete completo se valida antes de salir del builder.
- [ ] Los errores y logs no contienen cuerpos, RUT, direcciones ni tokens.
- [ ] Las pruebas del cliente de `commercial-licenses` continúan pasando.
- [ ] No se agrega código ni secretos `VITE_*`.

## Fuera de alcance

- crear o modificar casos, asignaciones o acciones en almacenamiento;
- UI, cola de revisión o expediente interactivo;
- endpoint público para descargar paquetes;
- firma digital, sellado de tiempo externo o almacenamiento inmutable;
- decidir si existe una infracción o emitir recomendaciones automáticas;
- ejecutar inspecciones, comunicaciones o actos administrativos;
- resolver conflictos de evidencia;
- generar explicaciones alternativas o análisis jurídico con IA;
- implementar clientes de productores distintos de Inteligencia Inmobiliaria;
- modificar el schema v0.1.0 durante la implementación sin un cambio contractual
  separado;
- reabrir decisiones de clasificación o acceso ya acordadas.

## Verificación

```bash
npm run --silent agent:preflight -- --issue <ISSUE>
./node_modules/.bin/vitest run \
  server/__tests__/commercial-licenses-contract.test.ts \
  server/__tests__/commercial-licenses-client.test.ts \
  server/__tests__/commercial-licenses-cache.test.ts \
  server/__tests__/evidence-packet-contract.test.ts \
  server/__tests__/evidence-packet-builder.test.ts \
  server/__tests__/evidence-packet-canonical.test.ts
npm run typecheck:api
npm run lint:boundaries
git diff --check
git status --short
```

El preflight debe quedar en estado `ready` y permitir pruebas costosas antes de
implementar. La entrega de este issue termina en código localmente verificado y
PR listo; integración, despliegue y aceptación empírica son estados separados.
