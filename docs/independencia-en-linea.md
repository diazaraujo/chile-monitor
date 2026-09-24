# Independencia en línea

Vista comunal de Chile Monitor para una reunión matinal y una pantalla de despacho. Entrada independiente: `/independencia.html`; modo de pared: `/independencia.html?modo=despacho`. Sólo se construye con `VITE_VARIANT=chile` y no altera el dashboard nacional.

## Lo que funciona

- Resumen determinista de la mañana con clima, publicaciones de las últimas 24 horas y solicitud de parte de turno.
- Mapa centrado en Independencia, CUT 13108, límite de referencia Censo 2024, filtro de puntos SEIA y selección de proyectos.
- Publicaciones del RSS oficial municipal con fecha y enlace; no se clasifican como incidentes activos.
- Pronóstico horario para el centro de la comuna, temperaturas, viento, lluvia y UV, atribuido a Open-Meteo. No son alertas oficiales.
- Ficha territorial del corpus de Inteligencia Ambiental: registros acumulados, cobertura parcial, fuente y fecha propias. No confunde estadísticas regionales con comunales ni suma alias de una comuna.
- Actualización de pantalla cada minuto, consulta de fuentes cada diez minutos, estado de frescura y conservación de la última respuesta válida ante fallas.
- Modo despacho, pantalla completa, vista móvil y diálogo de fuentes.

## Datos que requieren integración municipal

Incidentes 1469, móviles, cámaras y cortes/servicios aparecen como «por conectar», sin contadores ficticios. El producto no asigna unidades, envía instrucciones ni confirma ausencia de emergencias. Para operación real se necesita un conector autorizado, identidad y control de acceso, trazabilidad de cada cambio y reglas de visibilidad de datos personales. No se han conectado señales privadas ni registros de víctimas.

La siguiente etapa debe aportar un parte de turno común, con identificador estable de incidente, origen, hora del hecho, hora de recepción, categoría, prioridad validada, estado, ubicación, responsable, última actualización y resolución. Esos eventos deben ser compartidos desde el servidor, no guardados sólo en el navegador del alcalde.

## Fuentes y alcance

| Fuente | Referencia | Semántica |
|---|---|---|
| Municipalidad | https://www.independencia.cl/feed/ | Títulos y enlaces, máximo diez publicaciones; no replica artículos |
| Open-Meteo | https://open-meteo.com/en/docs | Modelo meteorológico, punto -33.416, -70.666; hora original del dato |
| SEIA | https://seia.sea.gob.cl/ | `ficha-comuna.json`, `brief-territorial.json` y `seia-puntos.geojson` del corpus existente; cobertura parcial |
| Cartografía Censo 2024 | https://services5.arcgis.com/hUyD8u3TeZLKPe4T/arcgis/rest/services/CENSO2024_V2_gdb/FeatureServer/0 | Consulta CUT 13108, WGS84; límite de referencia, no certificación predial |
| Fondo cartográfico | OpenFreeMap / OpenStreetMap | Atribución visible en el mapa |

Se descartó el polígono local muy simplificado antes de preparar esta vista. El archivo `public/independencia/limite.geojson` conserva la referencia a la consulta de origen. Las tipografías DM Sans e IBM Plex Mono se sirven localmente, con sus licencias OFL.

## Operación

```sh
python3 scripts/chile-seed-independencia.py --data-dir /mnt/data/chile-monitor/public/chile
```

Produce `independencia.json` atómicamente. Una falla conserva el payload y las fechas del último éxito de esa fuente y cambia su estado a `error`. Una primera falla produce `data: null`. El estado global de la pantalla no interpreta ese valor como cero. El proceso devuelve 1 si alguna fuente falló, después de publicar el snapshot parcial.

Cron propuesto, sin solapamiento:

```cron
*/10 * * * * flock -n /tmp/chile-independencia-seed.lock timeout 100 python3 /RUTA-DEL-CODIGO/scripts/chile-seed-independencia.py --data-dir /mnt/data/chile-monitor/public/chile >> /mnt/data/chile-monitor/logs/independencia.log 2>&1
```

La página sólo lee el snapshot en el mismo origen. No incorpora secretos ni añade endpoints de escritura. El despliegue debe servir `/chile/independencia.json` desde los datos persistentes, como ya ocurre con el resto de `public/chile/`. En una vista previa separada, montar esa carpeta como sólo lectura. No publicar el contenido privado del municipio en este directorio público.

Frescura: clima y RSS 90 minutos; ficha territorial 8 horas. El RSS mide la última consulta exitosa, no la edad de la última noticia. El clima y el corpus usan su hora original. Los puntos del mapa muestran por separado la antigüedad del archivo espacial.

## Verificación

```sh
python3 tests/chile_independencia_test.py
node --import tsx --test tests/independencia.test.mts
npm run typecheck
npm run lint:boundaries
VITE_VARIANT=chile npx vite build
npx playwright test -c playwright.independencia.config.ts
```

Los tests cubren fallas de fuente, preservación de fechas, ausencia frente a cero, ámbito comunal, alias sin duplicación, rechazo de URLs ejecutables, modos de pantalla y ancho móvil. La comprobación de mapa y fuentes reales se completa en la instancia de vista previa antes de considerarla operativa.
