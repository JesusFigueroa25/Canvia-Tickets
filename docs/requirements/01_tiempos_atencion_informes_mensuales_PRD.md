# PRD 01 — Análisis de tiempos de atención de informes mensuales

> **Ruta en el repositorio:** `docs/requirements/01_tiempos_atencion_informes_mensuales_PRD.md`  
> **Proyecto:** CANVIA — Plataforma de análisis y gestión de tickets de TI  
> **Módulo:** Nueva página de análisis de tiempos de informes mensuales  
> **Fecha de elaboración:** 2026-11-18  
> **Estado:** Requerimiento definido; reglas pendientes de validación antes de implementar

## 1. Contexto y problema

Actualmente se requiere conocer cuánto tiempo registran los especialistas del grupo **BASE DE DATOS Y EBS** en las acciones asociadas a tickets de elaboración de informes mensuales de Serviceaide.

La fuente inicial será un archivo Excel de **reportes de ocupabilidad**, correspondiente a mayo de 2026. En este archivo un mismo `Ticket_ID` puede aparecer en varias filas, porque cada fila representa una intervención o tramo de tiempo registrado. El análisis debe **conservar estas filas** y acumular sus tiempos; no debe asumir que cada ticket ocupa una sola fila.

La funcionalidad se implementará en **una nueva página Angular**, tomando como referencia la experiencia del dashboard de Requerimientos Consolidados.

## 2. Objetivo

Permitir consultar, por mes:

1. El tiempo registrado por **resolutor** en requerimientos categorizados como elaboración de informes mensuales.
2. El tiempo total registrado por **cliente/proyecto** para esos requerimientos.
3. El volumen mensual de requerimientos y los indicadores generales del conjunto de datos.

**Interpretación del indicador:** `Horas` representa el tiempo consignado en los tramos de acción del Excel. No debe describirse automáticamente como duración calendario entre creación y cierre, tiempo SLA ni tiempo efectivo de trabajo sin verificar el significado de la fuente.

## 3. Alcance funcional

| ID | Requerimiento |
|---|---|
| RF-01 | Crear la tabla SQL Server `tickets_report_times` para almacenar los registros del Excel. |
| RF-02 | Importar el Excel conservando las distintas intervenciones asociadas a un mismo `Ticket_ID`. |
| RF-03 | Consultar el **tiempo por resolutor y mes** mediante una tabla. |
| RF-04 | Visualizar el **tiempo por resolutor y mes** mediante un gráfico. |
| RF-05 | Consultar el **tiempo por cliente/proyecto y mes** mediante una tabla. |
| RF-06 | Visualizar el **tiempo por cliente/proyecto y mes** mediante un gráfico. |
| RF-07 | Mostrar un gráfico de **Volumen Mensual de Requerimientos**. |
| RF-08 | Mostrar KPI de total de requerimientos, total de proyectos, alta criticidad y porcentaje de alta criticidad. |
| RF-09 | Aplicar filtros globales de fechas y grupo resolutor, y selección dinámica de uno, varios o todos los proyectos. |
| RF-10 | Crear una nueva página Angular con componente padre e hijos reutilizables, manteniendo la línea visual de CANVIA. |

### 3.1. Entregables visuales propuestos

| Elemento | Nombre funcional sugerido | Contenido |
|---|---|---|
| Tabla 1 | **Tiempo de informes mensuales por resolutor** | Mes, proyecto, resolutor, tickets distintos, horas acumuladas. |
| Gráfico 1 | **Horas por resolutor y mes** | Comparación de horas entre resolutores y periodos. |
| Tabla 2 | **Tiempo de informes mensuales por proyecto** | Mes, cliente/proyecto, tickets distintos, horas acumuladas. |
| Gráfico 2 | **Horas por proyecto y mes** | Comparación de horas entre clientes/proyectos y periodos. |
| Gráfico adicional | **Volumen Mensual de Requerimientos** | Número de tickets distintos por mes. |
| KPI | **Total de Requerimientos** | Conteo de `Ticket_ID` distintos, no número de filas de acciones. |
| KPI | **Total de Proyectos** | Número de proyectos distintos. |
| KPI | **Alta Criticidad** | Conteo según la regla de prioridades por validar. |
| KPI | **% Alta Criticidad** | Porcentaje según numerador y denominador por validar. |

