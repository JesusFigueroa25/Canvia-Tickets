# Plan de pruebas

## Alcance y estado de evidencia

Este plan describe archivos y aserciones inspeccionados en `Gestión_tickets/test/` y los comandos que pueden ejecutarlos. No se ejecutó ninguna prueba en esta tarea; por tanto, no hay resultados, tasas de cobertura ni estado de aprobación que reportar. No se encontró configuración propia de pytest (`pytest.ini`, `pyproject.toml`, `setup.cfg` o `tox.ini`) en el backend.

## Pruebas automatizadas principales

Los tres archivos `test_incident_analysis_ai*.py` bajo `Gestión_tickets/test/` usan pytest. El primer comando es el utilizado por el equipo. Ejecutar desde `Gestión_tickets/`:

```powershell
py -m pytest test\test_incident_analysis_ai_decision.py test\test_incident_analysis_ai_cross.py -v
```

El comando anterior **no incluye** `test_incident_analysis_ai.py`. Para ejecutar esa suite aislada:

```powershell
py -m pytest test\test_incident_analysis_ai.py -v
```

Para que pytest descubra todos los archivos con patrón `test_*.py` bajo `test/`, incluidos los de `test/Otros/`:

```powershell
py -m pytest test -v
```

La última orden es un comando de descubrimiento coherente con los nombres de archivo; no se verificó que toda la colección sea ejecutable en un entorno común ni que no requiera configuración adicional.

| Archivo | Tipo/evidencia de integración | Qué comprueba el código de prueba |
|---|---|---|
| `test/test_incident_analysis_ai_decision.py` | Unitarias con pytest; sustituye la llamada al modelo; docstring declara sin OpenAI ni SQL Server. | Catálogo de hallazgos; comparación de periodos completos; exclusión de identificadores privados del contexto; rechazo de cifras/evidencias inventadas; conservación del schema Angular; fallback operativo, reintento y ensamblado de narrativa. |
| `test/test_incident_analysis_ai_cross.py` | Unitarias con pytest y mocks; docstring declara sin SQL Server ni OpenAI. | Conteo único de tickets y menciones; cobertura de muestra; cruces y denominadores; redacción de menciones como evidencia no como acción verificada; no exposición de datos sensibles; filtros y compilación de consultas en dialecto SQL Server; compatibilidad de narrativa con el contrato. |
| `test/test_incident_analysis_ai.py` | Unitarias con pytest; carga aislada del módulo y sustituye dependencias; docstring declara sin SQL Server ni consumo de tokens. | Filtrado de fechas/proyecto, referencias y cifras permitidas, ausencia de texto de tickets en el contexto, fallback cuando faltan credenciales o falla OpenAI, diagnóstico seguro y parámetros de respuesta del modelo. |

### Pruebas unitarias complementarias de `test/Otros/`

Estos archivos llevan prefijo `test_` y contienen clases `unittest.TestCase`/`TestCase`, por lo que pytest puede descubrirlos. Sus objetivos se identifican por las clases, imports y casos presentes; la ejecución conjunta no se ha comprobado.

| Archivo | Área que cubre |
|---|---|
| `Otros/test_tool_service.py` | Registro de herramientas analíticas, validación de fuente/herramienta, filtros incompatibles y fechas. |
| `Otros/test_requirement_categorization_audit.py` | Reglas de auditoría, schemas, repositorio, servicio y controlador, con dependencias simuladas. |
| `Otros/test_query_service.py` | Validación y planificación de consultas analíticas, filtros y límites. |
| `Otros/test_context_service.py` | Composición y actualización del contexto conversacional. |
| `Otros/test_chat_service.py` | Interpretación de preguntas y comportamiento de chat mediante un cliente OpenAI simulado. |
| `Otros/test_chat_router.py` | Enrutamiento de solicitudes del chat a herramientas/consultas y tratamiento de planes. |
| `Otros/test_chat_redaccion.py` | Redacción/formato de respuestas del chat y fallback ante errores de OpenAI. |
| `Otros/test_chat_patch_temporal.py` | Cambios/patches temporales del contexto del chat y sus validaciones. |
| `Otros/test_chat_orquestacion.py` | Orquestación de interpretación, consulta, redacción, persistencia y rollback usando dobles de prueba. |
| `Otros/test_categorization_engine.py` | Reglas y decisiones del motor de categorización con datos sintéticos. |
| `Otros/test_ai_chat_api.py` | Contrato y rutas de chat a través de `TestClient` con resultados y persistencia simulados. |

## Validaciones de integración y manuales

### API de análisis ejecutivo

`test/prueba_analisis_incidentes_ia_api.py` no es una prueba unitaria: llama a una instancia FastAPI real. Exige `--confirm-live`; sin esa opción termina con error de argumento. Desde `Gestión_tickets/`, una ejecución local puede adoptar esta forma (ajustar solo la URL al entorno autorizado):

```powershell
py .\test\prueba_analisis_incidentes_ia_api.py --base-url http://127.0.0.1:8080/incident-consolidated --confirm-live
```

La URL por defecto del script es `http://127.0.0.1:8000/incident-consolidated`, que no coincide con el puerto 8080 declarado por el Dockerfile y la guía local; usar `--base-url` o `CANVIA_API_BASE` para indicar el destino correcto. El script puede enviar `Authorization: Bearer ...` si está presente `CANVIA_TEST_TOKEN`, sin requerir que se incluya su valor en la documentación.

La validación consulta KPI, causas, atribución y distribución ajustada, y luego ejecuta el POST de análisis ejecutivo. Comprueba consistencia de totales/denominadores, conteo de causas, atribuciones, ajustes pendientes, unicidad de códigos y referencias de conclusiones. `--require-ia` falla si el origen no es IA; `--require-cross` exige evidencia de cruces/patrones. La propia prueba advierte que el POST puede consumir tokens si el servidor tiene OpenAI configurado. No usar contra producción sin autorización y presupuesto aprobados.

