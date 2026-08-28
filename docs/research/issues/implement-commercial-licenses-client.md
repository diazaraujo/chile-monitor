# Issue draft: implementar cliente server-side de `commercial-licenses`

## Título sugerido

`feat(api): consume promoted commercial-licenses releases server-side`

## Problema

Chile Monitor necesita consultar patentes, establecimientos y resolución predial
sin ingerir archivos municipales ni duplicar el data product de Inteligencia
Inmobiliaria. Hoy existe el contrato, pero no un cliente server-side validado que
fije releases y preserve trazabilidad para construir `EvidencePacket`.

## Resultado

Implementar un cliente interno tipado para las cinco capabilities v0.1, con
validación runtime, errores seguros, release pinning y caché que no exponga datos de
consulta.

## Dependencias externas

- URL de staging del productor;
- autenticación y rotación de credenciales;
- major de schema soportada;
- release y fixtures del municipio piloto.

Estas dependencias bloquean aceptación integrada, pero no las pruebas unitarias con
fixtures sintéticos.

## Alcance

- `patents.get` con consulta `effective_on` y release opcional;
- `patents.search` con cursor ligado a filtros y release;
- `patents.timeline`;
- `patents.coverage`;
- `establishments.resolve`;
- validación de metadata, temporalidad, fuentes y estados de resolución;
- errores tipados sin registrar cuerpos, RUT ni direcciones;
- caché sólo de respuestas promovidas y validadas;
- soporte visible de `stale_last_good`;
- tipos consumibles por el constructor de `EvidencePacket`.

## Fuera de alcance

- loaders o parsers municipales;
- acceso directo a tablas de Inteligencia Inmobiliaria;
- cliente en navegador;
- decisiones administrativas automáticas;
- UI de casos;
- endpoint público nuevo;
- `parcel.resolve` duplicado;
- pagos e inspecciones hasta confirmar cobertura del piloto.

## Archivos previstos

- `server/_shared/commercial-licenses-contract.ts`
- `server/_shared/commercial-licenses-client.ts`
- `server/_shared/commercial-licenses-cache.ts`
- `server/__tests__/commercial-licenses-contract.test.ts`
- `server/__tests__/commercial-licenses-client.test.ts`
- `server/__tests__/commercial-licenses-cache.test.ts`
- `tests/fixtures/commercial-licenses/`

## Criterios de aceptación

- [ ] Las cinco operaciones serializan correctamente método, path, query y body.
- [ ] Toda respuesta se valida antes de devolverse o cachearse.
- [ ] Productor, producto, quality status y schema incompatibles son rechazados.
- [ ] Un `release_id` explícito debe coincidir exactamente con la respuesta.
- [ ] Objeto ausente, release inexistente y brecha de cobertura son distinguibles.
- [ ] `resolved`, `ambiguous` y `unresolved` cumplen sus invariantes.
- [ ] Todos los `source_ref` materiales pueden resolverse.
- [ ] Consultas históricas no reciben atributos actuales como fallback.
- [ ] `stale_last_good` queda visible al consumidor.
- [ ] Claves y logs no contienen datos sensibles de consulta en claro.
- [ ] Fallas, timeouts y JSON inválido producen errores tipados.
- [ ] Los diez fixtures contractuales pasan los gates aplicables.
- [ ] No se agrega código ni secreto `VITE_*`.

## Contratos

- [`../contracts/commercial-licenses.openapi.yaml`](../contracts/commercial-licenses.openapi.yaml)
- [`../contracts/commercial-licenses.fixtures.yaml`](../contracts/commercial-licenses.fixtures.yaml)
- [`../contracts/commercial-licenses-acceptance.md`](../contracts/commercial-licenses-acceptance.md)
- [`../contracts/commercial-licenses-client-design.md`](../contracts/commercial-licenses-client-design.md)
- [`../contracts/evidence-packet.schema.yaml`](../contracts/evidence-packet.schema.yaml)

## Verificación

```bash
npm run --silent agent:preflight -- --issue <ISSUE>
./node_modules/.bin/vitest run \
  server/__tests__/commercial-licenses-contract.test.ts \
  server/__tests__/commercial-licenses-client.test.ts \
  server/__tests__/commercial-licenses-cache.test.ts
npm run typecheck:api
npm run lint:boundaries
git diff --check
git status --short
```

El preflight debe ejecutarse con Node 24 y quedar en estado `ready` antes de
implementar.