> Los nombres y columnas de las visualizaciones son propuestas de especificación; no representan componentes o contratos API ya existentes.

## 4. Fuente de datos y mapeo SQL Server

**Origen:** archivo Excel de ocupabilidad exportado desde Serviceaide.  
**Destino previsto:** tabla `tickets_report_times`.  
**Granularidad requerida:** una fila por intervención registrada en el archivo, **no una fila única por ticket**.

| # | Columna Excel | Columna SQL prevista |
|---:|---|---|
| 1 | ID del ticket | `Ticket_ID` |
| 2 | Tipo de ticket | `Ticket_type` |
| 3 | Fecha de creación | `Fecha_Creacion` |
| 4 | Organización del solicitante | `Proyecto` |
| 5 | Clase | `Categorizacion_Nivel_1` |
| 6 | Categoría | `Categorizacion_Nivel_2` |
| 7 | Tipo | `Categorizacion_Nivel_3` |
| 8 | Autor de la creación | `Autor_created` |
| 9 | Asignar al grupo | `Grupo_Resolutor` |
| 10 | action_by_last_name | `Resolutor_Apellido` |
| 11 | action_by_first_name | `Resolutor_Nombre` |
| 12 | Prioridad | `Prioridad` |
| 13 | Descripción | `Descripción` |
| 14 | Estado | `Estado` |
| 15 | Motivo | `Motivo` |
| 16 | Action Start Date | `Action_Start_Date` |
| 17 | Action End Date | `Action_End_Date` |
| 18 | Segundos | `Segundos` |
| 19 | Minutos | `Minutos` |
| 20 | Horas | `Horas` |

**Pendiente de diseño físico:** tipos de datos, claves, índices, política de reimportación, validaciones y posible identificador técnico por intervención. No se incluye aquí un `CREATE TABLE` definitivo hasta validar dichas decisiones.

El nombre completo visible del resolutor puede formarse inicialmente a partir de `Resolutor_Nombre` y `Resolutor_Apellido`. Se evaluará un `JOIN` con `requirement_consolidated` **solo si** es necesario y existe una correspondencia confiable entre registros. No se asume obligatorio.

## 5. Reglas de negocio

### 5.1. Reglas definidas por el alcance

| ID | Regla |
|---|---|
| RN-01 | Considerar tickets de tipo `Service Request`. |
| RN-02 | Filtrar inicialmente el grupo resolutor `BASE DE DATOS Y EBS`. |
| RN-03 | Para identificar informes mensuales, aplicar el filtro `Categorizacion_Nivel_3 = 'Elaboracion Informe Mensual'`. |
| RN-04 | Conservar distintas acciones correspondientes al mismo `Ticket_ID`; no deduplicar por ticket. |
| RN-05 | Obtener las horas acumuladas sumando el campo `Horas` de las intervenciones incluidas en el conjunto filtrado. |
| RN-06 | Agrupar los resultados por resolutor y mes, o por proyecto y mes, según la visualización. |
| RN-07 | Permitir seleccionar uno, varios o todos los proyectos, con ocho proyectos preseleccionados. |
| RN-08 | Mantener filtros globales **Desde**, **Hasta** y **Grupo Resolutor**. |
| RN-09 | Para conteos de requerimientos, evitar contabilizar una misma intervención como un ticket adicional: utilizar tickets distintos. |

### 5.2. Decisiones por validar