**Aprobación esperada, no resultado observado:** código de salida 0 y mensaje `OK: denominadores, conteos y referencias consistentes.`; si se solicitaron `--require-ia` o `--require-cross`, también debe cumplirse esa condición.

### SQL de solo lectura

`test/validar_filtros_analisis_ia.sql` contiene consultas `SELECT` para contrastar conteos/atribuciones con filtros y límites de fecha. No modifica datos según el contenido inspeccionado. Requiere escoger explícitamente una conexión/base de pruebas y comparar el resultado con la respuesta API; no se ejecutó ni se validó su conexión.

### Scripts manuales y pruebas contra dependencias reales

`test/Otros/` también contiene scripts `prueba_*.py` de consulta con SQL Server, chat con OpenAI, herramientas, categorización semántica y escrituras de evaluación. No siguen el patrón `test_*.py` de descubrimiento por defecto. Algunos declaran o evidencian consumo de proveedor, requieren conexión o pueden escribir; revisar el archivo y el destino antes de ejecutarlos. Ejemplos identificables por nombre: `prueba_chat_router_sqlserver.py`, `prueba_chat_redaccion_sqlserver.py`, `prueba_chat_orquestacion_sqlserver.py`, `prueba_tools_sqlserver.py`, `prueba_ai_chat_api_sqlserver.py`, `prueba_requirement_categorization_sqlserver.py` y `prueba_gpt4_conexion.py`.

Los scripts de registro/experimentos CSV dentro de `Otros/` son material de evaluación manual, no resultados automatizados de CI. El nombre de un archivo no demuestra que haya sido ejecutado ni que su resultado siga vigente.

## Criterios de aprobación

1. Para pytest: proceso finaliza con código 0, sin errores ni tests fallidos. El resumen debe indicar cuántos tests fueron descubiertos; un resultado con 0 tests no cuenta como aprobación.
2. Para la validación HTTP: se cumplen las aserciones de conteos, sumas, códigos y referencias descritas arriba. Usar flags de exigencia solo cuando el entorno esté configurado para satisfacerlos.
3. Para SQL: los agregados de la consulta de solo lectura concuerdan con el endpoint usando los mismos filtros y límites temporales.
4. Registrar destino/commit, entorno, versión de Python y configuración no sensible cuando se publiquen resultados. No guardar tokens ni valores de variables de entorno en evidencias.

No se especifican umbrales de cobertura porque no hay cobertura reportada ni objetivo configurado revisado.

## Pruebas adicionales propuestas

### Reporte PNG de Auditoría de Categorización

**Rediseño ejecutivo validado el 25/11/2026.** Desde `fronted-tickets/`, con las dependencias ya instaladas:

```powershell
npm test -- --watch=false --include="**/requirement-categorization-audit.spec.ts" --include="**/requirement-categorization-report*.spec.ts"
npm run build
```

Resultado: **52 pruebas aprobadas en tres archivos** (21 del padre, 10 de composición/renderizado y 21 de utilidades). Cubren cantidades, tasas y denominadores por contrato; contadores de filas/errores distintos de tickets; ranking por incorrectas/total/nombre y cero incorrectas; motivos completos y redondeo; meses dispersos y cruces de año; análisis 3/1/3 determinístico sin mutación; tres KPI/cuatro gráficos sin tablas; textos largos; carga/404/cancelación, filtros/copias/versiones obsoletas, render, doble clic, captura, timeouts de 30 segundos, entrega tardía, reintento y destrucción.

La compilación de producción termina con código 0: bundle inicial **2.84 MB**. Conserva advertencias de presupuestos de bundle/estilos; no se alteran esos presupuestos ni dependencias. Se autorizó acceso a Google Fonts para la fuente global que ya utiliza el proyecto.

**Regresión de Reporte 1 de Incidentes y R01–R04:**

```powershell
npm test -- --watch=false --include="**/requirement-categorization-audit.spec.ts" --include="**/requirement-categorization-report*.spec.ts" --include="**/incident-consolidated*.spec.ts" --include="**/incident-monthly-report*.spec.ts" --include="**/incident-project-report*.spec.ts" --include="**/incident-project-monthly-report*.spec.ts" --include="**/incident-recurring-alerts-report*.spec.ts" --include="**/incident-executive-summary-report*.spec.ts" --include="**/incident-cause-analysis-summary-report.spec.ts"
```

Resultado: **256 aprobadas y tres fallidas de 259**, 18 archivos. Los tres fallos fueron reproducidos antes de modificar código: dos en `incident-executive-summary-report.spec.ts` (selectores `.analysis-origin` y `.adjustment-state` ausentes en la presentación actual) y uno en `incident-project-report.spec.ts:70` (texto esperado «máximo mensual» frente a la nota actual por proyecto/mes). Esos componentes/specs no se modifican. La ejecución inicial registraba además un fallo de categorización por el orden anterior; ahora pasa con el nuevo criterio expresamente aprobado. No se afirma que toda la suite del repositorio esté aprobada.

**PNG real con Edge sin interfaz y API ficticia en localhost**, sin iniciar FastAPI ni consultar SQL Server:

| Caso | Documento CSS | PNG a escala 2 |
|---|---|---|
| General, doce meses y doce colaboradores | 1400 × 1279 | **2800 × 2558 px** |
| Proyecto completo y filtro mensual aplicado desde el dashboard, un mes recibido | 1400 × 1306 | **2800 × 2612 px** |
| Cinco motivos, incluidas categorías adicionales completas y `SIN_DATO` | 1400 × 1352 | 2800 × 2704 px |
| Veinticuatro meses, todos recibidos, sin fragmentación | 1400 × 1351 | 2800 × 2702 px |
| Nombre largo íntegro incluido en el Top 10 | 1400 × 1301 | 2800 × 2602 px |
| Todas correctas / todas incorrectas | 1400 × 1359 | 2800 × 2718 px en cada caso |

