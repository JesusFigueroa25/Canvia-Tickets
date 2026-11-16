# Contrato de API

## Alcance y convenciones

Este inventario se deriva de `Gestión_tickets/app/main.py`, los routers incluidos, sus `response_model` y los servicios HTTP de `fronted-tickets/src/app/services/`. Describe el contrato declarado en el código; no se ejecutó FastAPI ni se comparó contra una instancia desplegada. La respuesta efectiva también depende de la lógica del servicio y los datos disponibles.

Las rutas aquí se expresan tal como las publica FastAPI, sin prefijo `/api`. En `ng serve`, los servicios Angular anteponen `api/` y `proxy.conf.json` elimina `/api` antes de reenviar la solicitud. `db`, `response` y `BackgroundTasks` son dependencias/objetos internos de FastAPI, no parámetros HTTP.

En las tablas, los parámetros de una clase `*DashboardFilters` inyectada mediante `Depends` son query parameters. Las listas se tipan como repetibles/lista en FastAPI; el formato concreto de serialización de varios valores debe confirmarse con cada `HttpParams` consumidor.

## Inventario de endpoints

### Base, autenticación y panel

| Método y ruta | Parámetros HTTP | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `GET /` | — | Objeto JSON con `mensaje` | Sin servicio identificado |
| `POST /auth/login` | JSON `UserLogin`: `correo`, `password` | `TokenLogin` | `user.service.ts`; modelo `user.ts` / `token.ts` |
| `GET /home/resumen` | — | `HomeResumenOut` | `home.service.ts`; `home.ts` |

### SLA de incidentes

Los endpoints de consulta reciben los query parameters de `IncidentSLADashboardFilters`, salvo cuando se indica otra cosa.

| Método y ruta | Parámetros adicionales | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /incident-sla/import` | multipart `archivo` | `SLAImportOut` | `incident-sla.service.ts`; `import-result.ts` |
| `GET /incident-sla/filters` | — | `IncidentSLAFiltersOut` | `incident-sla.service.ts`; `incident-sla.ts` |
| `GET /incident-sla/kpis` | filtros SLA | `IncidentSLAKPIOut` | Ídem |
| `GET /incident-sla/insights` | filtros SLA | `IncidentSLAInsightsOut` | Ídem |
| `GET /incident-sla/sla-solucion-tendencia` | filtros SLA | `list[IncidentSLATrendItem]` | Ídem |
| `GET /incident-sla/volumen-incidentes` | filtros SLA | `list[IncidentSLAVolumenItem]` | Ídem |
| `GET /incident-sla/proyectos` | filtros SLA | `list[IncidentSLAProyectoItem]` | Ídem |
| `GET /incident-sla/pareto-tipos` | filtros SLA | `list[IncidentSLAParetoItem]` | Ídem |
| `GET /incident-sla/tendencia-incidentes` | filtros SLA | `IncidentSLATendenciaOut` | Ídem |
| `GET /incident-sla/resolutores` | filtros SLA | `list[IncidentSLAResolutorItem]` | Ídem |
| `GET /incident-sla/tickets` | filtros SLA; `pagina` ≥ 1 (default 1), `tamano` 1–100 (default 10) | `IncidentSLATicketsOut` | Ídem |

### SLA de requerimientos

Los endpoints de consulta reciben `RequirementSLADashboardFilters`, salvo cuando se indica otra cosa.

| Método y ruta | Parámetros adicionales | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /requirement-sla/import` | multipart `archivo` | `SLAImportOut` | `requirement-sla.service.ts`; `import-result.ts` |
| `GET /requirement-sla/filters` | — | `RequirementSLAFiltersOut` | `requirement-sla.service.ts`; `requirement-sla.ts` |
| `GET /requirement-sla/kpis` | filtros SLA | `RequirementSLAKPIOut` | Ídem |
| `GET /requirement-sla/sla-solucion-tendencia` | filtros SLA | `list[RequirementSLASolucionTendenciaItem]` | Ídem |
| `GET /requirement-sla/volumen-requerimientos` | filtros SLA | `list[RequirementSLAVolumenItem]` | Ídem |
| `GET /requirement-sla/proyectos` | filtros SLA | `list[RequirementSLAProyectoItem]` | Ídem |
| `GET /requirement-sla/pareto-requerimientos` | filtros SLA | `list[RequirementSLAParetoItem]` | Ídem |
| `GET /requirement-sla/tendencia-requerimientos` | filtros SLA; `ranking_desde` (default 1), `ranking_hasta` (default 5) | `list[RequirementSLATendenciaItem]` | Ídem |
| `GET /requirement-sla/resolutores` | filtros SLA | `list[RequirementSLAResolutorItem]` | Ídem |
| `GET /requirement-sla/participacion-proyectos` | filtros SLA | `list[RequirementSLAParticipacionProyectoItem]` | Ídem |
| `GET /requirement-sla/explorador-tipos` | filtros SLA | `RequirementSLAExploradorTiposOut` | Ídem |
| `GET /requirement-sla/distribucion-condicion-dia` | filtros SLA | `RequirementSLACondicionDiaOut` | Ídem |
| `GET /requirement-sla/porcentaje-cumplimiento-sla` | filtros SLA | `RequirementSLACumplimientoOut` | Ídem |
| `GET /requirement-sla/cumplimiento-sla-horario` | filtros SLA | `RequirementSLACumplimientoHorarioOut` | Ídem |
| `GET /requirement-sla/cumplimiento-sla-prioridad` | filtros SLA | `RequirementSLACumplimientoPrioridadOut` | Ídem |
| `GET /requirement-sla/top10-cumplimiento-sla-categoria` | filtros SLA | `RequirementSLATop10CategoriaOut` | Ídem |
| `GET /requirement-sla/cumplimiento-sla-tipo` | filtros SLA; `limite` opcional 1–100 | `RequirementSLACumplimientoTipoOut` | Ídem |
| `GET /requirement-sla/pareto-sla-categorias` | filtros SLA | `RequirementSLAParetoCategoriaOut` | Ídem |
| `GET /requirement-sla/pareto-sla-categorias-grafico` | filtros SLA | `RequirementSLAParetoGraficoOut` | Ídem |
| `GET /requirement-sla/tickets` | filtros SLA; `pagina` ≥ 1 (default 1), `tamano` 1–100 (default 10) | `RequirementSLATicketsOut` | Ídem |

