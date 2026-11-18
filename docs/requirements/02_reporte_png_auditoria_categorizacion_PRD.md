# PRD 02 — Reporte PNG de Auditoría de Categorización

> **Ruta en el repositorio:** `docs/requirements/02_reporte_png_auditoria_categorizacion_PRD.md`<br>
> **Proyecto:** CANVIA — Plataforma de análisis y gestión de tickets de TI<br>
> **Módulo:** Auditoría de Categorización de Requerimientos<br>
> **Fecha de elaboración:** 2026-11-18<br>
> **Estado:** Funcionalidad implementada; validación del último cambio manual de ordenamiento pendiente

## 1. Contexto y descripción de la funcionalidad

La página de Auditoría de Categorización permite consultar resultados acumulados de evaluaciones de requerimientos. El reporte PNG presenta una versión estática y descargable de sus indicadores, distribuciones, gráficos y cuadros estadísticos, bajo los filtros efectivos del dashboard.

La exportación utiliza un documento propio, fuera de pantalla, en lugar de capturar el dashboard interactivo. Mantiene la identidad visual CANVIA y excluye formularios, controles de ejecución, paginadores y el Explorador de Tickets Auditados.

Este PRD describe el **código actual inspeccionado**, incluyendo el cambio manual que ordena el Top 10 por **total de tickets**, y distingue ese estado de las pruebas ejecutadas sobre versiones anteriores. No constituye una propuesta de cambios adicionales.

## 2. Objetivos generales y específicos

**Objetivo general:** descargar un reporte agregado de categorización en PNG, consistente con los datos y filtros aplicados en la página.

**Objetivos específicos:**

1. Reutilizar los agregados disponibles en el padre sin repetir consultas para exportar.
2. Mostrar las siete secciones implementadas con cifras y leyendas legibles.
3. Habilitar la descarga después de completar correctamente las cuatro consultas agregadas y el renderizado del documento vigente.
4. Separar los totales generales del subtotal de la selección Top 10.
5. Evitar capturas obsoletas, descargas simultáneas e imágenes con dimensiones no admitidas por las validaciones actuales.

## 3. Alcance funcional

| ID | Sección del PNG | Contenido implementado |
|---|---|---|
| RF-01 | **01. Indicadores de Categorización** | Tickets evaluados, categorizaciones correctas, incorrectas, % correctas y % incorrectas. |
| RF-02 | **02. Distribución de Categorizaciones** | Dona, cantidades y porcentajes de correctas e incorrectas. |
| RF-03 | **03. Distribución por Motivo Resolución** | Dona y leyenda de motivos recibidos; distingue Cliente, Canvia y «Sin dato». |
| RF-04 | **04. Top 10: Tickets por Colaborador** | Barras horizontales apiladas de correctas/incorrectas para hasta diez colaboradores, ordenados por total de tickets. |
| RF-05 | **05. Categorizaciones Correctas e Incorrectas por Mes** | Barras mensuales apiladas, total por barra y cantidades de correctas/incorrectas. |
| RF-06 | **06. Cuadro Estadístico Mensual** | Todos los meses recibidos, orden cronológico, cantidades, porcentajes y pie «Total filtrado». |
| RF-07 | **07. Top 10 Estadístico por Colaborador** | Las mismas filas y orden del gráfico Top 10; pie «Subtotal Top 10». |

### 3.1. Presentación y columnas

El documento incluye cabecera CANVIA, título, nombre de agrupación/año, total de tickets evaluados, filtros efectivos y nota metodológica. El pie indica la fecha de preparación en UTC−05:00.

Las tablas conservan seis columnas: **Mes o Colaborador**, **Total de tickets**, **Correctas**, **Incorrectas**, **% Correctas** y **% Incorrectas**. No tienen paginación ni controles de interacción en el PNG.

La paleta utiliza naranja `#FF620F`, verde `#16835B`, rojo de incorrectas `#D95C4F`, fondo `#F7F9FB`, tarjetas blancas y texto `#101828`. La fuente del reporte es Arial/Helvetica/sans-serif local. Los gráficos se construyen con HTML/CSS estático, sin animaciones Chart.js.

## 4. Exclusiones