Los siete casos descargan PNG válidos, sin excepciones JS ni HTTP adicional al descargar. Se verifican orden y geometría 2×2, todos los meses/motivos recibidos, ranking y KPI, tres hallazgos/recomendaciones, un único botón, ausencia de controles/tablas dentro del documento, cero desbordamientos/scroll/textos fuera de sus cajas y permanencia de ambas tablas interactivas del dashboard. En el filtrado, las cuatro consultas comparten exactamente proyecto y mes; la descarga funciona incluso con tickets pendientes. Se revisaron visualmente los PNG general, filtrado, motivos adicionales y 24 meses.

Dos casos adicionales verifican que no se descargue un PNG: 40 meses que no caben legiblemente y porcentaje de motivo incoherente. Se muestran los mensajes correspondientes, sin eliminar registros para forzar la captura.

Arnés local y evidencias, excluidos de Git: `.angular/png-audit-executive-smoke/verify.mjs`, `result-<caso>.json`, `downloads-<caso>-*/`. Ejecución local posterior a compilar: `node .angular/png-audit-executive-smoke/verify.mjs general` o `filtros`; también admite `motivos`, `meses24`, `nombres`, `correctas`, `incorrectas`, `ilegible`, `inconsistente`. Los datos son ficticios; no contienen credenciales ni información productiva.