### Incidentes consolidados

Las consultas reciben los query parameters de `IncidentConsolidatedDashboardFilters`, además de los específicos indicados.

| Método y ruta | Parámetros adicionales | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /incident-consolidated/import` | multipart `archivo` | `ConsolidatedImportOut` | `incident-consolidated.service.ts`; `import-result.ts` |
| `GET /incident-consolidated/filters` | — | `IncidentConsolidatedFiltersOut` | `incident-consolidated.service.ts`; `incident-consolidated.ts` |
| `GET /incident-consolidated/kpis` | filtros consolidados | `IncidentConsolidatedKPIOut` | Ídem |
| `GET /incident-consolidated/volumen-mensual` | filtros consolidados | `list[IncidentConsolidatedVolumenItem]` | Ídem |
| `GET /incident-consolidated/tipos` | filtros; `limite` 1–100 (default 10) | `list[IncidentConsolidatedTipoItem]` | Ídem |
| `GET /incident-consolidated/rendimiento-resolutores` | filtros; `pagina` ≥ 1 (default 1), `tamano` 1–100 (default 20) | `IncidentConsolidatedRendimientoOut` | Ídem |
| `GET /incident-consolidated/tickets-por-resolutor` | filtros; `tamano` 1–20 (default 5) | `IncidentConsolidatedTicketsPorResolutorOut` | Ídem |
| `GET /incident-consolidated/proyectos` | filtros consolidados | `list[IncidentConsolidatedProyectoItem]` | Ídem |
| `GET /incident-consolidated/top-proyectos` | filtros consolidados | `IncidentConsolidatedTopProyectosOut` | Ídem |
| `GET /incident-consolidated/prioridad-mensual` | filtros consolidados | `list[IncidentConsolidatedPrioridadMensualItem]` | Ídem |
| `GET /incident-consolidated/explorador-descripciones` | filtros; `buscar` opcional; `pagina` ≥ 1 (default 1); `tamano` 1–100 (default 10) | `IncidentConsolidatedExploradorDescripcionesOut` | Ídem |
| `GET /incident-consolidated/detalle-eventos-tecnicos` | mismos parámetros de explorador | `IncidentConsolidatedDetalleEventosOut` | Ídem |
| `GET /incident-consolidated/incidentes-porcentajes` | filtros; `limite` 1–100 (default 20) | `IncidentConsolidatedIncidentesPorcentajesOut` | Ídem |
| `GET /incident-consolidated/prioridades` | filtros consolidados | `list[IncidentConsolidatedPrioridadItem]` | Ídem |
| `GET /incident-consolidated/top-descripciones-proyectos` | filtros consolidados | `IncidentConsolidatedTopDescripcionProyectoOut` | Ídem |
| `GET /incident-consolidated/top-detalles` | filtros consolidados | `IncidentConsolidatedTopDetallesOut` | Ídem |
| `GET /incident-consolidated/tickets` | filtros; `pagina` ≥ 1 (default 1); `tamano` 1–100 (default 10) | `IncidentConsolidatedTicketsOut` | Ídem |
| `GET /incident-consolidated/atribucion-incidentes` | filtros consolidados | `IncidentConsolidatedAtribucionOut` | Ídem |
| `GET /incident-consolidated/top-servidores` | filtros; `limite` 1–50 (default 10) | `IncidentConsolidatedTopServidoresOut` | Ídem |
| `GET /incident-consolidated/analisis-causas` | filtros consolidados | `IncidentConsolidatedAnalisisCausasOut` | Ídem |
| `GET /incident-consolidated/distribucion-ajustada-causas` | filtros consolidados | `IncidentConsolidatedDistribucionAjustadaOut` | Ídem |
| `GET /incident-consolidated/principales-hallazgos` | filtros; `incluir_servidores` (default `false`) | `IncidentConsolidatedPrincipalesHallazgosOut` | Ídem |
| `GET /incident-consolidated/conclusiones` | filtros; `incluir_servidores` (default `false`) | `IncidentConsolidatedConclusionesOut` | Ídem |
| `POST /incident-consolidated/analisis-ejecutivo-ia` | JSON `IncidentConsolidatedDashboardFilters`; query `incluir_servidores` (default `false`) | `IncidentConsolidatedAnalisisEjecutivoIAOut` | `incident-consolidated.service.ts`; `incident-consolidated.ts` |

### Requerimientos consolidados

Las consultas reciben `RequirementConsolidatedDashboardFilters`, salvo cuando se indica otra cosa.

| Método y ruta | Parámetros adicionales | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /requirement-consolidated/import` | multipart `archivo` | `ConsolidatedImportOut` | `requirement-consolidated.service.ts`; `import-result.ts` |
| `GET /requirement-consolidated/filters` | — | `RequirementConsolidatedFiltersOut` | `requirement-consolidated.service.ts`; `requirement-consolidated.ts` |
| `GET /requirement-consolidated/kpis` | filtros consolidados | `RequirementConsolidatedKPIOut` | Ídem |
| `GET /requirement-consolidated/volumen-mensual` | filtros consolidados | `list[RequirementConsolidatedVolumenItem]` | Ídem |
| `GET /requirement-consolidated/proyectos` | filtros consolidados | `list[RequirementConsolidatedProyectoItem]` | Ídem |
| `GET /requirement-consolidated/tipos` | filtros; `limite` 1–100 (default 10) | `list[RequirementConsolidatedTipoItem]` | Ídem |
| `GET /requirement-consolidated/prioridades` | filtros consolidados | `list[RequirementConsolidatedPrioridadItem]` | Ídem |
| `GET /requirement-consolidated/top-proyectos` | filtros consolidados | `RequirementConsolidatedTopProyectosOut` | Ídem |
| `GET /requirement-consolidated/prioridad-mensual` | filtros consolidados | `list[RequirementConsolidatedPrioridadMensualItem]` | Ídem |
| `GET /requirement-consolidated/tickets` | filtros; `pagina` ≥ 1 (default 1); `tamano` 1–100 (default 10) | `RequirementConsolidatedTicketsOut` | Ídem |
| `GET /requirement-consolidated/productividad-proyectos` | filtros; `granularidad` ∈ `dia|semana|mes` (default `mes`); `limite_grafico` 1–20 (default 10); `pagina` ≥ 1; `tamano` 1–100 (default 25) | `RequirementProductividadOut` | Ídem |
| `GET /requirement-consolidated/dotacion-resolutores` | filtros; `pagina` ≥ 1; `tamano` 1–100 (default 25); `limite_grafico` 1–20 (default 10) | `RequirementDotacionOut` | Ídem |
| `GET /requirement-consolidated/atencion-paralela` | filtros; `pagina`, `tamano` 1–100 (default 25), `limite_grafico` 1–30 (default 10), `resolutor` opcional (máx. 150) | `RequirementAtencionParalelaOut` | Ídem |
| `GET /requirement-consolidated/actualizaciones-manuales` | filtros; paginación como atención paralela; `resolutor` opcional (máx. 150) | `RequirementActualizacionesManualesOut` | Ídem |

