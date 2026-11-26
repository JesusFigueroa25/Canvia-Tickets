# PRD 02 — Resumen Ejecutivo Auditoría de Categorización

> **Módulo:** Auditoría de Categorización de Requerimientos · CANVIA<br>
> **Actualización:** 25/11/2026<br>
> **Estado:** Implementado y validado localmente con datos ficticios; aceptación con datos reales pendiente.

## 1. Objetivo y alcance

Rediseñar el PNG existente como resumen ejecutivo horizontal de 1400 px CSS. Se reutilizan `app-requirement-categorization-report`, su padre y el único botón **Descargar Reporte PNG**. No existe un reporte ni sistema de descarga paralelo.

El dashboard conserva sus gráficos, tablas estadísticas, explorador, filtros, paginación y ejecución de auditorías. Se mantienen backend, servicios HTTP, modelos compartidos y dependencias.

## 2. Composición del documento

- Cabecera: **Resumen Ejecutivo Auditoría de Categorización**, período con mes/año inicial y final, grupo aplicado y proyecto íntegro solo cuando esté filtrado. Si hay filtro mensual, se identifica separadamente; no se reemplaza silenciosamente el rango global.
- Tres KPI horizontales: total de tickets evaluados; correctas y su porcentaje; incorrectas y su porcentaje.
- Cuadrícula de cuatro gráficos, exactamente en este orden:

| Fila | Izquierda | Derecha |
|---|---|---|
| Primera | Distribución de Categorizaciones, dona | Distribución por Motivo Resolución, dona |
| Segunda | Top 10: Incorrectas por Colaborador, barras apiladas | Correctas e Incorrectas por Mes, barras apiladas |

- Franja inferior: tres hallazgos cuantitativos con iconos, una conclusión y tres recomendaciones.
- Pie: filtros efectivos, denominadores, alcance metodológico y fecha ISO de preparación.
- No se incluyen las tablas **Cuadro Estadístico Mensual** ni **Top 10 Estadístico por Colaborador**, controles interactivos o explorador dentro del PNG. Las tablas del dashboard se conservan.

Paleta: encabezados azul marino `#0B2342`, naranja `#FF620F`, verde `#16835B`, rojo `#D95C4F`, fondo `#F7F9FB`. Tarjetas blancas, iconos SVG, tipografía local Arial/Helvetica y encabezados con detalles ejecutivos compatibles con los reportes aprobados. Las visualizaciones del PNG usan HTML/CSS y SVG estáticos, sin animaciones Chart.js ni recursos nuevos.

## 3. Datos y contratos verificados

Se reutilizan las cuatro respuestas existentes bajo `/api/requirement-categorization-audit/groups/1/`: `summary`, `resolvers`, `monthly-stats`, `resolution-reasons`. El padre conserva `RequirementCategorizationReportData`, con versión, fecha, filtros, resumen, todos los colaboradores, todos los meses recibidos y todos los motivos.

El contrato de grupo selecciona primero una evaluación vigente por `ticket_id` entre ejecuciones `COMPLETED`, ordenando `run_id` y `result_id` descendentes; después aplica los filtros. No hay nueva deduplicación en frontend.

- `summary.processed_tickets` y `summary.total_tickets` representan el mismo universo evaluado. `CORRECT` e `INCORRECT` agotan los resultados de ese universo; por ello correctas + incorrectas = evaluadas.
- `summary.error_count` contabiliza errores de ejecuciones: no se resta del denominador ni se suma a los KPI.
- `resolvers.total` y `monthly-stats.total` cuentan **filas**, no tickets. Las colecciones de grupo son completas y sin paginación; sus sumas de tickets/correctas/incorrectas sí coinciden con el resumen.
- `resolution-reasons.total` cuenta tickets. Las categorías incluyen `SIN_DATO` para vacíos/nulos y cubren el total filtrado. Se conservan todas las categorías recibidas, sin Top N ni renormalización.
- Los porcentajes de cada fila usan su propio total; los de motivos y KPI usan el total evaluado. El backend los redondea a dos decimales.
- Los meses son únicamente los períodos recibidos de `source_opened_at`. No se rellenan vacíos ni se exige continuidad o coincidencia del año de metadatos con todos los años del rango.