| ID | Pregunta o decisión |
|---|---|
| P-01 | ¿El mes de agrupación y el filtro Desde/Hasta usan `Fecha_Creacion`, `Action_Start_Date` o `Action_End_Date`? |
| P-02 | ¿Los tiempos se sumarán directamente desde `Horas` (redondeado en Excel) o desde `Segundos` y se convertirán a horas al final para mayor precisión? |
| P-03 | ¿Cómo identificar una intervención importada previamente para no duplicarla al volver a cargar un archivo, **sin** eliminar intervenciones legítimas del mismo ticket? |
| P-04 | ¿Qué prioridades componen **Alta Criticidad** y qué denominador se usa para el porcentaje? |
| P-05 | ¿Los filtros globales afectan también a los KPI y al gráfico de volumen mensual? ¿La selección local de proyectos afecta solo a tablas/gráficos o a todo el dashboard? |
| P-06 | ¿Cómo se tratan registros con tiempos vacíos, negativos, inconsistentes o tramos de fechas inválidos? |
| P-07 | ¿Cómo se expone la información adicional de KPI y volumen mensual si el alcance inicial contempla cuatro endpoints funcionales para dos tablas y dos gráficos? |
| P-08 | ¿El nombre del resolutor se deriva del Excel o debe contrastarse con `requirement_consolidated`? |

### 5.3. Precauciones de interpretación

- Una descripción como “Informe TRIMESTRAL” puede aparecer bajo `Categorizacion_Nivel_3 = 'Elaboracion Informe Mensual'`. El filtro acordado utiliza la **categoría**, no las palabras de la descripción; cualquier exclusión adicional requerirá una regla explícita.
- Que un informe se espere una vez al mes no significa que exista exactamente un ticket por cliente y mes. Deben mostrarse todos los tickets válidos.
- Varias filas de un ticket pueden reflejar pausas y reanudaciones de acciones. Se suman los tramos registrados, no el tiempo completo entre apertura y cierre.

## 6. Casos de referencia y resultados esperados

### Caso A — KOMATSU

- **Proyecto:** `104842 KOMATSU PROY CLOUD DTA CENT`.
- **Ticket:** `100-283393`.
- **Grupo:** `BASE DE DATOS Y EBS`.
- **Resolutor:** Lisandro Reyes Cruz.
- **Intervenciones:** 2 registros del mismo ticket.
- **Horas del Excel:** `1.26 + 0.91 = 2.17 horas`.
- **Resultado esperado:** 1 requerimiento distinto y 2.17 horas acumuladas según el campo `Horas` mostrado en Excel.

### Caso B — SEDAPAL

- **Proyecto:** `106255 SEDAPAL PROY CLOUD SERV HOSTING (O)`.
- **Periodo del ejemplo:** mayo de 2026.
- **Intervenciones:** 7 filas.
- **Tickets distintos:** `100-291093`, `100-291147`, `100-291145` (**3**).
- **Resolutores distintos:** Renzo Mendez Moreno, Lisandro Reyes Cruz y Luis Valderrama Santos (**3**).
- **Horas del Excel:** `1.24 + 0.54 + 0.01 + 0.01 + 0.00 + 1.33 + 4.25 = 7.38 horas`.
- **Resultado esperado:** la tabla por resolutor debe distribuir esas horas entre las tres personas y la tabla por proyecto debe mostrar 7.38 horas acumuladas para SEDAPAL, conforme a la suma del Excel.

> Los resultados anteriores son **casos de validación sobre los ejemplos proporcionados**, no evidencia de que el backend ya esté implementado. Si se usan segundos como base, los resultados podrían diferir antes del redondeo final.

## 7. Filtros

El módulo utiliza los tres mecanismos de filtrado definidos en [ARCHITECTURE.md](../ARCHITECTURE.md): globales, dinámicos y locales.

### 7.1. Filtros globales

- **Desde / Hasta:** delimitan el período de consulta.
- **Grupo Resolutor:** inicialmente `BASE DE DATOS Y EBS`.
- **Proyectos:** permiten seleccionar uno, varios o todos los proyectos.
- **Aplicar:** actualiza los indicadores, gráficos y tablas utilizando los filtros seleccionados.

### 7.2. Filtros dinámicos

