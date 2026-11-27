# PRD 08 — Análisis de Atención Paralela de Tickets

**Estado:** Propuesta en análisis; reglas pendientes de validación.  
**Proyecto:** CANVIA — Gestión de Tickets.  
**Rama propuesta:** `feat/analisis-atencion-paralela-tickets`

## 1. Contexto y objetivo

Identificar incidentes y requerimientos con intervalos históricos de atención en curso superpuestos, por especialista y proyecto del grupo BASE DE DATOS Y EBS (predeterminado). Sustituir, para el nuevo módulo, la aproximación apertura–resolución por intervalos de acciones. Los registros de trabajo manuales aportan información complementaria; no prueban por sí solos un intervalo en curso. Mantener intactos los módulos existentes salvo ajustes de compatibilidad necesarios en la importación manual.

## 2. Fuentes de datos

- `dbo.tickets_report_times`: acciones, actor, grupo, inicio, fin, duración y datos del ticket.
- `dbo.tickets_manual_updates`: registros de trabajo, autor, minutos, fecha de registro y descripción.
- `dbo.incident_consolidated` y `dbo.requirement_consolidated`: catálogo de tickets padres, tipo, proyecto, ALP, prioridad, motivo, descripción y fechas del ciclo de vida.
- `dbo.task_consolidated`: relación Ticket_Padre/Ticket_ID para trazabilidad; atribución de tareas al padre pendiente de aprobación.

Muestra revisada (grupo predeterminado, archivos octubre–noviembre de 2026): 7,852 acciones de 4,916 tickets distintos; 1,124 registros manuales de 973 tickets distintos, con 151 filas adicionales respecto a Ticket_ID único. 959 IDs aparecen en ambos archivos. No se calcularon indicadores de concurrencia definitivos.

## 3. Cambios de importación manual

Agregar a tabla oficial y staging, con modelos SQLAlchemy equivalentes:

| Columna | Tipo SQL propuesto | Origen Excel |
|---|---|---|
| Date_Work_Created | DATETIME2(0) NULL | Date_Work_Created |
| work_type | NVARCHAR(150) NULL | work_type |
| work_description | NVARCHAR(MAX) NULL | work_description |
| work_time_spent_mins | DECIMAL(18,2) NULL | work_time_spent (mins) |
| created_by_contact_id | BIGINT NULL | created_by_contact_id |
| work_by_first_name | NVARCHAR(150) NULL | work_by_first_name |
| work_by_last_name | NVARCHAR(150) NULL | work_by_last_name |

Los tipos/longitudes deberán validarse con los archivos y contratos históricos. Conservar cada registro de trabajo aunque repita Ticket_ID. Eliminar la restricción lógica de unicidad por ticket tanto en ETL como en repositorio y ajustar conciliación, schema, respuesta de importación y consumidores. Mantener `Actualizacion_ID` como PK. Preferir ID de registro de origen, si existe; en caso contrario diseñar identidad de evento y política de multiplicidad/idempotencia (incluidas colisiones y reimportaciones). No deduplicar por Ticket_ID ni sobrescribir datos históricos sin plan de recuperación. Reimportar históricos disponibles para completar las columnas nuevas; filas antiguas incompletas no acreditan intervalos. Mantener bloqueo, transacción y auditoría.

## 4. Reglas de negocio propuestas (por validar)

