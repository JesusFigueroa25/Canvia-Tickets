# Índice de documentación de Gestión de Tickets

Para iniciar el proyecto, consulta el README general. Para rastrear un indicador desde Angular hasta SQL Server, empieza por la arquitectura, localiza la ruta en el contrato de API y consulta las tablas del dominio en el esquema de datos.

## Inicio y colaboración

| Documento | Qué encontrarás |
| --- | --- |
| [README general](../README.md) | Tecnologías, requisitos y comandos para iniciar Angular y FastAPI en local. |
| [Guía de agentes](../AGENTS.md) | Reglas del repositorio para cambios de código, contratos, bases compartidas y documentación. |
| [README del frontend](../fronted-tickets/README.md) | Instrucciones genéricas de Angular CLI para servir, compilar y probar la aplicación. |

## Referencia técnica y operación

| Documento | Qué encontrarás |
| --- | --- |
| [Arquitectura](ARCHITECTURE.md) | Capas de Angular y FastAPI, recorrido de una solicitud, filtros y separación entre SQL Server y SQLite. |
| [Contrato de API](API_CONTRACT.md) | Rutas inventariadas, filtros, modelos de respuesta, consumidores Angular y errores observados. |
| [Esquema de datos](DB_SCHEMA.md) | Tablas por dominio, relaciones, staging, deduplicación y diferencias entre DDL y modelos SQLAlchemy. |
| [Sistema de diseño](DESIGN_SYSTEM.md) | Estándar visual CANVIA, componentes existentes y diferencias respecto al diseño objetivo. |
| [Estado del proyecto](PROJECT_STATE.md) | Funcionalidades identificadas en el código y aspectos pendientes de comprobación. |
| [Plan de pruebas](TEST_PLAN.md) | Pruebas automatizadas identificadas, validaciones manuales y criterios de aprobación. |
| [Guía de despliegue](DEPLOYMENT.md) | Preparación de artefactos, activación, verificaciones y reversión, con pasos pendientes de validar. |

## Requisitos funcionales

| Documento | Qué encontrarás |
| --- | --- |
| [PRD 01 · Tiempos de atención de informes mensuales](requirements/01_tiempos_atencion_informes_mensuales_PRD.md) | Origen de los tiempos, reglas de cálculo, filtros, casos de referencia y reporte PNG. |
| [PRD 02 · Reporte PNG de auditoría de categorización](requirements/02_reporte_png_auditoria_categorizacion_PRD.md) | Resumen ejecutivo, cuatro gráficos en 2×2, Top 10 por incorrectas, análisis determinístico y condiciones de descarga PNG. |
| [PRD 03 · Promedios mensuales de horas y tickets](requirements/03_kpis_promedio_horas_tickets_PRD.md) | Definición de los dos KPI, filtros aplicables y contrato previsto para el dashboard. |
| [PRD 04 · Visualización de tiempos en minutos y horas](requirements/04_visualizacion_tiempos_minutos_horas_PRD.md) | Reglas de unidad y precisión, contratos afectados y criterios de presentación. |
| [PRD 05 · Reportes descargables de Incidentes Consolidados](requirements/05_reportes_descargables_incidentes_consolidados_PRD.md) | Alcance de los cuatro reportes R01–R04, filtros, reglas de cálculo y exportación PNG. |
| [PRD 05.1 · Resumen Ejecutivo de Incidentes](requirements/05_reportes_descargables_incidentes_consolidados_PRD.md#prd-051--resumen-ejecutivo-de-incidentes) | Reporte compacto de Análisis de Incidentes, reutilización del análisis vigente y PNG independiente del reporte largo. |

## Notas de implementación

| Documento | Qué encontrarás |
| --- | --- |
| [Apuntes sobre el PNG de informes mensuales](decisions/Reportes.md) | Solicitud original, comando de generación y componentes de referencia para el reporte descrito en el PRD 01. |