Fuentes del contrato: repositorio backend `app/repositories/requirement_categorization_audit_repository.py`, schemas existentes y servicio/modelos Angular de auditoría; revisados en lectura, sin ejecutar consultas a bases de datos.

## 4. Filtros y consistencia

Se conserva exactamente el flujo vigente: `desde`, `hasta`, `grupo_resolutor`, `proyecto`, `resultado`, `motivo_resolucion`, `mes`, `nombre_resolutor`, `ticket_id`. Se imprimen los filtros de la misma instantánea; cambios de formulario pendientes de aplicar no la alteran. Búsquedas/paginación locales del explorador no sustituyen esos filtros.

Antes de preparar el documento se validan:

1. Cantidades enteras seguras no negativas y correctas + incorrectas = total, tanto generales como por fila.
2. Sumas completas de colaboradores y meses contra el resumen; suma de motivos y `motivos.total` contra evaluadas.
3. Tasas finitas entre 0 y 100, equivalentes a cantidad/denominador × 100 con tolerancia de medio centésimo porcentual más margen numérico. Se muestran dos decimales; las tasas redondeadas no tienen que sumar exactamente 100.
4. Meses válidos y únicos; motivos no vacíos ni duplicados. No se comparan contadores de filas o errores con tickets.

Las consultas son independientes. La versión local y la reconciliación detectan incoherencias, pero no proporcionan aislamiento transaccional ni detectan todos los cambios concurrentes del servidor.

## 5. Reglas de gráficos y análisis ejecutivo

### Top 10

Filtrar filas sin tickets; ordenar por **incorrectas DESC, total DESC y nombre visible** (`localeCompare` español); seleccionar hasta diez. Se conservan filas con cero incorrectas si entran en el ranking. Las barras muestran correctas en verde e incorrectas en rojo, cantidad total y porcentaje individual de incorrectas. La escala usa el mayor total de esas filas.

El ranking prioriza volumen absoluto de incorrectas, no tasa individual. No modifica KPIs ni denominadores generales ni el orden de tablas del dashboard. Nulos/vacíos de colaborador se muestran como **Sin asignar**.

### Donas y gráfico mensual

Las donas calculan la geometría desde cantidades, con total evaluado en el centro y cantidades/porcentajes en la leyenda. `SIN_DATO` se presenta como **Sin dato**, preservando su cantidad y denominador. No se eliminan categorías.

El gráfico mensual ordena cronológicamente los períodos recibidos; conserva el filtro `mes`, totales y cantidades correctas/incorrectas por barra. Las etiquetas se presentan en dos líneas o se rotan en rangos densos. No se inventan meses ni se afirman tendencias, continuidad o exhaustividad de importaciones.

### Textos determinísticos

Funciones puras locales generan siempre tres hallazgos para datos válidos con tickets:

1. Mayor cantidad de incorrectas por colaborador, participación sobre incorrectas globales y distinción respecto a tasa individual; se explicitan empates, único colaborador y ausencia de incorrectas.
2. Mes recibido con mayor cantidad de incorrectas, su total y tasa local; empate resuelto por primer mes cronológico e identificado explícitamente. Si no hay incorrectas, describir únicamente la cobertura recibida.
3. Cantidad y participación de `SIN_DATO` si existe con tickets; en otro caso, motivo de mayor volumen. No se deducen cruces motivo/resultado que el contrato no ofrece.

La conclusión resume total, correctas e incorrectas con sus tasas. Las tres recomendaciones proponen contraste de muestras contra catálogo/evidencia, revisión del mes identificado y verificación/completitud del motivo. No hay GPT, causas técnicas inventadas, atribuciones de responsabilidad ni afirmaciones de mejora.