- Incluir el **Explorador de Tickets Auditados**, sus filas o su paginación dentro del PNG.
- Recorrer páginas de tickets o consultar nuevamente los agregados para descargar.
- Añadir endpoints, modificar backend, persistencia o reglas del motor de auditoría como parte de la exportación.
- Modificar la tabla de colaboradores del dashboard a partir de la selección Top 10 del reporte.
- Incorporar al PNG el historial/progreso de ejecuciones, formularios, análisis IA o una sección adicional de soluciones.

**Precisiones:** la página mantiene sus consultas HTTP habituales, incluida la de tickets. La exclusión significa que el reporte no añade consultas ni depende de esa página de tickets. La acción «Actualizar datos» tras un error de preparación sí llama a la recarga existente del dashboard.

## 5. Arquitectura y responsabilidades

### 5.1. Componente padre

`RequirementCategorizationAudit` (`app-requirement-categorization-audit`):

- Administra filtros, solicitudes, cancelaciones y estados existentes de la página.
- Registra el éxito de las cuatro consultas necesarias y valida sus agregados.
- Construye una copia de datos y filtros mediante `RequirementCategorizationReportData`.
- Mantiene versión, disponibilidad de renderizado, exportación y errores.
- Monta el reporte fuera de pantalla, escucha sus eventos y ejecuta `toPng` y la descarga.

La incorporación al reporte no sustituye los flujos de ejecución de auditorías, filtros o exploración del dashboard.

### 5.2. Componente del reporte

`RequirementCategorizationReport` (`app-requirement-categorization-report`) es presentacional y no inyecta un servicio HTTP. Recibe `@Input() datos`, prepara las vistas derivadas y emite `renderizado` o `errorRenderizado`, ambos con la versión correspondiente.

El componente usa `standalone: false` y está declarado en `AppModule`. El padre aloja el documento en un contenedor con `aria-hidden`, `inert`, posición fija y desplazamiento horizontal fuera de pantalla. Se captura únicamente `.report-document`.

## 6. Datos utilizados

| Campo de la instantánea | Tipo | Origen y uso |
|---|---|---|
| `version` | `number` | Identificador local de actualización del padre. |
| `preparadoEn` | `string` | Fecha ISO creada al preparar la instantánea; pie del reporte. |
| `filtros` | `AuditDashboardFilters` | Copia de los filtros efectivos de la consulta. |
| `resumen` | `AuditSummary` | KPIs, distribución de categorizaciones y totales generales. |
| `motivos` | `AuditResolutionReasonList` | Total y distribución por motivo de resolución. |
| `resolutores` | `AuditResolver[]` | Conjunto completo disponible para derivar el Top 10 y su subtotal. |
| `meses` | `AuditMonthlyStat[]` | Gráfico mensual y cuadro completo. |

Las cuatro respuestas provienen de las rutas existentes bajo `api/requirement-categorization-audit/groups/1/`: `summary`, `resolvers`, `monthly-stats` y `resolution-reasons`. `AUDIT_GROUP_ID` vale `1` en el modelo actual.

Los campos auxiliares de auditoría que existen en `AuditSummary` o `AuditResolver`, como errores de ejecuciones o estados de solución, no se convierten automáticamente en KPIs o columnas adicionales del PNG.

## 7. Reglas de negocio

### 7.1. Agregación y consistencia

| ID | Regla implementada |
|---|---|
| RN-01 | La consulta existente del backend considera evaluaciones de ejecuciones `COMPLETED` y una evaluación vigente por ticket de la agrupación. La selección se ordena por `run_id` descendente y después `result_id` descendente antes de aplicar los filtros. El reporte no vuelve a deduplicar. |
| RN-02 | El total general de referencia es `resumen.processed_tickets`. Si vale cero, no se prepara una descarga. |
| RN-03 | Las cantidades comprobadas deben ser enteros seguros no negativos. Los porcentajes recibidos comprobados deben ser finitos y estar entre 0 y 100. |
| RN-04 | Correctas más incorrectas deben igualar el total general y el total de cada fila mensual o por colaborador. |
| RN-05 | Las sumas de total, correctas e incorrectas del conjunto completo de colaboradores y del conjunto mensual deben coincidir con el resumen. |
| RN-06 | `motivos.total` y la suma de las cantidades de sus elementos deben coincidir con el total general. |
| RN-07 | Los porcentajes generales y de cada fila se presentan desde los datos recibidos, con un decimal. La validación frontend no comprueba que cada porcentaje recibido equivalga exactamente al cociente de sus cantidades. |
| RN-08 | Las proporciones geométricas de las donas se calculan desde las cantidades. `SIN_DATO` se muestra como «Sin dato» y los nombres de colaborador nulos o vacíos como «Sin asignar». |

