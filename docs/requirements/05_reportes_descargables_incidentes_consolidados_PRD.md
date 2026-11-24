# PRD 05 — Reportes Descargables de Incidentes Consolidados

**Proyecto:** CANVIA — Plataforma de Análisis y Gestión de Tickets de TI  
**Módulo:** Incidentes Consolidados  
**Estado:** R01, R02 y R03 implementados; R04 pendiente
**Fecha:** 23/11/2026

## 1. Contexto

El módulo Incidentes Consolidados dispone de indicadores, tablas y gráficos sobre volumen de incidentes, proyectos, resolutores y alertas.

Actualmente se requiere generar reportes ejecutivos descargables que integren indicadores KPI, gráficos, hallazgos, conclusiones y recomendaciones en una presentación visual profesional.

Las imágenes proporcionadas constituyen referencias de diseño, no fuentes de datos.

## 2. Objetivo

El módulo tendrá exactamente cuatro reportes descargables (R01–R04), elaborados a partir de los datos y filtros existentes en Incidentes Consolidados. No se incluyen reportes adicionales.

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
- Top 10 de tickets por proyecto y mes, con barras verticales agrupadas y colores por mes.
- Dona de participación de los cinco proyectos principales y categoría Otros.
- Tendencia mensual general.

**Hallazgos:** tres observaciones relevantes sobre concentración, distribución y evolución de la demanda.

**Resultado ejecutivo:** una conclusión y exactamente tres recomendaciones mediante reglas TypeScript verificables.

**Filtros efectivos:** exclusivamente `desde`, `hasta`, `prioridad`, `motivo_estado`, `motivo_resolucion`, `grupo_resolutor` y `proyectos_excluidos`, aplicados por igual a los cuatro endpoints. No hereda filtros dinámicos ni modifica el estado del dashboard o R01.

**Composición:** infografía horizontal compacta de 1400 px CSS; cabecera y tres KPI horizontales; fila central con un único gráfico Top 10 agrupado (65 %) y dona Top 5 + Otros (35 %), con leyenda a su derecha; fila inferior con una única línea de tendencia, tres hallazgos y conclusión/recomendaciones en tres columnas. No subdividir el rango en gráficos apilados. Adaptar etiquetas en rangos densos conservando todos los registros. La dona usa la distribución completa como denominador, nunca el subtotal del ranking. Las comparaciones temporales respetan las reglas de meses completos de R01.

### R03 — Tickets por Mes — Proyecto Seleccionado

**Sección:** Empresa.

**Condición:** seleccionar un proyecto desde el Explorador por Proyectos.

**KPIs:**
- Total de tickets del proyecto.
- Mes de mayor registro.
- Variación porcentual y absoluta entre el primer y último mes completo comparable, identificados expresamente.

**Gráfico:** un único SVG de barras verticales multicolor, con todos los meses del rango, ceros, parciales y cantidades. Las variaciones mensuales se calculan entre meses completos consecutivos y se muestran en un resumen compacto de las últimas tres comparaciones disponibles.

**Hallazgos:** exactamente tres hechos sobre variación general, incrementos y reducciones; completar los inexistentes con máximo, meses cero y cobertura, sin repetir comparaciones ni inventar estabilidad. Una recuperación solo se describe si los conteos de meses completos consecutivos la demuestran.

**Resultado ejecutivo:** una conclusión y exactamente tres recomendaciones mediante reglas TypeScript.

**Identidad y filtros:** usar íntegro `proyectoSeleccionado`, sin inventar un catálogo de código/nombre. Conservar solo fechas, prioridad, motivos de estado/resolución, grupo resolutor, exclusiones compatibles y proyecto explícito. Omitir los otros filtros dinámicos y cambios del formulario pendientes de aplicar.

**Datos:** dos consultas independientes con filtros idénticos: `/kpis` y `/top-proyectos`. El proyecto se filtra antes de aplicar el ranking; no depende del Top 10 general. Reconciliar identidad y suma de la serie con el KPI antes de exportar.

**Composición:** 1400 px CSS; cabecera con grupo/proyecto íntegro y período; tres KPI; gráfico a la izquierda (62 %) y hallazgos/conclusión/recomendaciones a la derecha (38 %). No truncar nombres ni fragmentar el gráfico. Si no cabe legible, bloquear la exportación y solicitar reducir el rango. Botón «Reporte 3» junto a «Reporte 2», gris sin selección y naranja al habilitarse; invalidar inmediatamente al cambiar selección o filtros efectivos.

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

## 9. Decisiones pendientes

- Confirmar dimensiones finales y formatos de exportación.
- Determinar qué filtros dinámicos se aplicarán a cada reporte, especialmente el filtro de mes.
- Validar las reglas de selección y prioridad de hallazgos.
- Definir si se permitirá editar las recomendaciones antes de descargar.
- Confirmar la arquitectura de exportación mediante el análisis del repositorio.
- Completar R03 y R04 dentro del alcance cerrado de cuatro reportes.