### Tareas consolidadas

Las consultas reciben `TaskConsolidatedDashboardFilters`, salvo cuando se indica otra cosa.

| Método y ruta | Parámetros adicionales | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /task-consolidated/import` | multipart `archivo` | `ConsolidatedImportOut` | `task-consolidated.service.ts`; `import-result.ts` |
| `GET /task-consolidated/filters` | — | `TaskConsolidatedFiltersOut` | `task-consolidated.service.ts`; `task-consolidated.ts` |
| `GET /task-consolidated/kpis` | filtros consolidados | `TaskConsolidatedKPIOut` | Ídem |
| `GET /task-consolidated/volumen-mensual` | filtros consolidados | `list[TaskConsolidatedVolumenItem]` | Ídem |
| `GET /task-consolidated/proyectos` | filtros consolidados | `list[TaskConsolidatedProyectoItem]` | Ídem |
| `GET /task-consolidated/tipos` | filtros; `limite` 1–100 (default 10) | `list[TaskConsolidatedTipoItem]` | Ídem |
| `GET /task-consolidated/prioridades` | filtros consolidados | `list[TaskConsolidatedPrioridadItem]` | Ídem |
| `GET /task-consolidated/top-proyectos` | filtros consolidados | `TaskConsolidatedTopProyectosOut` | Ídem |
| `GET /task-consolidated/prioridad-mensual` | filtros consolidados | `list[TaskConsolidatedPrioridadMensualItem]` | Ídem |
| `GET /task-consolidated/tickets` | filtros; `pagina` ≥ 1 (default 1); `tamano` 1–100 (default 10) | `TaskConsolidatedTicketsOut` | Ídem |

### Auditoría de categorización de requerimientos

| Método y ruta | Parámetros (query/path/body) | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /requirement-categorization-audit/runs` | JSON `AuditRunCreate`; ejecución en background | `AuditRunOut`, HTTP 202 | `requirement-categorization-audit.service.ts`; `requirement-categorization-audit.ts` |
| `GET /requirement-categorization-audit/runs` | `grupo_resolutor` opcional, `limite` 1–200 (default 50), `offset` ≥ 0 | `list[AuditRunOut]` | Ídem |
| `GET /requirement-categorization-audit/runs/{run_id}` | path `run_id` ≥ 1; `grupo_resolutor` opcional | `AuditRunOut` | Ídem |
| `GET /requirement-categorization-audit/summary` | `run_id` opcional > 0; `grupo_resolutor` opcional | `AuditSummaryOut` | Ídem |
| `GET /requirement-categorization-audit/tickets` | filtros de ticket detallados abajo; `page` 1+ (default 1), `page_size` 1–200 (default 25) | `AuditTicketListOut` | Ídem |
| `GET /requirement-categorization-audit/resolvers` | `run_id` opcional > 0; `grupo_resolutor` opcional | `AuditResolverListOut` | Ídem |
| `GET /requirement-categorization-audit/categories` | `grupo_resolutor` opcional; `limite` 1–1000 (default 200); `offset` ≥ 0 | `AuditCategoryListOut` | Ídem |
| `POST /requirement-categorization-audit/groups` | JSON `AuditGroupCreate` | `AuditGroupOut` | Ídem |
| `GET /requirement-categorization-audit/groups` | `grupo_resolutor` opcional; `limite` 1–200 (default 50); `offset` ≥ 0 | `list[AuditGroupOut]` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}` | path `group_id` ≥ 1; `grupo_resolutor` opcional | `AuditGroupOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/runs` | path `group_id` ≥ 1; `grupo_resolutor` opcional | `list[AuditRunOut]` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/summary` | path `group_id`; `AuditDashboardFilters` | `AuditGroupSummaryOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/tickets` | path `group_id`; filtros; `page` 1+ (default 1), `page_size` 1–200 (default 25) | `AuditGroupTicketListOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/resolvers` | path `group_id`; `AuditDashboardFilters` | `AuditGroupResolverListOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/monthly-stats` | path `group_id`; `AuditDashboardFilters` | `AuditGroupMonthlyStatsOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/resolution-reasons` | path `group_id`; `AuditDashboardFilters` | `AuditGroupResolutionReasonListOut` | Ídem |
| `GET /requirement-categorization-audit/groups/{group_id}/filter-options` | path `group_id` | `AuditGroupFilterOptionsOut` | Ídem |