### 7.2. Filtros efectivos

Se conservan **Desde**, **Hasta**, **Grupo Resolutor**, **Proyecto**, **Resultado**, **Motivo de resolución**, **Mes**, **Colaborador** y **Ticket**. El modelo usa `desde`, `hasta`, `grupo_resolutor`, `proyecto`, `resultado`, `motivo_resolucion`, `mes`, `nombre_resolutor` y `ticket_id`.

Los campos del formulario global pendientes de «Aplicar» no reemplazan los filtros efectivos. Las selecciones dinámicas que actualizan el padre recargan sus datos y generan una nueva versión. Un filtro por ticket también restringe los agregados aunque el explorador no se exporte. Las búsquedas de opciones, el ordenamiento visual y la paginación de las tablas interactivas no se trasladan como filtros adicionales al PNG.

En las consultas existentes se utiliza `source_opened_at` para el período y la agrupación mensual. El frontend ordena los meses por código `YYYY-MM`. El acumulado no se limita a la última ejecución mostrada en el panel de estado.

### 7.3. Control de versiones

Cada `cargarDashboard()` incrementa `versionReporte`, copia los filtros vigentes, vacía el registro de consultas exitosas e invalida la instantánea y su renderizado. También cancela las consultas anteriores mediante los mecanismos RxJS existentes.

El éxito de una consulta invalida cualquier instantánea preparada y solo permite reconstruirla cuando están disponibles los cuatro agregados. Las copias abarcan el resumen, los filtros y los elementos de motivos, colaboradores y meses.

El hijo descarta confirmaciones pendientes cuando recibe nuevos datos o se destruye. El padre acepta la confirmación únicamente para la versión actual. Durante la captura se verifica además que la instantánea siga siendo la misma antes y después de `toPng`. Destruir la página invalida la entrega pendiente.

## 8. Top 10 por colaborador

**Criterio vigente, aplicado al gráfico 04 y a la tabla 07:**

1. Excluir filas con `total_tickets <= 0`.
2. Ordenar por `total_tickets` **descendente**.
3. Desempatar por `incorrect_count` **descendente**.
4. Desempatar por nombre normalizado visible, mediante `localeCompare(..., 'es')`.
5. Seleccionar los primeros diez registros; si hay menos, mostrar los disponibles.

Ambas secciones consumen el mismo arreglo `top`. El gráfico muestra cantidades de correctas/incorrectas, pero su clasificación actual es por **volumen total**, no por cantidad de incorrectas. Su título actual es «Top 10: Tickets por Colaborador».

### 8.1. Subtotal y totales generales

El pie de la tabla 07 se identifica como **Subtotal Top 10**:

- Total de tickets = suma de `total_tickets` de las filas seleccionadas.
- Correctas/incorrectas = suma de los campos respectivos de esas filas.
- % correctas = `100 × correctas del Top 10 / tickets del Top 10`.
- % incorrectas = `100 × incorrectas del Top 10 / tickets del Top 10`.
- Si el subtotal de tickets es cero, ambos porcentajes son cero. No se promedian porcentajes individuales.

Los KPIs, la cifra de cabecera y el pie **Total filtrado** del cuadro mensual siguen utilizando el resumen del conjunto completo. La selección Top 10 no altera los datos del padre ni la tabla del dashboard.

## 9. Condiciones de habilitación del botón Descargar PNG

El texto visible es **Descargar Reporte PNG**. Su condición es `reporteListo && !exportandoReporte`.

`reporteListo` exige simultáneamente:

1. Página no destruida.
2. Registro de éxito de las cuatro consultas: resumen, motivos, colaboradores y meses.
3. Ninguna carga ni error de esas cuatro consultas.
4. Ausencia de error de preparación del reporte.
5. Instantánea preparada para la versión vigente y confirmación de renderizado del hijo.

Un `404` en cualquiera de los agregados no se considera éxito, aunque la vista general silencie algunos de esos errores. Las validaciones de la sección 7 preceden a la preparación de la instantánea.

Los estados de carga/error de tickets, su paginación y los errores de opciones de filtros o historial no son condiciones adicionales del botón. Tampoco se exige por sí mismo que la última ejecución mostrada tenga estado `COMPLETED`; los agregados provienen del flujo acumulado existente.

## 10. Generación y descarga

### 10.1. Renderizado y dimensiones

1. El hijo prepara el HTML/CSS de las siete secciones.
2. Espera `document.fonts?.ready` y dos ciclos de `requestAnimationFrame`.
3. Comprueba dimensiones positivas y emite la versión renderizada.
4. Al descargar, el padre repite la espera, verifica vigencia y localiza `.report-document`.
5. Obtiene ancho y alto con `Math.ceil(elemento.scrollWidth)` y `Math.ceil(elemento.scrollHeight)`, respectivamente.

El documento tiene **1400 px de ancho CSS** y altura automática. La escala es **2**, excepto si la altura supera **4000 px**, cuando se usa **1**. Se rechazan dimensiones de salida mayores que **16384 px por lado** o un área mayor que **32 000 000 píxeles**. No hay división automática en varias imágenes.

### 10.2. Captura y archivo

Se utiliza `toPng` de `html-to-image` con fondo `#F7F9FB`, dimensiones medidas, escala calculada, `skipFonts: true` y `skipAutoScale: true`. La copia capturada restablece posición estática y elimina desplazamiento, transformación y margen del elemento raíz.

La respuesta debe comenzar con `data:image/png` y tener al menos cien caracteres. Esta comprobación no equivale a una inspección de todos los píxeles del archivo.

**Nomenclatura:** `CANVIA-Auditoria-Categorizacion-<proyecto-o-general>-<YYYY-MM-DD>.png`.

El segmento del proyecto elimina diacríticos, sustituye caracteres ajenos a letras ASCII, números, guion y guion bajo, recorta guiones extremos y limita su longitud a sesenta caracteres. Si queda vacío se usa `general`. La fecha del nombre se obtiene de la fecha local del navegador al descargar; no utiliza la conversión fija UTC−05:00 del pie.

Se crea un enlace temporal, se activa su descarga y se elimina en `finally`. El estado `exportandoReporte` impide clics concurrentes y cambia el texto a **Generando PNG…**.

### 10.3. Errores y reintentos

- Fallo de consultas o incoherencia: mensaje de preparación y acción **Actualizar datos**.
- Fallo de renderizado: no se habilita el reporte y se ofrece actualizar los datos.
- Cambio de datos durante captura: se descarta el resultado y se indica volver a descargar.
- Documento ausente, dimensiones inválidas, límites excedidos, fallo de `toPng` o respuesta inválida: mensaje de imposibilidad de generar el PNG completo, con indicación de reintentar o reducir el alcance mediante filtros.
- Tras la captura, tanto en éxito como en error, se libera el estado de exportación. Un error de captura no obliga por sí mismo a consultar nuevamente los agregados.
- Si la página se destruye durante la captura, no se entrega el archivo pendiente ni se actualiza su vista destruida.

## 11. Criterios de aceptación

| ID | Comportamiento verificable del código actual |
|---|---|
| CA-01 | El documento contiene exactamente las siete secciones de la sección 3 y excluye el explorador. |
| CA-02 | Descargar no añade llamadas HTTP ni obtiene páginas adicionales de tickets. |
| CA-03 | El botón permanece deshabilitado hasta disponer de cuatro respuestas correctas, agregados válidos y renderizado de la versión actual. |
| CA-04 | Tickets pendientes, fallidos o paginados no bloquean un reporte agregado válido. |
| CA-05 | Los filtros impresos corresponden a la instantánea consultada, incluidos los filtros dinámicos y por ticket. |
| CA-06 | Gráfico 04 y tabla 07 muestran la misma selección, con un máximo de diez filas y orden por total, incorrectas y nombre. |
| CA-07 | La tabla 07 conserva sus seis columnas y presenta «Subtotal Top 10» con cantidades y porcentajes propios de la selección. |
| CA-08 | Los KPIs y el total mensual conservan el conjunto completo; el cuadro mensual incluye todos los meses recibidos. |
| CA-09 | Una recarga invalida el render anterior y un cambio de datos durante captura impide descargar el resultado obsoleto. |
| CA-10 | Se respetan dimensiones, escala, límites y nomenclatura descritos, sin recortar filas automáticamente. |
| CA-11 | Doble clic no genera capturas simultáneas; un fallo libera el estado y permite reintentar. |