**Evidencia histórica:** el 18/11/2026 se validó el reporte largo anterior (23 pruebas iniciales, 25 tras el primer ajuste del Top 10 y PNG 2800 × 5830). Esa evidencia no describe el nuevo diseño; tampoco los resultados históricos de otras secciones sustituyen la regresión fechada arriba. Reglas actuales: [PRD 02](requirements/02_reporte_png_auditoria_categorizacion_PRD.md) y [arquitectura](ARCHITECTURE.md#reporte-png-de-auditoría-de-categorización).

Pendientes: aceptación con datos reales, otros navegadores y concurrencia real entre las cuatro consultas independientes. La prueba local no acredita ejecución de auditorías, calidad de su motor ni resultados contra SQL Server.

### Reporte PNG de Tiempos de Informes Mensuales

Desde `fronted-tickets/`, con las dependencias existentes:

```powershell
npm test -- --watch=false --include="**/tickets-report-times.spec.ts" --include="**/tickets-report-times-report*.spec.ts"
npm test -- --watch=false
npm run build
```

Los tres specs nuevos del padre, reporte y utilidades cubren respuestas en distinto orden; espera de las seis consultas; tablas con más de 100 registros y última página parcial; cola de dos solicitudes; caché y reintento de páginas; timeout; fallo de cada consulta inicial; metadatos, registros duplicados e inconsistencias; filtros efectivos y copias independientes; cambio de mes y limpieza; versiones de datos y render; ausencia de resultados; independencia de la paginación visual; seis secciones y bloques de meses; Top 10; nombres extensos; fuentes y ciclos de pintura; límites y dimensiones inválidas; fallos de render/captura; doble clic, descarga repetida, limpieza del enlace y abandono de página. Los conteos distintos no se reconstruyen sumando grupos y las diferencias de redondeo se prueban expresamente.

**Evidencia del 18/11/2026**, Node 24.20.0 y dependencias instaladas, sin FastAPI ni SQL Server:

- Los **35 casos nuevos pasan**. La suite completa registra **66 aprobados y tres fallos** en specs no modificados: `App` no reconoce `app-landing`, `Login` carece de proveedor de `ActivatedRoute` y el reporte de Categorización aún espera el antiguo orden por incorrectas frente al código actual por total de tickets. No se corrigen esos módulos dentro de esta funcionalidad.
- La compilación de desarrollo y la de producción finalizaron con código 0. La primera ejecución de producción falló por resolución de Google Fonts en el entorno restringido; se completó con acceso de red autorizado a los estilos globales existentes. Persisten advertencias de presupuesto del bundle inicial y de estilos. No se modificaron dependencias ni presupuestos.
- Edge sin interfaz sirvió la compilación con respuestas ficticias locales, completó **144 registros mensuales por dimensión** y descargó un PNG real de **1400 × 7046 px**, revisado visualmente. Contiene exactamente seis secciones, doce meses, doce resolutores y doce proyectos en las matrices, con rankings de diez. Las cuatro tablas representan dos bloques semestrales por dimensión; no son páginas parciales.
- El arnés detectó cero desbordamientos de tablas/paneles y cero textos SVG fuera de sus límites. No observó excepciones JavaScript. Verificó recuperación tras un fallo HTTP ficticio de la página adicional: el reintento consultó solo la página faltante. Dos descargas sucesivas no generaron HTTP adicional.
- La selección dinámica de febrero redujo el detalle a doce registros por dimensión, mantuvo los doce meses del resumen ejecutivo y reflejó el mes efectivo en el reporte. Las evidencias y el arnés temporal están en `.angular/png-report-times-smoke/`, ignorado por Git.

**Pendiente:** aceptación con datos reales; contraste con consultas SQL Server; filtros con proyectos/grupos reales; comparación visual en otros navegadores; rendimiento y legibilidad cerca del límite de imagen; cambios concurrentes de datos entre páginas. La lectura multipetición no equivale a un snapshot transaccional backend. Reglas y límites: [ARCHITECTURE.md](ARCHITECTURE.md#reporte-png-de-tiempos-de-informes-mensuales).

### Reporte PNG R01 de Incidentes Consolidados

Desde `fronted-tickets/`:

```powershell
npm test -- --watch=false --include="**/incident-consolidated.spec.ts" --include="**/incident-monthly-report*.spec.ts"
npm test -- --watch=false
npm run build
```

Los tres specs de R01 cubren cronología y cruce de años, ceros y vacío, empates, meses parciales y disponibilidad general, fecha de Lima, año bisiesto, base cero, precisión, datos inválidos, filtros copiados sin `periodo`, selección dinámica de mes, independencia del formulario pendiente, respuestas/renders obsoletos, debounce, HTTP/timeout, reintentos de consulta/render/captura, fuentes y pinturas, dimensiones, doble clic, abandono de página, nombre de archivo y limpieza del enlace.

Ejecución del 24/11/2026:

- **38 pruebas de R01 aprobadas** dentro de la suite completa: **104 aprobadas y 3 fallidas**. Los fallos corresponden a los casos ya documentados de App (`app-landing` desconocido), Login (sin proveedor de `ActivatedRoute`) y categorización (orden esperado por incorrectas frente al orden actual por total). Esos archivos no se modificaron para R01.
- Compilación de producción terminada con código 0. El primer intento falló por DNS al descargar Google Fonts del estilo global existente; el reintento con acceso autorizado a red compiló. Persisten advertencias de tamaño del bundle inicial y de estilos, incluido el padre de Incidentes Consolidados; no se modificaron presupuestos ni dependencias.
- Edge sin interfaz sirvió la compilación con respuestas ficticias locales, sin iniciar FastAPI ni consultar bases. Simuló un error HTTP inicial y comprobó que el reintento consultara solo el volumen; la descarga posterior no generó HTTP adicional.
- Descargó y verificó un PNG real de **2800 × 4276 px**, correspondiente a un documento de **1400 × 2138 px CSS**, con 14 meses en dos gráficos, 3 KPI, 480 incidentes y dos meses parciales. La inspección visual confirmó contenido completo; no se detectaron controles interactivos, desbordamientos de paneles/textos SVG ni excepciones JavaScript.
- El arnés y las evidencias se guardaron en `.angular/png-incident-monthly-smoke/`, ignorado por Git. Solo utilizan datos ficticios. El registro `result.json` contiene dimensiones y resultado de las verificaciones.

Ajuste visual del 24/11/2026:

- Se ejecutaron nuevamente los tres specs de R01: **38 aprobadas**. Se conservaron los casos de cálculo, filtros y exportación; el spec presentacional comprueba el período dentro de la cabecera, tres iconos KPI, gráficos separados de los SVG de iconos, colores por mes y conservación literal de hallazgos, conclusión y recomendación.
- `npm run build` terminó con código 0 y las advertencias de tamaño de bundle/estilos existentes. No se alteraron modelos, funciones de cálculo, coordinador de descarga, backend ni dependencias.
- Edge descargó el PNG completo del diseño horizontal: **2800 × 3304 px**, documento de **1400 × 1652 px CSS**. El arnés verificó gráfico a la izquierda y hallazgos a la derecha en una fila, tres KPI alineados, 14 colores para 14 barras, tres iconos KPI y cuatro iconos de hallazgos, período en cabecera, ausencia de controles/desbordamientos y descarga sin HTTP adicional. Se revisó visualmente la captura final, incluidos fuentes y líneas del SVG expresadas como atributos para conservar su apariencia en PNG.
- La imagen de referencia no estaba adjunta al mensaje de ajuste; se implementaron las indicaciones visuales detalladas por el usuario. Las evidencias finales están en el mismo arnés local ignorado por Git.

Rediseño de infografía ejecutiva del 24/11/2026:

- Specs relacionados con R01: **39 aprobados**, incluidos cálculos y estados de exportación existentes. El caso presentacional de rango largo verifica que no desaparecen meses ni se crean hallazgos de relleno. Se conserva la comparación literal de hallazgos, conclusión y recomendación frente a la instantánea, aunque los números se presenten en negrita.
- `npm run build` finalizó con código 0. Persisten advertencias de tamaño del bundle y estilos del proyecto. Se verificó mediante hashes que no cambiaron las utilidades de cálculo, el modelo de instantánea ni el coordinador de solicitudes/descarga.
- Edge descargó un PNG real de **2800 × 2008 px** para el documento de **1400 × 1004 px CSS** con 14 meses y cuatro hallazgos: composición horizontal, aproximadamente 39 % menos altura que el diseño anterior de 1652 px. La revisión visual confirmó icono de infraestructura, curvas, degradados, paneles azules con detalle diagonal, números resaltados y franja ejecutiva completos.
- Casos adicionales: 1 mes y 1 hallazgo, **1400 × 997 px CSS**; 18 meses densos, **1400 × 997 px CSS**; disponibilidad desconocida con 14 meses, **1400 × 997 px CSS**; 40 meses en tres bloques, **1400 × 1624 px CSS**. Se exportaron todos a escala 2 sin recortar contenido. En rangos extensos se permite crecimiento vertical para conservar legibilidad.
- Los cinco casos comprobaron cero controles interactivos, desbordamientos y solapamientos entre textos SVG, además de gradientes por barra, KPI en fila y paneles en columnas. La descarga no generó HTTP adicional y el reintento inicial consultó únicamente el volumen. El arnés local ignorado por Git conserva `result-compacto.json`, `result-un-mes.json`, `result-denso.json`, `result-sin-cobertura.json` y `result-muchos.json` con las rutas de cada PNG.
- No se recibió una imagen de referencia accesible en el mensaje del rediseño: se siguió la descripción visual detallada. La comparación exacta con esa imagen queda pendiente.

Pendientes: aceptación con datos reales y contraste de disponibilidad/filtros en el entorno operativo, otros navegadores y evaluación visual cerca del límite de imagen. Los límites generales de registros no prueban la exhaustividad de las importaciones; consultar [arquitectura de R01](ARCHITECTURE.md#reporte-png-r01-de-incidentes-consolidados).

### Reporte PNG R02 de Incidentes Consolidados

Validación ejecutada el 24/11/2026, exclusivamente con datos ficticios y sin conexión a bases de datos:

- Desde `fronted-tickets/`: `npm test -- --watch=false --include="**/incident-consolidated*.spec.ts" --include="**/incident-monthly-report*.spec.ts" --include="**/incident-project-report*.spec.ts"`: **71 aprobadas en seis archivos** (39 de R01 y 32 de R02). Cubren filtros idénticos en las cuatro solicitudes, inmutabilidad del dashboard, denominadores, Top 5 + Otros, empates, ceros, meses parciales/base cero, nombres largos, bloques mensuales, errores HTTP/render/captura, timeout, reintento, invalidación y doble descarga.
- `npm run build`: código 0. Persisten advertencias de tamaño de bundle y estilos del proyecto. No se añadieron dependencias ni se modificaron backend o endpoints.
- Edge sin interfaz sirvió el build de producción con respuestas ficticias locales y descargó el PNG completo. Caso principal de 12 proyectos/3 meses: **1400 × 1302 px CSS**, **2800 × 2604 px PNG**, 30 barras verticales agrupadas, seis segmentos/entradas de distribución, tres hallazgos y tres recomendaciones. Denominador general: 1386; subtotal Top 10: 1305; «Otros»: 546. Se revisó visualmente el PNG, incluidos nombres largos identificados por clave y nombre íntegro, leyenda mensual y dona.
- Caso de un proyecto/un mes: **1400 × 1180 px CSS**, **2800 × 2360 px PNG**, «Otros» con cero sin arco ficticio. Caso de 14 meses: **1400 × 3098 px CSS**, **2800 × 6196 px PNG**, 140 barras en seis bloques y todos los meses en la tendencia. Una discrepancia deliberada entre denominadores bloqueó la descarga.
- El arnés verificó ancho de 1400 px, composición 65/35 y tres columnas inferiores, valores y leyendas completos, ausencia de controles interactivos, errores JavaScript, textos cortados, desbordamientos y solapamientos SVG. También simuló un error HTTP con reintento y comprobó que captura/reintento de render no agregan consultas.
- Regresión adicional R01 en Edge: descarga de **2800 × 2008 px** desde **1400 × 1004 px CSS**, 14 meses y cero desbordamientos/solapamientos. Los hashes de sus seis archivos de componente/utilidades/pruebas y su modelo permanecen iguales a los del inicio de R02.
- Evidencias locales ignoradas por Git: `.angular/png-incident-project-smoke/verify.mjs`, `result-normal.json`, `result-uno.json`, `result-inconsistente.json`, `result-largo.json` y subcarpetas de descarga; la regresión R01 está en `.angular/png-incident-monthly-smoke/`.

Corrección de composición del 24/11/2026 (evidencia visual vigente; las dimensiones anteriores corresponden al diseño inicial):

- Se sustituyó la subdivisión en múltiples gráficos por un único SVG agrupado y una única línea de tendencia. La leyenda de la dona queda a su derecha. Se compactaron cabecera, KPI, paddings y tipografía, preservando íntegros filtros, cálculos, textos y coordinador de exportación.
- Pruebas relacionadas: **72 aprobadas en seis archivos** (39 R01 y 33 R02), con un caso adicional de 40 meses que verifica todos los puntos/barras, extremos del eje y ausencia de subdivisiones. Compilación Angular con código 0; persisten advertencias de tamaño del proyecto.
- Edge descargó el caso principal de 12 proyectos/3 meses en **2800 × 2068 px PNG**, desde **1400 × 1034 px CSS**: aproximadamente 21 % menos altura que el diseño inicial. Revisión visual de cabecera, tres KPI, barras agrupadas, leyenda de meses, nombres completos, dona/leyenda lateral y tres bloques inferiores, con línea de tendencia.
- Un proyecto/un mes: **1400 × 972 px CSS**, **2800 × 1944 px PNG**. Catorce meses: **1400 × 1077 px CSS**, **2800 × 2154 px PNG**, 140 barras y 14 puntos en un gráfico de cada tipo. Cuarenta meses: **1400 × 1115 px CSS**, **2800 × 2230 px PNG**, 400 barras y 40 puntos, sin apilar gráficos.
- Los cuatro PNG comprobaron cero scrolls, bloques vacíos, controles interactivos, desbordamientos, textos cortados y solapamientos SVG. El caso denso destaca solo el máximo mensual por proyecto con nota explícita, y adapta etiquetas de la línea; no elimina registros. Se confirmó también que una discrepancia de denominadores bloquea la descarga y que los reintentos conservan los filtros autorizados.
- El arnés conserva los mismos JSON de resultados actualizados y añade `result-muy-largo.json`. Las imágenes previas siguen en sus subcarpetas; cada JSON identifica el PNG vigente. La imagen de referencia sigue sin estar disponible para comparación directa: se aplicaron la estructura indicada y el estilo de R01.

Pendientes: aceptación con datos reales, otros navegadores, rangos próximos al límite de imagen y cotejo visual con la imagen de referencia no disponible en esta sesión. Las consultas independientes y la disponibilidad global no acreditan consistencia transaccional ni exhaustividad de cargas. Consultar la [arquitectura de R02](ARCHITECTURE.md#reporte-png-r02-de-incidentes-consolidados).

### Reporte PNG R03 de Incidentes Consolidados

Validación del 24/11/2026, con datos ficticios locales y sin conexiones a bases de datos:

- Antes de implementar R03 se ejecutaron los seis specs R01/R02: **71 aprobadas y 1 fallida de 72**. El fallo previo está en `incident-project-report.spec.ts:70`: espera «máximo mensual», mientras el HTML actual describe etiquetas de cada proyecto/mes. Se conservó sin modificar R02; no se atribuye a R03.
- Comando conjunto desde `fronted-tickets/`: `npm test -- --watch=false --include="**/incident-consolidated*.spec.ts" --include="**/incident-monthly-report*.spec.ts" --include="**/incident-project-report*.spec.ts" --include="**/incident-project-monthly-report*.spec.ts"`. Resultado: **113 aprobadas y 1 fallida de 114, en nueve archivos**; R01 39/39, R02 32/33 y R03 **42/42**. Persiste únicamente el fallo previo descrito.
- Los tres nuevos specs cubren identidad explícita, lista positiva de filtros, copia/inmutabilidad, filtros pendientes/dinámicos ignorados, proyecto fuera del ranking general, reconciliación, cantidades seguras, ceros, empates, base cero, meses actuales/futuros/parciales y referencias del tramo comparable. Verifican repunte parcial frente a recuperación del nivel previo sin atribuir continuidad.
- Los estados cubren carga conjunta, cancelación A→B→A, exclusiones antes del debounce, proyecto eliminado, HTTP/respuestas vacías, timeouts de consulta/fuentes/captura, reintentos sin HTTP adicional tras render/captura, doble clic, renders obsoletos, destrucción, dimensiones, imagen inválida y limpieza del enlace.
- `npm run build` terminó con código 0. Persisten advertencias de tamaño de bundle y estilos del proyecto. Los hashes de 21 archivos protegidos de R01/R02, sus modelos, servicio, backend revisado y manifiestos permanecen iguales a los del inicio de R03.
- Edge sirvió el build de producción con un proyecto sintético ausente del Top 10 general. Se seleccionó desde el combo del explorador, se aplicó una exclusión y se comprobó botón R03 gris/deshabilitado antes de seleccionar y naranja/habilitado después. Las consultas del reporte fueron exclusivamente KPI y ranking con los mismos filtros; un HTTP ficticio controlado produjo cuatro solicitudes al reintentar, y las demás descargas solo dos, sin HTTP adicional por captura.
- Caso principal, seis meses: **1400 × 888 px CSS**, **2800 × 1776 px PNG**, un gráfico con seis barras/valores/meses, tres KPI, tres hallazgos y tres recomendaciones. La revisión visual confirmó cabecera, nombre íntegro, referencias enero–junio de 2025, composición 62/38, resumen de variaciones y pie completos.
- Un mes: **1400 × 841 px CSS**, **2800 × 1682 px PNG**; variación no comparable. Catorce meses: **1400 × 885 px CSS**, **2800 × 1770 px PNG**. Cuarenta meses: **1400 × 926 px CSS**, **2800 × 1852 px PNG**, todas las barras/cantidades/etiquetas en un único SVG, con rotación de etiquetas y meses parciales señalados.
- Nombre de proyecto de más de 300 caracteres: **1400 × 935 px CSS**, **2800 × 1870 px PNG**, sin truncamiento. Fechas 15/01–12/06/2025: **1400 × 888 px CSS**, con seis meses visibles y KPI de variación referido únicamente a febrero–mayo completos.
- Los PNG comprobaron cero scrolls, controles, desbordamientos y solapamientos SVG. Las comprobaciones adicionales de nombre extenso/parciales validaron también las cajas de texto dentro de sus tarjetas. Sesenta meses bloquearon el PNG con mensaje de legibilidad; una discrepancia de denominadores también bloqueó la descarga. No se recortaron ni fragmentaron gráficos.
- Evidencia local ignorada por Git: `.angular/png-incident-project-monthly-smoke/verify.mjs`, los JSON `result-normal`, `result-uno`, `result-largo`, `result-denso`, `result-nombre-largo`, `result-parcial`, `result-ilegible` y `result-inconsistente`, y las subcarpetas de descarga identificadas en esos JSON.

Pendientes: resolver el spec previo de R02 en su propio alcance, aceptación con datos reales y otros navegadores. La referencia visual R03 no está adjunta; se siguieron la distribución aprobada y el estilo R01/R02. La disponibilidad general no acredita importaciones exhaustivas ni cobertura específica del proyecto; las dos consultas no son transaccionales. Ver [arquitectura R03](ARCHITECTURE.md#reporte-png-r03-de-incidentes-consolidados).

### Reporte PNG R04 de Incidentes Consolidados

Validación del 24/11/2026, exclusivamente con datos ficticios locales y revisión estática del contrato, sin conexiones a bases de datos:

- Línea base anterior a R04: **116 aprobadas y 1 fallida de 117** en R01–R03. Se identificó previamente el spec R02 `incident-project-report.spec.ts:70`, que espera «máximo mensual» aunque el HTML informa etiquetas por proyecto/mes. Se conserva sin modificar R02.
- `npm test -- --watch=false --include="**/incident-recurring-alerts-report*.spec.ts" --include="**/incident-consolidated-recurring-alerts-report.spec.ts"`: **42/42 aprobadas** en tres archivos: cálculo/filtros (22), presentación/render (6) y coordinación/exportación (14).
- Regresión final: `npm test -- --watch=false --include="**/incident-consolidated*.spec.ts" --include="**/incident-monthly-report*.spec.ts" --include="**/incident-project-report*.spec.ts" --include="**/incident-project-monthly-report*.spec.ts" --include="**/incident-recurring-alerts-report*.spec.ts"`: **158 aprobadas y el único fallo previo de R02, de 159 pruebas en doce archivos**. R01 39/39, R02 32/33, R03 45/45 y R04 42/42; no hay nuevas pruebas fallidas.
- Cálculos: ranking original, registros únicos, «Sin especificar», empates visibles, cero, redondeo 33.33 % sin sumar tasas, cantidades seguras, subtotal/denominador, cobertura de menos de cinco categorías y rechazo de inconsistencias. Las funciones no alteran respuestas/filtros y producen exactamente tres hallazgos y tres recomendaciones cuando hay incidentes.
- Filtros/estados: ambos modos, proyecto autoritativo, lista positiva y exclusiones, formularios pendientes/dinámicos ignorados, cambio A→B→A, exclusión antes del debounce, cancelación/destrucción, HTTP/respuesta vacía, timeouts de consulta/fuentes/captura, versión obsoleta, doble clic, render previo, dimensiones, PNG inválido, reintento y limpieza del enlace.
- `npm run build`: código **0**, bundle inicial **2.98 MB**. Continúan advertencias de presupuesto de bundle y estilos; la importación visual de R01 también se atribuye a ese archivo en la salida del compilador. No se modificaron presupuestos ni dependencias.
- Edge headless sirvió el build final y una API ficticia local. Se aplicó una exclusión mediante el explorador y se seleccionó el proyecto desde el combo para el segundo modo. El botón naranja aparece a la derecha de Alertas. Cada descarga consulta exclusivamente `/incidentes-porcentajes` con `limite=5` y la misma lista positiva; el caso general fuerza HTTP 503 y reintento (dos solicitudes), los demás realizan una. La captura no genera HTTP de datos adicional.
- **Modo general:** 1400 × 1042 px CSS; PNG **2800 × 2084 px**. Top 5 = 900, total = 1200, Otros = 300. Barras 62 % y dona/hallazgos 38 %, tres KPI y bloque ejecutivo inferior.
- **Modo proyecto:** 1400 × 1003 px CSS; PNG **2800 × 2006 px**. Top 5 = 550, total = 650, Otros = 100. Tres columnas 47/23/30 con nombre íntegro, tres hallazgos y tres recomendaciones. La inspección visual final confirmó cabecera, barras, leyenda, cifras y pie completos en ambos modos.
- Casos adicionales: una descripción «Sin especificar» con cantidad 1 y Otros = 0 (**2800 × 2016 px**); tres categorías con 33.33 % cada una (**2800 × 2082 px**); nombre de proyecto cercano a 300 caracteres y descripción de más de 450 (**2800 × 2428 px**), sin truncamiento. Se bloqueó la descarga de una descripción de más de 11000 caracteres y de respuestas con porcentaje incoherente o menos de cinco filas sin cobertura del universo.
- Todas las descargas verificadas mantienen ancho 1400 px CSS y escala 2, cantidades y leyendas correctas, cero scrolls, controles, textos fuera de sus tarjetas y desbordamientos; no hubo excepciones JavaScript. Los hashes de **29 archivos protegidos** de R01–R03, modelos, servicio, backend revisado y manifiestos permanecen iguales a la línea base.
- Evidencia local ignorada por Git: `.angular/png-incident-recurring-alerts-smoke/verify.mjs`, los JSON `result-general`, `result-proyecto`, `result-uno`, `result-redondeo`, `result-largo`, `result-ilegible`, `result-incompleto` y `result-inconsistente`, y los PNG identificados en esos JSON. Desde `fronted-tickets/`, `node .angular/png-incident-recurring-alerts-smoke/verify.mjs general` o `proyecto` reproduce las descargas en Edge con el build existente.

Pendientes: aceptación con datos reales, otros navegadores y comparación directa con las imágenes originales (no adjuntas en esta ejecución). El agregado backend usa consultas internas independientes: se rechazan inconsistencias detectables, pero no se acredita aislamiento transaccional ni completitud de importaciones. El spec previo de R02 queda fuera del alcance R04. Ver [arquitectura](ARCHITECTURE.md#reporte-png-r04-de-incidentes-consolidados).

### Resumen Ejecutivo de Incidentes — Reporte 1

Validación local del 25/11/2026, con API/datos ficticios y sin bases de datos ni proveedor IA real:

- Antes del cambio se ejecutó la suite R01–R04: **158 aprobadas y 1 fallida de 159**. El fallo previo de `incident-project-report.spec.ts:70` espera «máximo mensual», aunque el HTML vigente describe valores por proyecto/mes. No se modifica R02 para corregirlo.
- Nuevos specs: `incident-executive-summary-report.utils.spec.ts` (28), `incident-executive-summary-report.spec.ts` (6) e `incident-cause-analysis-summary-report.spec.ts` (14): **48/48 aprobadas**. Comando desde `fronted-tickets/`: `npm test -- --watch=false --include="**/incident-executive-summary-report*.spec.ts" --include="**/incident-cause-analysis-summary-report.spec.ts"`.
- Regresión conjunta: `npm test -- --watch=false --include="**/incident-consolidated*.spec.ts" --include="**/incident-monthly-report*.spec.ts" --include="**/incident-project-report*.spec.ts" --include="**/incident-project-monthly-report*.spec.ts" --include="**/incident-recurring-alerts-report*.spec.ts" --include="**/incident-executive-summary-report*.spec.ts" --include="**/incident-cause-analysis-summary-report.spec.ts"`. Resultado: **206 aprobadas y el único fallo previo de R02, de 207 pruebas en quince archivos**.
- Cálculos: reconciliación de KPI, denominadores diferentes de atribución/servidores, asociaciones múltiples superiores al total, enteros seguros, tasas redondeadas, total positivo sin atribución, conjunto vacío, ranking Top 5 y ausencia exclusiva de servidores. Se rechazan datos inconsistentes, narrativas incompletas y referencias inválidas.
- Prioridad: se alteró el orden de los arrays para comprobar que la pareja principal se elige por los tipos priorizados disponibles y no por posición. Los hallazgos de su referencia quedan dentro del máximo de cuatro. Se preservan textos, cifras, denominadores y tasas negativas de tendencia, sin cambiar unidades ni interpretar causalidad.
- Coordinación: espera de las tres fuentes, filtros efectivos y ediciones pendientes, origen IA/reglas, independencia del getter/captura largos, generaciones A→B→A, cambio del límite de servidores sin nueva IA, HTTP nulo/error, destrucción, doble clic y render obsoleto. Se verifican carga diferida, timeout de carga/fuentes/captura, reintento sin consultas adicionales, dimensiones, imagen inválida y limpieza del enlace.
- `npm run build` terminó con código **0**. Bundle inicial **2.82 MB**, bajo el límite de error existente de 3 MB; el componente de reporte se sirve en un chunk diferido de unos 30 kB. Persisten advertencias de presupuesto del bundle y estilos; el CSS del padre queda en aproximadamente 15.85 kB frente a su límite de 16 kB. No se modificaron presupuestos ni dependencias.
- Edge headless sirvió el build y una API ficticia local. El botón está a la derecha de Atribución, naranja al estar disponible y deshabilitado mientras espera el análisis. La selección de proyecto y tipo se aplicó desde los controles reales del formulario. Atribución, servidores y POST IA recibieron los mismos filtros; el POST conservó `incluir_servidores=true`.
- La descarga del nuevo reporte produjo **cero llamadas API adicionales**, tanto a datos como a IA. Solo existe la generación automática por carga de filtros. El botón de descarga larga permaneció habilitado y su documento presente. El componente largo y el bloque original `reporteListo`/`descargarReporte` se conservaron; no se afirma haber regenerado su PNG en esta validación.
- PNG general: **1400 × 1082 px CSS**, **2800 × 2164 px PNG**. Filtrado por proyecto y tipo: **1400 × 1116 px CSS**, **2800 × 2232 px PNG**, con nombre completo incluso cuando contiene código y `PROY`.
- Sin servidores: **1400 × 1018 px CSS**, **2800 × 2036 px PNG**; se omitió la tarjeta y quedaron dos gráficos en la misma fila. Respaldo por reglas: **1400 × 1100 px CSS**, **2800 × 2200 px PNG**, con procedencia y advertencia visibles.
- Nombre de proyecto extenso y hallazgo de más de 450 caracteres: **2800 × 2510 px PNG**, sin truncamiento. Una descripción de más de 11000 caracteres bloqueó la captura con mensaje; un total incoherente entre fuentes bloqueó la disponibilidad.
- Se comprobaron ancho 1400 CSS y escala 2, orden Servidores/Dona/Comparación, coordenada Y y altura idénticas de tarjetas, fila narrativa posterior y cantidades/textos/referencias correctos. Todos los casos descargados dieron cero controles, scrolls, desbordamientos, textos fuera de sus tarjetas y excepciones JavaScript. La inspección visual confirmó composición y pie completos.
- Los hashes de **148 archivos protegidos** de R01–R04, página de consolidados, reporte largo, modelos, servicio, backend y manifiestos coinciden con el inicio. La comparación adicional del bloque de exportación largo del padre confirma su conservación. `git diff --check` no reportó incidencias.
- Evidencia local ignorada por Git: `.angular/png-incident-executive-summary-smoke/verify.mjs`, JSON `result-general`, `result-filtros`, `result-sin-servidores`, `result-reglas`, `result-largo`, `result-ilegible` y `result-inconsistente`, y PNG en las carpetas de descarga indicadas allí. Reproducir desde `fronted-tickets/` con `node .angular/png-incident-executive-summary-smoke/verify.mjs general` (o cualquiera de esos modos).

Pendientes: aceptación con datos reales/referencias originales y otros navegadores. La prioridad pública no permite reconstruir el orden privado completo por evidencia; se utiliza únicamente la prioridad verificable por tipo. Las consultas independientes no ofrecen una instantánea transaccional. Las salidas IA conservan su advertencia de validación técnica; las demasiado largas se bloquean sin recortar. Ver [arquitectura](ARCHITECTURE.md#resumen-ejecutivo-de-incidentes--reporte-1).

### Validaciones de Incidentes Consolidados

Desde `fronted-tickets/`, ejecutar `npm test -- --watch=false` y `npm run build`.
Los nuevos specs de `volume-month` y `Consolidated/category-distribution` cubren:

- Título según las barras visibles, selección y limpieza del mes sin reducir el rango mostrado, un solo mes, respuesta vacía y períodos que cruzan años.
- Orden optativo Critical, High, Medium, Low con prefijos y etiquetas originales; desconocidas al final, cantidades y colores conservados y orden por volumen para consumidores que no activan la opción.

Resultado de ejecución del 18/11/2026: las cinco pruebas nuevas pasan. La suite completa registra siete pruebas aprobadas y dos fallidas en specs existentes: `App` no reconoce `app-landing` y `Login` carece de proveedor de `ActivatedRoute`. La compilación termina con código 0 al disponer de acceso a Google Fonts; advierte excesos de presupuesto del bundle inicial y de estilos. No se realizó validación visual en navegador.

Validación manual pendiente: aplicar y limpiar filtros, seleccionar/desmarcar una barra mensual, comprobar el estado vacío, tooltips y pantalla completa; confirmar que requerimientos, tareas y SLA conservan sus títulos y órdenes actuales. El gráfico de distribución por prioridad solo presenta cantidades en su contrato actual; el gráfico mensual apilado con porcentajes no se modifica.

Estas pruebas son propuestas, no funcionalidades ya presentes:

- Pruebas de contrato para todas las rutas FastAPI y comparación automática con los modelos TypeScript/consumidores Angular.
- Pruebas de integración SQL Server aisladas con esquema/datos efímeros para repositorios, transacciones e importaciones; excluir credenciales y bases productivas.
- Pruebas API de importación para archivos válidos, inválidos, vacíos, duplicados y límites de tamaño/formato.
- Pruebas de autenticación que verifiquen hashing de contraseñas, vencimiento JWT y autorización endpoint por endpoint.
- Pruebas para límites/rate-limit, timeout y fallback de OpenAI usando cliente simulado; reservar una prueba externa real controlada y separada.
- Smoke tests de frontend para rutas, carga/error/vacío, filtros, tablas responsivas y accesibilidad.
- Integrar en CI las pruebas unitarias deterministas; mantener las que requieren red, SQL Server o tokens en una etapa manual/aislada.