Los filtros comunes de auditoría son `desde`, `hasta`, `grupo_resolutor`, `proyecto`, `resultado`, `motivo_resolucion`, `mes`, `nombre_resolutor` y `ticket_id`. `mes` usa `YYYY-MM`. La lista de tickets añade `run_id` opcional, `resultado`, `nombre_resolutor`, `ticket_id`, `proyecto`, `desde` y `hasta`.

### Reporte diario

`DailyReportDashboardFilters` aporta los query parameters opcionales `desde`, `hasta`, `grupo_resolutor` y `proyecto`.

| Método y ruta | Parámetros | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `GET /daily-report/filters` | — | `DailyReportFiltersOut` | `daily-report.service.ts`; `daily-report.ts` |
| `GET /daily-report/resumen` | filtros diarios | `DailyReportSummaryOut` | Ídem |
| `GET /daily-report/kpis` | filtros diarios | `DailyReportKPIOut` | Ídem |
| `GET /daily-report/diario` | filtros diarios | `list[DailyReportDayOut]` | Ídem |
| `GET /daily-report/proyectos` | filtros diarios | `list[DailyReportProyectoItem]` | Ídem |
| `GET /daily-report/top-proyectos` | filtros diarios | `DailyReportTopProyectosOut` | Ídem |

### Chat analítico IA