- **Mes de análisis:** permite seleccionar un período mensual desde el gráfico ejecutivo o su selector asociado.
- La selección actualiza los KPI, gráficos y tablas vinculados.
- Al seleccionar «Todos los meses», se elimina el filtro dinámico de período y se conserva el rango definido por los filtros globales.

### 7.3. Filtros locales

- **Gráfico por resolutor:** búsqueda por nombre y selección de un mes para explorar las horas registradas.
- **Gráfico por proyecto:** controles locales de exploración según su implementación.
- **Tabla por resolutor:** búsqueda, ordenamiento y selector de indicador (horas, acciones o tickets).
- **Tabla por proyecto:** búsqueda, ordenamiento y selector de indicador (horas, acciones o tickets).

Los filtros locales no modifican los parámetros globales del dashboard. Cuando una búsqueda trabaja sobre datos paginados, su alcance corresponde únicamente a los registros disponibles en el componente, salvo implementación explícita de búsqueda en el backend.

### 7.4. Reglas de consulta

Los criterios técnicos utilizados por el backend, como `Categorizacion_Nivel_3 = 'Elaboracion Informe Mensual'`, se consideran **reglas de negocio de consulta**, no filtros dinámicos de la interfaz.

El análisis considera los tipos de tickets incluidos por las reglas vigentes del repositorio, sin restringirse exclusivamente a `Service Request`.

### 7.5. Proyectos preseleccionados

Se conserva la lista de ocho proyectos predeterminados establecida para el módulo, con posibilidad de seleccionar un único proyecto, varios proyectos o todos los proyectos.

## 8. Arquitectura e integración previstas

### 8.1. Base de datos

- SQL Server: nueva tabla `tickets_report_times`.
- Importación inicial: Excel de ocupabilidad de mayo de 2026.
- Almacenar cada intervención válida, incluso si un `Ticket_ID` aparece varias veces.
- Definir una estrategia de carga idempotente que evite duplicar accidentalmente el mismo archivo en reimportaciones.

### 8.2. Backend — FastAPI

Se prevé:

1. **1 endpoint de importación** para el Excel.
2. **4 endpoints funcionales**: datos de las dos tablas y de los dos gráficos.
3. Tratamiento de filtros, agrupaciones y suma de tiempos.

**Pendiente:** decidir si los KPI y el volumen mensual se incluirán en esas respuestas o requerirán endpoints adicionales. No se asignan rutas HTTP definitivas sin revisar el backend existente.

**Código de referencia pendiente de recibir:** backend de Requerimientos Consolidados y de `tickets_manual_updates`.

### 8.3. Frontend — Angular

- Crear **una nueva página/componente padre** tomando como referencia Requerimientos Consolidados.
- Integrar filtros globales, KPI y volumen mensual.
- Crear o reutilizar componentes hijos para las **dos tablas y los dos gráficos**.
- Crear modelo TypeScript y servicio HTTP acordes con los contratos FastAPI definitivos.
- Incorporar estados de carga, errores, ausencia de datos y presentación responsive.

**Archivos de referencia pendientes de recibir:** componente padre, servicio, modelo y componentes hijos existentes del dashboard de Requerimientos Consolidados.

## 9. Criterios de aceptación

- **CA-01:** La tabla SQL Server almacena las 20 columnas de origen previstas con el mapeo acordado.
- **CA-02:** Un ticket con múltiples intervenciones conserva todas sus filas válidas después de importarlo.
- **CA-03:** Reimportar el mismo archivo no duplica involuntariamente los mismos eventos, según la estrategia aprobada.
- **CA-04:** El ticket KOMATSU `100-283393` presenta **2.17 horas** al sumar las dos filas `Horas` del Excel.
- **CA-05:** El ejemplo SEDAPAL presenta **7 filas, 3 tickets distintos, 3 resolutores y 7.38 horas** según los valores `Horas` del Excel.
- **CA-06:** Las dos tablas y los dos gráficos muestran resultados consistentes bajo iguales filtros y reglas de agrupación.
- **CA-07:** El dashboard permite seleccionar los ocho proyectos iniciales, combinaciones de proyectos y todos los proyectos.
- **CA-08:** Los KPI no confunden cantidad de filas de intervenciones con cantidad de tickets distintos.
- **CA-09:** Los filtros Desde, Hasta y Grupo Resolutor se aplican según las reglas aprobadas.
- **CA-10:** El frontend muestra correctamente los estados de carga, error y conjunto vacío.
- **CA-11:** Las pruebas verifican la lógica de acumulación, los grupos, los proyectos y el periodo mensual.