Estos criterios describen el comportamiento implementado; su listado no certifica que todos hayan sido revalidados sobre el último cambio manual.

## 12. Pruebas y validaciones

### 12.1. Evidencia de ejecución disponible

La evidencia de esta sesión y de [TEST_PLAN.md](../TEST_PLAN.md#reporte-png-de-auditoría-de-categorización) distingue tres estados:

| Estado validado el 18/11/2026 | Evidencia | Límite |
|---|---|---|
| Implementación inicial, tabla de colaboradores completa | Compilación Angular correcta; 23 pruebas específicas aprobadas; suite completa con 30 aprobadas y dos fallos preexistentes. | Anterior al recorte de la tabla y al orden manual por total. |
| Descarga inicial en Edge, datos ficticios locales | PNG real de 2800 × 5830 px, siete secciones, doce meses y doce colaboradores; sin excepciones JS ni llamadas HTTP adicionales al descargar. Tickets pendientes o con error no bloquearon la descarga. | No valida visualmente la tabla Top 10 actual ni datos productivos. |
| Ajuste de sección 07 a Top 10 por incorrectas | 25 pruebas del padre y del reporte aprobadas; revisión de diff y whitespace. | Anterior al cambio manual de prioridad a `total_tickets`. |

Los fallos preexistentes de la suite completa fueron: `App` no reconoce `app-landing` y `Login` carece de proveedor de `ActivatedRoute`. La compilación necesitó acceso autorizado a Google Fonts por los estilos globales existentes; mantuvo advertencias de presupuestos del bundle y de estilos.

### 12.2. Cobertura inspeccionada y validaciones pendientes

Los specs cubren disponibilidad, errores `404`, cero resultados, consistencia de cantidades, filtros y copias independientes, paginación de tickets, cancelaciones, versiones, fuentes/ciclos de pintura, filas y columnas, subtotal ponderado, nombres largos, fallos de render/captura, concurrencia, reintentos, abandono de página, escalas y límites.

**Observación pendiente:** el test `comparte selección y desempates con el gráfico y conserva los totales generales` todavía espera el orden `Primero, Alfa, Beta, Zeta`, correspondiente a incorrectas como primer criterio. Con el comparador actual, esos datos se ordenarían `Alfa, Beta, Zeta, Primero`. Esta incompatibilidad se identificó por inspección; no se ejecutó nuevamente la suite en esta tarea documental y no se afirma un resultado de ejecución actual.

Quedan pendientes la actualización autorizada de esa expectativa y una nueva ejecución de pruebas/compilación tras el cambio manual, la descarga visual actual en navegador, aceptación con datos reales y otros navegadores/volúmenes cercanos al límite.

Comandos existentes para una validación posterior desde `fronted-tickets/`:

```powershell
npm test -- --watch=false --include="**/requirement-categorization-audit.spec.ts" --include="**/requirement-categorization-report.spec.ts"
npm test -- --watch=false
npm run build
```

## 13. Archivos involucrados y dependencias

Las rutas Angular siguientes son relativas a `fronted-tickets/`:

| Archivo o conjunto | Responsabilidad |
|---|---|
| `src/app/components/pages/requirement-categorization-audit/requirement-categorization-audit.ts`, `.html`, `.css` | Consultas existentes, instantánea, validaciones, botón, contenedor y descarga. |
| `src/app/components/charts/Consolidated/requirement-categorization-report/requirement-categorization-report.ts`, `.html`, `.css` | Siete secciones estáticas, Top 10, subtotal y eventos de renderizado. |
| `src/app/models/requirement-categorization-audit.ts` | Tipos de auditoría, filtros y `RequirementCategorizationReportData`. |
| `src/app/services/requirement-categorization-audit.service.ts` | Rutas existentes y serialización de filtros. |
| `src/app/app-module.ts` | Declaración del componente no standalone. |
| Specs del padre/reporte y `requirement-categorization-report.fixture.ts` | Casos unitarios y datos ficticios. |
| `package.json` y `package-lock.json` | Dependencias declaradas y resoluciones. |
| `src/app/components/pages/incident-cause-analysis/` y `src/app/components/charts/Consolidated/incident-cause-report/` | Referencia del patrón de captura y descarga. |

Dependencias ya existentes: Angular y Angular Material, RxJS y **`html-to-image` `^1.11.13`**, resuelto a **1.11.13** en el lockfile. Chart.js/`ng2-charts` pertenecen al dashboard; las visualizaciones de este PNG no esperan sus animaciones ni capturan sus canvas. Las pruebas utilizan el builder Angular, Vitest y jsdom instalados. No se requiere añadir una dependencia para esta funcionalidad.

Fuentes de contexto: [ARCHITECTURE.md](../ARCHITECTURE.md), [PROJECT_STATE.md](../PROJECT_STATE.md), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) y [TEST_PLAN.md](../TEST_PLAN.md). Su contenido anterior no sustituye el comparador actual inspeccionado.