| Método y ruta | Parámetros | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /ai-chat/messages` | JSON `ChatMessageRequest`: `pregunta` (1–2000 caracteres), `conversation_id` opcional > 0. Responde HTTP 201 al crear conversación y 200 al continuar. | `ChatMessageResponse` | `ai-chat.service.ts`; `ai-chat.ts` |
| `GET /ai-chat/conversations` | `limit` 1–100 (default 30), `offset` ≥ 0 (default 0) | `ChatConversationListOut` | Ídem |
| `GET /ai-chat/conversations/{conversation_id}` | path `conversation_id` > 0 | `ChatConversationOut` | Ídem |
| `GET /ai-chat/conversations/{conversation_id}/messages` | path `conversation_id` > 0; `limit` 1–100 (default 50); `offset` ≥ 0 | `ChatHistoryOut` | Ídem |

El envío de mensaje se procesa en `app/services/ai/chat_service.py`. Ese flujo integra interpretación, planificación/consulta analítica, redacción y persistencia; los tests usan clientes simulados en los escenarios unitarios identificados. El acceso efectivo a OpenAI depende de configuración y del modo de generación.

### ETL de prueba y actualizaciones manuales

| Método y ruta | Parámetros | Respuesta declarada | Consumidor Angular |
|---|---|---|---|
| `POST /etl-test/upload/{tipo}` | path `tipo`; multipart `archivo` | `ETLImportOut` | Sin servicio Angular identificado |
| `GET /etl-test/data/{tipo}` | path `tipo`; `limit` 1–1000 (default 100) | `ETLDataOut` | Sin servicio Angular identificado |
| `POST /tickets-manual-updates/import` | multipart `archivo` | `TicketsManualUpdatesImportOut` | `tickets-manual-updates.service.ts`; `tickets-manual-updates.ts` |

El ETL de prueba acepta los tipos `incident_sla`, `requirement_sla`, `incident_consolidated` y `requirement_consolidated`. No es el endpoint de importación productiva de SQL Server.

## Filtros de consulta compartidos

Todos los filtros enumerados abajo son opcionales salvo que un tipo o validación lo restrinja. En endpoints que los reciben mediante `Depends`, los campos se exponen como query parameters, no como JSON body.

| Modelo Pydantic | Query fields |
|---|---|
| `IncidentSLADashboardFilters` | `desde`, `hasta`, `grupo_resolutor`, `prioridad`, `proyecto`, `tipo_incidente` (lista), `periodo` (`YYYY-MM`), `proyectos_excluidos` (lista), `ticket_id` (máx. 20) |
| `RequirementSLADashboardFilters` | `desde`, `hasta`, `grupo_resolutor`, `prioridad`, `categoria`, `proyecto`, `tipo_requerimiento` (lista), `condicion_dia`, `sla_solucion_condicion`, `periodo` (`YYYY-MM`), `proyectos_excluidos` (lista), `ticket_id` (máx. 20) |
| `IncidentConsolidatedDashboardFilters` | `desde`, `hasta`, `prioridad`, `motivo_estado`, `motivo_resolucion`, `grupo_resolutor`, `proyecto`, `proyectos_excluidos` (lista), `nombre_resolutor`, `descripcion`, `periodo` (`YYYY-MM`), `tipo_incidente` (lista), `detalle_id`, `ticket_id` |
| `RequirementConsolidatedDashboardFilters` | `desde`, `hasta`, `prioridad`, `motivo_estado`, `motivo_resolucion`, `grupo_resolutor`, `proyecto`, `periodo` (`YYYY-MM`), `tipo_requerimiento` (lista), `proyectos_excluidos` (lista), `ticket_id` (máx. 20) |
| `TaskConsolidatedDashboardFilters` | `desde`, `hasta`, `prioridad`, `motivo_estado`, `grupo_resolutor`, `proyecto`, `proyectos_excluidos` (lista), `periodo` (`YYYY-MM`), `tipo_tarea` (lista), `ticket_id` (máx. 20) |
| `DailyReportDashboardFilters` | `desde`, `hasta`, `grupo_resolutor`, `proyecto` |
| `AuditDashboardFilters` | `desde`, `hasta`, `grupo_resolutor`, `proyecto`, `resultado`, `motivo_resolucion`, `mes` (`YYYY-MM`), `nombre_resolutor`, `ticket_id` |

## Schemas y modelos de datos del contrato

FastAPI define la forma de entrada/salida principalmente mediante Pydantic `response_model` y tipos de parámetros; Angular declara tipos TypeScript en `src/app/models/`. Los nombres y formas no son un contrato generado automáticamente y deben mantenerse sincronizados.

| Dominio | Schemas Pydantic principales | Modelos TypeScript |
|---|---|---|
| Login | `UserLogin`, `TokenLogin` (`schemas/auth_schema.py`) | `user.ts`, `token.ts` |
| Panel | `HomeResumenOut` y schemas anidados (`schemas/home_schema.py`) | `home.ts` |
| SLA | `SLAImportOut`, esquemas de KPI/filtros/series/tickets (`schemas/sla_import_schema.py`) | `incident-sla.ts`, `requirement-sla.ts`, `import-result.ts` |
| Consolidados | esquemas incidentes/requerimientos y respuesta de análisis IA (`schemas/consolidated_import_schema.py`) | `incident-consolidated.ts`, `requirement-consolidated.ts`, `import-result.ts` |
| Tareas | `TaskConsolidated*` (`schemas/task_consolidated_schema.py`) | `task-consolidated.ts`, `import-result.ts` |
| Auditoría | `AuditRunCreate`, `AuditGroupCreate`, `Audit*Out`, `CategorizationStatus` (`schemas/requirement_categorization_audit_schema.py`) | `requirement-categorization-audit.ts` |
| Reporte diario | `DailyReport*` (definidos en `controllers/daily_report_controller.py`) | `daily-report.ts` |
| Chat IA | `ChatMessageRequest`, `ChatMessageResponse`, `ChatConversation*`, `ChatHistoryOut` (`schemas/ai_chat_schema.py`) | `ai-chat.ts` |
| ETL de prueba | `ETLImportOut`, `ETLDataOut` (`schemas/etl_test_schema.py`) | No se encontró cliente/modelo específico Angular |
| Actualizaciones manuales | `TicketsManualUpdatesImportOut` (`schemas/tickets_manual_updates_schema.py`) | `tickets-manual-updates.ts` |

## Integración OpenAI

La API usa el SDK oficial Python `openai` desde servicios backend; Angular no llama directamente a OpenAI.

- `OPENAI_API_KEY`: credencial leída en servidor por los servicios de chat y análisis. Debe configurarse como variable de entorno protegida. Nunca debe incluirse en frontend, documentación con valor real, repositorio ni logs.
- `OPENAI_MODEL`: modelo leído por esos mismos flujos. En el chat se observan valores por defecto en algunos caminos de generación; los servicios de análisis ejecutivo exigen que la configuración exista. El nombre de modelo vigente debe definirse por entorno, no se fija aquí.
- **Chat:** `POST /ai-chat/messages` delega a `chat_service.py`, que usa llamadas `chat.completions` para interpretación/redacción según la ruta de generación. Puede reportar modo de generación y errores de proveedor en su respuesta/estado.
- **Análisis ejecutivo:** `POST /incident-consolidated/analisis-ejecutivo-ia` delega a `incident_analysis_ai_service.py` y `incident_analysis_ai_decision.py`; el servicio reúne datos analíticos, solicita una narrativa estructurada y tiene una ruta de respaldo basada en reglas/datos ante fallos. El contrato de salida es `IncidentConsolidatedAnalisisEjecutivoIAOut`.

La llamada externa requiere conectividad, SDK instalado y configuración válida; el contrato no garantiza que OpenAI responda ni que el modelo esté disponible. Las pruebas unitarias de análisis IA simulan la llamada para no usar credenciales ni consumir tokens.

## Errores y estados HTTP observados

- FastAPI/Pydantic valida tipos y restricciones; los errores de validación de parámetros/cuerpos producen normalmente HTTP 422.
- `POST /requirement-categorization-audit/runs` declara HTTP 202 porque la corrida se agenda como tarea de fondo.
- El chat devuelve 201 al crear una conversación y 200 al continuarla. El controlador convierte estados internos en HTTP 404, 409, 422, 502 o 503 según el caso, y usa 500 para fallos de persistencia/backend.
- Los controladores de importación de incidentes/requerimientos consolidados convierten `ValueError` en 400 y otros errores en 500; otros controladores tienen sus propios mapeos.
- No hay un catálogo global uniforme de errores ni una respuesta de error común para todos los routers.

## Pendientes de validación

1. Contrastar los filtros de lista con la serialización real de `HttpParams` (repetición de clave, formato de listas y codificación de fechas).
2. Comparar cada respuesta Pydantic con el modelo TypeScript correspondiente; los tipos de frontend son anotaciones estáticas y no validación runtime.
3. Confirmar autenticación/autorización efectiva por endpoint. El login emite JWT; la revisión de rutas no demuestra que todas las demás rutas lo exijan.
4. Confirmar el inventario contra OpenAPI de la instancia desplegada y verificar rutas que puedan añadirse fuera de los controladores inspeccionados.
5. Verificar semántica y errores HTTP de todos los endpoints con un entorno de prueba; esta documentación refleja código, no pruebas de contrato ejecutadas.
6. Confirmar configuración de OpenAI por entorno y manejo de datos enviados al proveedor. No se documentan valores ni modelos específicos.
