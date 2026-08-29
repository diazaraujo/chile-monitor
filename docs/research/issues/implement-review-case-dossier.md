# Issue draft: proyectar expedientes `ReviewCase` autorizados y de sólo lectura

**Issue definitivo:** [#8](https://github.com/diazaraujo/chile-monitor/issues/8)

## Título sugerido

`feat(api): project authorized read-only ReviewCase dossiers`

## Secuencia

Este incremento comienza después de integrar el builder reproducible de
`EvidencePacket` del issue #6. Cierra la primera parte del Bloque D: permite
leer un expediente fijado sin crear casos, ejecutar Actions ni decidir todavía
el almacenamiento definitivo.

## Problema

Chile Monitor puede construir y validar un `EvidencePacket`, pero aún no tiene
un límite de dominio que represente el expediente operacional de un caso. Un
consumidor podría leer el paquete equivocado, usar `latest`, omitir la
autorización municipal o interpretar `permitted_next_actions` como permiso
vigente para actuar.

## Resultado

Implementar un read model server-side, tipado y fail-closed que proyecte un
`ReviewCaseDossier` desde un snapshot de caso preexistente y su
`EvidencePacket` exacto. La misma versión del caso y el mismo paquete deben
producir la misma proyección.

El expediente es informativo y de sólo lectura. No constituye una decisión
municipal, no ejecuta acciones y no actualiza automáticamente el paquete.

## Alcance

- contrato runtime cerrado para `ReviewCaseSnapshot` y `ReviewCaseDossier`;
- referencia fija por `packet_id`, `packet_content_sha256`, schema, fecha,
  release primario y unión confiable de markings requeridos;
- `case_id`, `case_version`, CUT, patente, estado, clasificación y timestamps;
- puerto de lectura inyectable para un snapshot atómico por `case_id` y
  `case_version`, y para el paquete por el tuple completo del caso;
- autorización inyectada y derivada por el servidor, evaluada primero sobre el
  caso y luego sobre la unión efectiva de markings del paquete;
- servicio `getReviewCaseDossier` sin efectos laterales;
- validación completa del `EvidencePacket` y recálculo de su hash;
- coincidencia exacta entre caso, paquete, CUT, patente y clasificación;
- proyección de gaps, conflictos, ambigüedades y frescura sin decidir su mérito;
- paquete exacto envuelto como snapshot histórico no ejecutable, nunca expuesto
  como una autorización corriente;
- snapshot explícito de próximas acciones que nunca funciona como autorización
  ejecutable;
- errores seguros e indistinguibles para caso inexistente o acceso denegado;
- límites configurables de tamaño antes de procesar el paquete.

## Reglas de autorización

- identidad, roles, CUT y markings autorizados son entradas confiables del
  servidor; no provienen del body del cliente;
- el request del lector exige `case_id` y `case_version`; nunca resuelve
  implícitamente `latest`;
- se autoriza antes de devolver cualquier evidencia;
- todo acceso queda limitado al municipio del caso;
- el mínimo inicial exige que el actor pueda leer todas las marcas requeridas,
  incluidas las de evidencia y releases anidados;
- los markings requeridos del recibo se autorizan antes de cargar el paquete y
  luego se comparan con la unión recalculada desde su contenido;
- denegación e inexistencia usan el mismo error seguro;
- ninguna caché puede omitir actor/scope, `case_version` o hash del paquete.

## Criterios de aceptación

- [ ] El expediente usa únicamente el paquete fijado por el caso, nunca
      `latest`.
- [ ] Se recalcula y verifica `packet_content_sha256`.
- [ ] Coinciden `case_id`, CUT, `license_id`, clasificación y referencia del
      paquete.
- [ ] El loader recibe CUT, caso, versión, paquete y hash esperados; no existe
      lookup global por `packet_id` ni lectura implícita de `latest`.
- [ ] Un paquete alterado, ausente, incompatible o demasiado grande falla
      cerrado.
- [ ] Un acceso entre municipios o con markings insuficientes no revela la
      existencia del caso.
- [ ] Errores y logs no incluyen RUT, direcciones, evidencia, cuerpos ni tokens.
- [ ] Gaps, conflictos y ambigüedades permanecen visibles y no se traducen en
      incumplimiento.
- [ ] `permitted_next_actions` queda rotulado como evaluación histórica y no
      como autorización para ejecutar; toda entrada proyectada declara
      `executable: false`.
- [ ] El paquete completo sólo aparece dentro de un namespace con naturaleza
      literal `historical_non_executable`.
- [ ] El lector no escribe, refresca, asigna, recomienda ni cierra casos.
- [ ] La misma versión del caso y el mismo paquete producen la misma proyección.
- [ ] Las pruebas cubren hash alterado, referencias cruzadas, acceso entre
      municipios, clasificación insuficiente, paquete obsoleto y acción
      candidata desactualizada.

## Archivos previstos

- `server/_shared/review-case-contract.ts`
- `server/_shared/review-case-reader.ts`
- `server/__tests__/review-case-contract.test.ts`
- `server/__tests__/review-case-reader.test.ts`

## Fuera de alcance

- endpoint público o cliente de navegador;
- crear o modificar casos;
- `OpenLicenseReview`, asignaciones o cambios de estado;
- ledger, base de datos definitiva, cola o UI;
- comunicaciones, inspecciones, medidas y actos oficiales;
- recalcular el `EvidencePacket` desde releases nuevos;
- usar una próxima acción histórica como permiso vigente;
- reabrir las decisiones de privacidad y clasificación ya acordadas.

## Verificación

```bash
npm run --silent agent:preflight -- --issue <ISSUE>
./node_modules/.bin/vitest run \
  server/__tests__/evidence-packet-contract.test.ts \
  server/__tests__/evidence-packet-canonical.test.ts \
  server/__tests__/review-case-contract.test.ts \
  server/__tests__/review-case-reader.test.ts
npm run typecheck:api
npm run lint:boundaries
npm run lint:api-contract
```

## Siguiente incremento

Después de este lector, implementar autoridad municipal persistida y una única
acción append-only, `OpenLicenseReview`, con idempotencia, CAS sobre
`case_version`, verificación del hash del paquete y efecto jurídico `none`.