## 14. Riesgos, limitaciones y observaciones pendientes

| ID | Observación | Consecuencia o estado |
|---|---|---|
| P-01 | El test de desempates conserva el orden anterior por incorrectas. | Debe reconciliarse con el orden actual por total antes de certificar la suite vigente. No se corrigió código en esta tarea. |
| P-02 | `ARCHITECTURE.md` y `TEST_PLAN.md` aún describen el orden principal por incorrectas; `PROJECT_STATE.md` también caracteriza el Top 10 por incorrectas. | Documentación anterior desactualizada respecto del cambio manual. Este PRD registra el comportamiento actual; los otros documentos se conservaron por la restricción de alcance. |
| P-03 | Las cuatro consultas agregadas son independientes y la versión es local al frontend. | La reconciliación de conteos detecta inconsistencias, pero no proporciona una instantánea transaccional del servidor. |
| P-04 | La validación de porcentajes recibidos comprueba rango y finitud, no su equivalencia matemática con las cantidades. | No debe describirse como recalculado o validado aritméticamente cada porcentaje general/de fila. El subtotal Top 10 sí se calcula desde cantidades. |
| P-05 | Límites de memoria/canvas y conversión HTML a imagen dependen del navegador. | Los controles actuales rechazan tamaños excesivos, pero no garantizan compatibilidad universal; no hay exportación multipágina. |
| P-06 | La evidencia visual y los resultados históricos preceden al cambio manual actual. | Pendiente validación de esta versión; no existe evidencia de despliegue, aceptación productiva ni contraste SQL Server para el PNG. |
| P-07 | El pie fija UTC−05:00 y el nombre de archivo usa la fecha local del navegador. | Pueden mostrar días distintos si el navegador usa otra zona horaria. Es el comportamiento actual, no una normalización adicional. |

## 15. Estado actual de implementación

El botón, las siete secciones, reutilización de datos, filtros efectivos, validaciones, control de versiones, renderizado y descarga están presentes en el código revisado. El gráfico y la tabla del PNG comparten el **Top 10 por total de tickets descendente**, con desempate por incorrectas descendentes y nombre. La tabla tiene un subtotal propio y los indicadores generales conservan el conjunto completo.

La funcionalidad tuvo validaciones ejecutadas en versiones anteriores. El último cambio manual de ordenamiento está implementado, pero su prueba específica y la documentación previa requieren reconciliación. No se certifica la suite ni el PNG visual de esa última versión.

---

**Nota de estado:** para elaborar este PRD se revisaron el documento de referencia, código, modelos, pruebas y evidencia disponible. Se creó únicamente este Markdown; no se modificaron Angular, backend, otros documentos ni dependencias, no se repitieron pruebas/compilación y no se realizó commit.