## 6. Preparación, renderizado y descarga

- El padre conserva cuatro respuestas exitosas y una copia tipada por versión. Recargar invalida el reporte, cancela solicitudes anteriores y descarta resultados obsoletos. Un `404` no equivale a éxito; cero tickets no habilita descarga.
- El componente es presentacional, sin HTTP, y conserva su declaración en `AppModule`. El documento se monta fuera de pantalla en el contenedor existente, `inert` y `aria-hidden`.
- Tras fuentes locales disponibles y dos ciclos de pintura, confirma la versión. La espera de renderizado tiene límite de **30 segundos** y cancelación por revisión/destrucción.
- Se comprueban ancho **1400 px CSS**, altura positiva e inferior a **1400 px**, disposición 2×2, ausencia de desbordamientos y etiquetas SVG sin cruces ni recortes. Los rangos demasiado densos o textos que excedan la composición se rechazan con mensaje explicativo; no se ocultan datos ni se fragmenta el gráfico.
- El botón existente requiere cuatro respuestas válidas, render vigente y ausencia de exportación en curso. Las cargas/errores/paginación de tickets no lo bloquean.
- Descargar revalida fuentes/pintura y vigencia, captura exclusivamente `.report-document` con `html-to-image`, escala **2**, `skipFonts` y `skipAutoScale`; mantiene límites de 16384 px por lado y 32 millones de píxeles. Espera previa y captura tienen timeout de 30 segundos cada una.
- Se comprueba vigencia antes/después de capturar y formato PNG. Doble clic no crea capturas concurrentes. Una captura tardía tras timeout/cambio/destrucción no entrega archivo.
- El enlace temporal y temporizadores se limpian; un fallo de captura permite reintentar sin nuevas consultas. La recarga por error de preparación sigue utilizando la acción existente.
- Archivo: `CANVIA-Auditoria-Categorizacion-<proyecto-o-general>-<YYYY-MM-DD>.png`, con saneamiento y longitud de segmento de proyecto ya vigentes. El pie usa fecha ISO de preparación; el nombre conserva la fecha local del navegador.

## 7. Criterios de aceptación y validación

- Un único botón/componente, tres KPI, cuatro gráficos en 2×2 y análisis 3/1/3; sin las dos tablas estadísticas dentro del PNG.
- Filtros y universo intactos; cantidades/tasas reconciliadas conforme al contrato, sin confundir cobertura de filas con tickets.
- Ranking aprobado, meses recibidos, categorías completas, proyecto/nombres sin truncamiento silencioso.
- Protocolo de versiones, cancelación, renderizado, timeout, doble clic y reintento validado; descarga sin HTTP adicional.
- PNG general y filtrado de alta resolución, sin cortes/scroll/solapamientos detectados y ancho CSS 1400.

Ejecución del 25/11/2026: **52 pruebas específicas aprobadas** y compilación Angular correcta. La regresión con Reporte 1 y R01–R04 registra **256 aprobadas y tres fallos preexistentes**. Las evidencias PNG, comandos, dimensiones y limitaciones están en [TEST_PLAN.md](../TEST_PLAN.md#reporte-png-de-auditoría-de-categorización).

## 8. Archivos y límites

Se modifican el TS/HTML/CSS del reporte existente, su fixture/spec y el TS/spec del padre. Se añaden únicamente las utilidades analíticas locales y su spec. No cambian modelos compartidos, servicio, declaración del módulo, dependencias ni backend. Fuente de arquitectura: [ARCHITECTURE.md](../ARCHITECTURE.md#reporte-png-de-auditoría-de-categorización).

Pendientes: aceptación con datos reales, otros navegadores y concurrencia real del servidor. Las validaciones locales no certifican ejecución de auditorías ni consultas SQL Server. Los fallos previos de otros reportes quedan fuera del alcance. Este PRD sustituye la descripción anterior de siete secciones; no se crea otro PRD para este rediseño.