## 10. Plan de implementación

| Fase | Actividad | Entregable |
|---|---|---|
| 1 | Revisar alcance, campos y reglas de negocio; resolver decisiones pendientes | Especificación validada |
| 2 | Diseñar y crear `tickets_report_times` | DDL SQL Server |
| 3 | Implementar importación Excel | Endpoint y validaciones de carga |
| 4 | Implementar consultas y endpoints funcionales | Respuestas para tablas y gráficos |
| 5 | Validar datos y resultados con ejemplos | Pruebas funcionales de backend |
| 6 | Crear página Angular, modelo, servicio y KPI/filtros | Componente padre operativo |
| 7 | Crear e integrar tablas, gráficos y volumen mensual | Dashboard completo |
| 8 | Probar integración y comportamiento de filtros | Validación final |

## 11. Fuera de alcance inicial

- Modificar los tickets originales de Serviceaide.
- Deduplicar registros legítimos de intervenciones solo porque comparten `Ticket_ID`.
- Afirmar cumplimiento SLA o duración calendario de resolución a partir de `Horas` sin reglas adicionales.
- Corregir automáticamente categorizaciones o descripciones inconsistentes en los datos de origen.

## 12. Dependencias y documentación relacionada

- Archivo Excel de ocupabilidad de Serviceaide.
- Definiciones de prioridad, criticidad y tratamiento de fechas.
- Backend de referencia de Requerimientos Consolidados y `tickets_manual_updates`.
- Frontend de referencia de Requerimientos Consolidados.
- `docs/DB_SCHEMA.md`: documentar el DDL final después de crearlo.
- `docs/API_CONTRACT.md`: documentar rutas y respuestas una vez confirmados los contratos.
- `docs/TEST_PLAN.md`: incorporar casos de prueba después de acordar los criterios definitivos.

---

**Nota de estado:** el alcance original de este PRD distingue las reglas solicitadas de decisiones técnicas inicialmente pendientes. La evidencia posterior del reporte PNG se registra en el apartado siguiente; no acredita por sí sola la validación de los datos ni del backend originales.

## 13. Reporte PNG implementado

La página permite descargar el análisis en un PNG con seis secciones: KPIs, resumen ejecutivo mensual, horas por resolutor, detalle por resolutor, horas por proyecto y mes y detalle por proyecto. Se reutilizan las respuestas del dashboard y se completan las páginas faltantes mediante los endpoints existentes; no se altera el backend. Se conservan los filtros efectivos globales y el mes dinámico; las búsquedas y selecciones locales no forman parte del reporte. Las tablas incluyen todos los registros filtrados y los gráficos conservan sus rankings Top 10.

La descarga espera consultas correctas, integridad de las tablas y confirmación del renderizado. El reporte protege versiones, errores, descargas repetidas y límites de imagen. Arquitectura, reglas actuales y dimensiones: [ARCHITECTURE.md](../ARCHITECTURE.md#reporte-png-de-tiempos-de-informes-mensuales). Resultados ejecutados y validaciones pendientes: [TEST_PLAN.md](../TEST_PLAN.md#reporte-png-de-tiempos-de-informes-mensuales).

**Diferencias observadas frente al alcance inicial:** el repositorio vigente filtra por categoría sin restringir el tipo a `Service Request`; los proyectos afectan también al KPI y al volumen; el resumen ejecutivo conserva el rango completo al seleccionar un mes. Los cuatro KPIs visibles son tickets, horas, proyectos y resolutores. El reporte refleja estos comportamientos existentes sin modificar las fórmulas ni sustituir las decisiones históricas de este documento.