1. Base de concurrencia: acciones con inicio y fin válidos (`Action_Start_Date < Action_End_Date`). No inferir intervalos a partir del estado final ni apertura/cierre.
2. Dos tickets distintos del mismo especialista están en paralelo si `A.inicio < B.fin AND B.inicio < A.fin`. Recortar coincidencia al rango de consulta y al mes correspondiente; límites semiabiertos `[inicio, fin)`. No comparar un ticket consigo mismo. Unir intervalos superpuestos del mismo ticket/actor para evitar duplicidad.
3. Identidad del actor por identificador de acción confiable si se valida; en su ausencia, normalizar nombres y resolver homónimos. Autor manual distinto del asignado; verificar pertenencia del autor al grupo cuando sea relevante.
4. Unir catálogos de incidentes y requerimientos por `UNION ALL` y enriquecer acciones por `Ticket_ID` y tipo. Evitar JOIN directo entre las dos tablas de hechos (multiplicación N×M). Integrar evidencia manual por separado o preagregada. Mantener control de tickets sin consolidado.
5. Registros manuales: conservar y mostrar como evidencia complementaria. `Date_Work_Created` indica registro, no inicio/fin de actividad; los minutos no demuestran simultaneidad. No sumarlos automáticamente como corrección de horas ni restarlos sin criterio validado. Separar horas de acciones, horas manuales declaradas y horas netas verificadas si posteriormente se requieren.
6. Alcance inicial propuesto: concurrencia entre incidentes/requerimientos directos, incluida concurrencia cruzada entre tipos y proyectos. Las tareas se conservan como contexto, sin convertirlas automáticamente en tickets padres ni añadirlas al KPI. Confirmar si se incorporarán intervalos de tareas al padre y si el análisis por proyecto debe considerar concurrencia de especialistas diferentes.
7. Filtros globales: desde/hasta (fecha de coincidencia, hasta inclusivo como día), grupo resolutor de acción por defecto BASE DE DATOS Y EBS, prioridad, motivo y proyectos. Propuesta: prioridad/motivo/proyecto filtran tickets mostrados, no compañeros usados para probar concurrencia; aclarar en detalle los tickets fuera del filtro. Tipo local filtra el ticket mostrado, no el tipo del compañero. Confirmar origen exacto del motivo y precedencia de atributos.
8. Conteos: ticket distinto por especialista/mes para resumen de resolutores, ticket distinto por proyecto/mes para resumen de proyectos. Total de fila y columna son acumulados de celdas mensuales (pueden repetir tickets entre meses o especialistas); KPI total de tickets en paralelo es distinto global del período. El explorador agrupa por ticket y especialista, con cantidad de otros tickets distintos coincidentes y máximo simultáneo como campos separados. El detalle devuelve evidencia temporal de cada compañero, sin incluir el ticket base.

## 5. Requisitos funcionales

- KPI: total de tickets distintos en paralelo, total de especialistas distintos con concurrencia, total de proyectos distintos involucrados.
- Resumen ejecutivo mensual: incidentes/requerimientos evaluados y en paralelo, porcentaje por tipo, total mensual y cobertura de evidencia si procede.
- Tabla mensual por resolutor: filas especialista, columnas meses, total de fila y pie; filtro local tipo y búsqueda frontend.
- Ranking horizontal por resolutor: meses apilados, etiqueta total, orden descendente, filtros locales tipo/mes, búsqueda frontend. Escala dinámica con referencia visual 0–800 si los datos lo permiten.
- Explorador: ticket, tipo, especialista, proyecto/ALP, fechas de coincidencia, cantidad de otros tickets, detalle. Filtro tipo, paginación.
- Modal de detalle: ticket coincidente, tipo, proyecto, prioridad, especialista, inicio/fin de coincidencia, duración, descripción; múltiples intervalos consultables sin inventar ventanas continuas.
- Tabla mensual por proyecto: filas proyecto, columnas meses, totales, filtros locales tipo y proyectos.
- Gráfico agrupado por proyecto/mes: barras verticales, leyenda por proyecto, etiquetas numéricas, filtro tipo y búsqueda por proyecto/ALP.
- Meses sin datos en cero, estados carga/vacío/error, filtros independientes y responsive. Buscadores locales deben recorrer el conjunto agregado completo, no solo una página de servidor.

## 6. Contrato API propuesto

Prefijo existente `/tickets-manual-updates`; nombres nuevos aún no implementados.

| Método | Ruta relativa | Consumidor |
|---|---|---|
| GET | /filters | Filtros globales |
| GET | /kpis | Indicadores |
| GET | /resumen-ejecutivo-mensual | Resumen mensual |
| GET | /paralelos-resolutores | Tabla y gráfico por resolutor |
| GET | /paralelos-tickets | Explorador paginado |
| GET | /paralelos-tickets/{ticket_id}/detalle | Modal; requiere identidad de resolutor para evitar ambigüedad |
| GET | /paralelos-proyectos | Tabla y gráfico por proyecto |

