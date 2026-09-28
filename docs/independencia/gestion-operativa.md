# Gestión comunal: cobertura y preparación operativa

La portada ofrece perspectivas de Alcaldía, Concejo y Dirección sobre los mismos datos públicos. No son roles de autorización ni permiten modificar registros institucionales. El selector cambia preguntas y organización de la información; no concede permisos.

## Disponible

- Seguridad: inventario reportado por SINIM; no disponibilidad del turno.
- Salud: inscritos por centro y dependencia, producción anual y cuentas de gasto/ingreso reportadas. No sumar centros sin comprobar solapamiento ni sumar personal al gasto de salud.
- Educación: matrícula desagregada por dependencia. Asistencia, docentes y número de establecimientos siguen siendo agregados de toda la comuna.
- Concejo: presupuesto, cálculo devengado/vigente sólo con el mismo año, hallazgos y acceso a acuerdos extraídos. No confirma subsanación ni cumplimiento.
- Ficha de revisión: evidencia, cobertura faltante, referente propuesto, alternativas y descarga Markdown. No hay asignaciones, plazos, ahorros ni resultados inventados.

## Plantillas de preparación

Cinco CSV de encabezados en `public/independencia/plantillas/`: solicitudes, turnos, activos, suministros y compromisos. No contienen datos de ejemplo ni casos ficticios en producción.

Validación local:

```sh
python3 scripts/chile-validate-operational.py turnos /ruta/autorizada/turnos.csv
```

El validador no escribe, carga ni publica. Rechaza campos adicionales, duplicados por fuente/registro, cantidades no finitas o negativas, fechas sin zona y cierres sin referencia de evidencia. La validación de estructura no certifica veracidad ni anonimato: revisión humana obligatoria antes de aceptar el contenido.

`periodo` es el día de corte en formato YYYY-MM-DD; `observado_en` es una marca ISO con zona. Las unidades y tipos usan códigos acordados con la fuente. Los identificadores son opacos. `pendiente` indica una referencia aún no acreditada y no se admite como evidencia de cierre. No se utiliza el nombre de una persona como responsable: se usa una unidad institucional.

Solicitudes: recibidas/resueltas son flujos del período; pendientes es el saldo al corte. No se exige que estos tres valores sumen. Activos: operativos y sin verificar no pueden exceder el total reportado. Turnos: cantidades en la unidad declarada; una capacidad disponible mayor que la planificada requiere explicación de origen, no se elimina automáticamente. Suministros: consumo debe corresponder al período declarado; no se calculan días de cobertura con esta plantilla sin una ventana de consumo definida.

## Habilitación pendiente antes de operación restringida

1. Identificar fuente real, propietario y autorización para cada registro; acordar cobertura, significado de campos y frecuencia.
2. Incorporar identidad institucional y autorización en servidor por unidad/rol, con pruebas de denegación. Los controles visuales no sustituyen permisos.
3. Crear almacenamiento operativo separado de `public/chile`, con versiones, auditoría, retención y validación del responsable. Los CSV reales no deben guardarse en el repo, web pública ni snapshots públicos.
4. Implementar ingestión idempotente con staging, revisión, conciliación, publicación de agregados y reversión. El validador entregado sólo cubre la primera validación offline.
5. Integrar una muestra autorizada por área y demostrar el recorrido necesidad → recurso → intervención → cierre.

Hasta completar estas condiciones la portada dice «Operación diaria: sin registros conectados». No hay un endpoint de carga de datos restringidos habilitado.

## Límites de decisión

Los montos son históricos y no acreditan caja disponible ni posibilidad de reasignación. No sumar presupuesto y órdenes de compra, ni partidas potencialmente incluidas en otras. Los responsables son referentes propuestos, pendientes de asignación institucional. Una extracción de acuerdo o noticia no produce por sí sola una obligación confirmada ni acredita resultados.
