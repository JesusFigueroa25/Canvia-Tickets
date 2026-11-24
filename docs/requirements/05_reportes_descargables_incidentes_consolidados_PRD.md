# PRD 05 — Reportes Descargables de Incidentes Consolidados

**Proyecto:** CANVIA — Plataforma de Análisis y Gestión de Tickets de TI  
**Módulo:** Incidentes Consolidados  
**Estado:** Planificación  
**Fecha:** 23/11/2026

## 1. Contexto

El módulo Incidentes Consolidados dispone de indicadores, tablas y gráficos sobre volumen de incidentes, proyectos, resolutores y alertas.

Actualmente se requiere generar reportes ejecutivos descargables que integren indicadores KPI, gráficos, hallazgos, conclusiones y recomendaciones en una presentación visual profesional.

Las imágenes proporcionadas constituyen referencias de diseño, no fuentes de datos.

## 2. Objetivo

Implementar 10 reportes descargables. La primera fase comprende cuatro reportes elaborados a partir de los datos y filtros existentes en Incidentes Consolidados.

Los reportes deberán generar imágenes PNG de alta resolución con información dinámica y consistente.

## 3. Alcance funcional

### R01 — Análisis de Tickets Mensuales

**Sección:** Gráficos Principales.

**KPIs:**
- Total de tickets.
- Mes con mayor registro.
- Mes con menor registro.

**Gráfico:** Evolución mensual de tickets, tomando como referencia `app-volume-month`.

**Hallazgos:** hasta cuatro observaciones sobre crecimiento, reducciones, máximos e incrementos absolutos.

**Conclusión:** resumen de la tendencia operativa y recomendación pertinente a los resultados.

### R02 — Análisis de Tickets por Proyecto

**Sección:** Empresa.

**KPIs:**
- Total de tickets del período.
- Proyecto con mayor demanda.
- Mes con mayor registro.

**Gráficos:**
- Top 10 de tickets por proyecto y mes.
- Dona de participación de los cinco proyectos principales y categoría Otros.
- Tendencia mensual general.

**Hallazgos:** tres observaciones relevantes sobre concentración, distribución y evolución de la demanda.

**Resultado ejecutivo:** una conclusión y hasta tres recomendaciones.

### R03 — Tickets por Mes — Proyecto Seleccionado

**Sección:** Empresa.

**Condición:** seleccionar un proyecto desde el Explorador por Proyectos.

**KPIs:**
- Total de tickets del proyecto.
- Mes de mayor registro.
- Variación entre el primer y último mes.
- Variaciones mensuales.

**Gráfico:** evolución mensual de tickets del proyecto seleccionado.

**Hallazgos:** tres observaciones sobre crecimiento, reducciones y cambios relevantes.

**Resultado ejecutivo:** una conclusión y hasta tres recomendaciones.

El título y subtítulo mostrarán el grupo resolutor y el proyecto seleccionado.

### R04 — Análisis de Alertas Recurrentes

**Sección:** Alertas.

**KPIs:**
- Incidentes acumulados del Top 5.
- Total general de incidentes filtrados.
- Participación acumulada del Top 5.

**Gráfico:** cinco alertas más recurrentes, mostrando cantidades y porcentajes.

**Hallazgos:** tres observaciones sobre frecuencia, concentración y patrones identificables.

**Resultado ejecutivo:** una conclusión y hasta tres recomendaciones basadas en los datos disponibles.

Cuando exista un proyecto seleccionado, deberá aparecer en el encabezado.

### R05–R10

Pendientes de definición funcional.

## 4. Datos y contratos

Se priorizará la reutilización de:

- `GET /incident-consolidated/kpis`
- `GET /incident-consolidated/volumen-mensual`
- `GET /incident-consolidated/proyectos`
- `GET /incident-consolidated/top-proyectos`
- `GET /incident-consolidated/incidentes-porcentajes`

No se crearán nuevos endpoints salvo que el diagnóstico o las pruebas demuestren que los datos existentes son insuficientes.

## 5. Reglas de negocio

1. Los reportes respetarán los filtros aplicables del dashboard y mostrarán su alcance de forma explícita.
2. Los indicadores y gráficos utilizarán el mismo conjunto filtrado y denominadores coherentes.
3. Los meses se ordenarán cronológicamente, incluyendo el año.
4. Los porcentajes se calcularán con control de denominador cero y precisión definida.
5. Los máximos, mínimos y empates tendrán tratamiento determinístico.
6. No se generarán cifras ni hallazgos sin respaldo en los datos.
7. Los meses sin incidentes deberán representarse de forma consistente.
8. Los hallazgos descriptivos se construirán mediante reglas TypeScript reutilizables.
9. Las conclusiones y recomendaciones evitarán atribuir causas técnicas sin evidencia.
10. No se descargará un reporte incompleto o con solicitudes pendientes.

## 6. Requisitos técnicos

**Frontend:** Angular, Angular Material y componentes reutilizables para presentación de reportes.

**Gráficos:** reutilización de datos y criterios visuales de los componentes Chart.js existentes.

**Exportación:** PNG de alta resolución, mediante el mecanismo de captura compatible con el proyecto.

**Arquitectura:** componente padre coordinador, modelos tipados, lógica de análisis reutilizable y componentes de reporte independientes.

**Diseño:** identidad visual CANVIA, encabezados azul marino, acentos naranjas y verdes, tarjetas KPI, gráficos legibles y bloques ejecutivos.

## 7. Criterios de aceptación

- Cada reporte muestra indicadores correctos y coherentes con sus gráficos.
- Los textos se actualizan cuando cambian los datos o filtros.
- El reporte R03 utiliza exclusivamente el proyecto seleccionado.
- Los porcentajes del R04 utilizan el total general filtrado.
- La imagen descargada presenta gráficos, textos e iconos completos.
- La descarga no contiene elementos interactivos del dashboard.
- Los estados sin datos, errores y periodos incompletos se manejan correctamente.
- No se introducen regresiones en el dashboard existente.

## 8. Plan de implementación

**Etapa 0:** diagnóstico inicial, análisis de viabilidad y revisión con Codex.

**Etapa 1:** evaluación del diagnóstico, referencias visuales y arquitectura final.

**Etapa 2:** modificaciones de backend, únicamente cuando sean necesarias.

**Etapa 3:** implementación y validación del reporte R01 mediante Codex Planning y ejecución.

**Etapa 4:** implementación de R02, R03 y R04 después de aprobar el reporte piloto.

**Etapa 5:** definición e implementación posterior de R05–R10.

## 9. Decisiones pendientes

- Confirmar dimensiones finales y formatos de exportación.
- Determinar qué filtros dinámicos se aplicarán a cada reporte, especialmente el filtro de mes.
- Validar las reglas de selección y prioridad de hallazgos.
- Definir si se permitirá editar las recomendaciones antes de descargar.
- Confirmar la arquitectura de exportación mediante el análisis del repositorio.
- Especificar los seis reportes restantes.