Compartir base analítica y reglas entre endpoints; devolver series mensuales desglosadas por tipo para filtros locales sin nuevas peticiones en agregados. Resumen y KPI calculados en servidor; explorador paginado en servidor con filtro de tipo. Validar fechas, tamaños y autorización. No generar productos cartesianos globales; agrupar por actor y usar barrido temporal o consulta equivalente con índices verificados.

## 7. Frontend propuesto

Página `components/pages/tickets-parallel-analysis`; hijos en `components/charts/Paralelos`:

- `parallel-executive-summary`
- `parallel-resolver-monthly-table`
- `parallel-resolver-ranking-chart`
- `parallel-ticket-explorer-table`
- `parallel-ticket-detail-dialog`
- `parallel-project-monthly-table`
- `parallel-project-monthly-chart`

Reutilizar los archivos existentes `models/tickets-manual-updates.ts`, `services/tickets-manual-updates.service.ts` y `components/kpi-card`. Mantener Angular Material, Chart.js, paleta CANVIA, navegación y estilo existentes. Confirmar referencias concretas TS/HTML/CSS al llegar a cada fase.

## 8. Criterios de aceptación

- Dos tickets diferentes del mismo actor con intersección positiva aparecen en resumen, ranking, explorador y detalle; extremos iguales no cuentan.
- Intervalos separados por pausas no generan falsos positivos; repetición de acciones del mismo ticket no aumenta conteos distintos.
- Coincidencias que cruzan meses se cuentan en cada mes afectado sin inflar el KPI global; el detalle es simétrico entre tickets.
- Incidente/requerimiento cruzados se reconocen conforme a la regla de filtro aprobada.
- Autor de registro manual distinto del asignado no se atribuye erróneamente; registro tardío no produce concurrencia confirmada.
- Múltiples registros manuales por Ticket_ID permanecen tras importación; repetir un archivo no multiplica eventos ya cargados según la política aprobada.
- Casos nulos, minutos no positivos, tickets sin consolidado, sin actor, fechas inválidas y sin datos reciben tratamiento explícito.
- Los filtros locales funcionan en todo el conjunto previsto; los totales concilian con su unidad de conteo. Importaciones y dashboard de Requerimientos Consolidados existentes conservan comportamiento aprobado.
- Validar fixtures conocidos, pruebas unitarias, integración SQL Server controlada, compilación Angular y pruebas visuales antes del cierre.

## 9. Plan de implementación

0. Analizar contexto y aprobar este PRD.
1. Migración SQL (oficial y staging), modelos y ETL/repositorio/servicio/schema manual, con estrategia de recuperación histórica.
2. Validar reglas con casos reales y consultas SQL de solo lectura; aprobar semántica de horas, tareas, filtros y conteos.
3. Implementar repositorio, servicio, schema y controller de los siete GET propuestos y pruebas.
4. Extender modelo TypeScript y servicio HTTP existentes.
5. Crear padre, navegación, filtros y KPIs con componentes de referencia.
6. Crear hijos en tres bloques: resolutores; explorador/modal; proyectos. Incorporar resumen ejecutivo mensual como componente adicional.
7. Integrar hijos manualmente, validar extremo a extremo, actualizar documentación y realizar commit.

## 10. Decisiones pendientes

- Confirmar si proyecto significa concurrencia por el mismo resolutor o entre especialistas distintos del mismo grupo, y si los compañeros deben ser del mismo proyecto.
- Confirmar si tareas se excluyen o se atribuyen al padre; política para horas de grupos distintos.
- Confirmar interpretación de registros manuales (adicional, sustitución, corrección o solo evidencia) y si existe identificador único de registro y fecha real de actividad.
- Confirmar filtros de motivo, alcance de compañeros, total acumulado vs distinto, campos de resumen ejecutivo, tratamiento de acciones abiertas y umbral mínimo de solapamiento.
- Validar DDL de staging e índices, model de tareas, ETL de tiempos en proceso, usuarios/identidades y disponibilidad de históricos. No se ha aplicado migración ni ejecutado pruebas de aplicación.
