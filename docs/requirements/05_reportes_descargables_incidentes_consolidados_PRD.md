# PRD 05 — Reportes Descargables de Incidentes Consolidados

**Proyecto:** CANVIA — Plataforma de Análisis y Gestión de Tickets de TI  
**Módulo:** Incidentes Consolidados  
**Estado:** cuatro reportes implementados (R01–R04); validación local con datos ficticios
**Fecha:** 24/11/2026

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

### R04 — Análisis de las Alertas Recurrentes

**Sección:** Alertas, botón naranja «Reporte 4» a la derecha del encabezado.

**KPIs:**
- Incidentes acumulados del Top 5.
- Alerta con mayor registro: cantidad, porcentaje y descripción íntegra; empates visibles señalados.
- Participación acumulada del Top 5.

El total general filtrado se muestra como contexto del denominador. Con una sola descripción no se repite su porcentaje en el KPI del líder.

**Gráficos:** barras horizontales del ranking original (hasta cinco descripciones), con cantidades y porcentajes; dona de dos segmentos: Top 5 acumulado y Otros. Si Otros es cero, conserva su leyenda sin dibujar un arco ficticio.

**Fuente y contrato:** exclusivamente `obtenerIncidentesPorcentajes(filtros, 5)`. El repositorio cuenta todo el universo filtrado y agrupa las mismas filas por descripción antes del límite, incluyendo NULL/vacíos como «Sin especificar» y registros únicos, sin mínimo de recurrencia. Se valida orden, cantidades enteras seguras, porcentajes individuales redondeados y subtotal ≤ total. Menos de cinco filas deben sumar el total únicamente por este contrato verificado; si no ocurre se bloquea la descarga. Las consultas internas no garantizan una instantánea transaccional.

**Filtros y modos:** lista positiva de `desde`, `hasta`, `prioridad`, `motivo_estado`, `motivo_resolucion`, `grupo_resolutor` y `proyectos_excluidos`. Agrega exclusivamente `proyectoSeleccionado` cuando existe; en modo general omite proyecto. Excluye `periodo`, `nombre_resolutor`, `descripcion`, `tipo_incidente`, `detalle_id` y `ticket_id`; no utiliza ediciones pendientes ni modifica filtros del dashboard. Fechas y demás filtros efectivos quedan visibles.

**Reglas ejecutivas:** exactamente tres hallazgos determinísticos: diferencia con la segunda descripción o empate visible, cobertura de Otros, y «Sin especificar» o concentración de las dos primeras/cobertura descriptiva. Una conclusión y tres recomendaciones sobre revisión de registros, desglose/seguimiento y calidad descriptiva o contraste de períodos. No infiere causas, empates fuera del corte ni recurrencia temporal.

**Composición:** 1400 px CSS y diseño ejecutivo CANVIA. Tres KPI horizontales. General: barras a la izquierda (62 %), dona y hallazgos a la derecha (38 %). Proyecto: barras/dona/hallazgos en tres columnas (47/23/30), con nombre completo en cabecera. Ambos modos integran conclusión y tres recomendaciones debajo. Descripciones en varias líneas sin truncamiento; si dejan de caber en una composición horizontal legible se bloquea el PNG con mensaje explicativo.

**Exportación:** instantánea tipada propia y coordinación independiente de R01–R03: versión, cancelación HTTP, espera de fuentes/dos pinturas, control de dimensiones y timeouts de 30 segundos. Cambios de proyecto/filtros invalidan; se impiden doble descarga y respuestas/capturas obsoletas. Cero incidentes no genera PNG; HTTP y captura permiten reintentar.

## 4. Datos y contratos

Se priorizará la reutilización de:

- `GET /incident-consolidated/kpis`
- `GET /incident-consolidated/volumen-mensual`
- `GET /incident-consolidated/proyectos`
- `GET /incident-consolidated/top-proyectos`
- `GET /incident-consolidated/incidentes-porcentajes`

Los cuatro reportes reutilizan los endpoints existentes, sin cambios de backend ni dependencias.

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

**Etapa 2:** verificación de contratos existentes, sin modificar backend.

**Etapa 3:** implementación y validación del reporte R01 mediante Codex Planning y ejecución.

**Etapa 4:** implementación de R02, R03 y R04 después de aprobar el reporte piloto.

## 9. Estado de validación y pendientes

El alcance queda cerrado a los cuatro reportes R01–R04. La arquitectura, los filtros y las reglas están documentados en [ARCHITECTURE.md](../ARCHITECTURE.md); las recomendaciones se generan automáticamente, sin edición ni GPT. El formato es PNG independiente de 1400 px CSS con captura de alta resolución y bloqueo de contenido ilegible.

Pendientes: aceptación visual con las referencias originales y datos reales, otros navegadores y resolución de la prueba preexistente de R02 en su propio alcance. Resultados reproducibles y límites en [TEST_PLAN.md](../TEST_PLAN.md#reporte-png-r04-de-incidentes-consolidados).


# PRD 05.1 — Resumen Ejecutivo de Incidentes

**Estado:** implementado en frontend; validación local con datos ficticios el 25/11/2026. Es un reporte de Análisis de Incidentes y no amplía los cuatro reportes de Incidentes Consolidados.

## 1. Contexto
Actualmente el módulo **Análisis de Incidentes** (`app-incident-cause-analysis`) ya cuenta con un reporte descargable extenso que consolida múltiples gráficos, tablas, hallazgos y conclusiones. Aunque es funcional, su longitud dificulta una lectura ejecutiva rápida.

Se requiere un nuevo reporte descargable, más compacto y visual, orientado a la **sección Atribución de Incidentes**, manteniendo el estándar gráfico ya aprobado en los reportes descargables de `incident-consolidated`.

## 2. Objetivo
Implementar un **Reporte 1 — Resumen Ejecutivo de Incidentes**, exportable en PNG, con formato horizontal y ejecutivo, que sintetice los indicadores y visualizaciones clave del análisis de incidentes.

## 3. Alcance
### Incluye
- Nuevo botón **Reporte 1** en la sección **Atribución de Incidentes**.
- Generación de un documento PNG de resumen ejecutivo.
- Reutilización de componentes y datos ya disponibles en frontend.
- Reutilización de los hallazgos y conclusiones ya generados mediante IA.

### No incluye
- Cambios de backend.
- Nuevos endpoints.
- Cambios en dependencias.
- Reemplazo del reporte largo actual.

## 4. Estructura del reporte
### Cabecera
- Título: **Resumen Ejecutivo de Incidentes**
- Período: rango aplicado
- Grupo resolutor
- Proyecto: visible solo si existe filtro aplicado
- Tipo de incidente: visible solo si existe filtro aplicado

### KPIs
1. **Total de incidentes**
2. **Incidentes con atribución definida**
3. **Incidentes sin atribución**

### Visualizaciones
Una única fila horizontal, con tarjetas de altura equilibrada y en este orden:
1. **Top de servidores con más incidentes — Top 5**
   - Fuente: `app-incident-top-servers-chart`; primeros cinco del ranking disponible, sin modificar el selector del dashboard.
   - Se omite completamente cuando no hay servidores identificados y se redistribuye el ancho entre los otros dos gráficos.
2. **Distribución por atribución**
   - Fuente: `app-incident-attribution-donut`
3. **Atribución original vs análisis de causa**
   - Fuente: `app-incident-attribution-comparison`

Los KPI y la dona usan la atribución original de la misma respuesta ajustada. Se exige atribuidos + sin atribución = total; los porcentajes de la dona usan el total atribuido. Los porcentajes de servidores usan el total filtrado y sus asociaciones pueden solaparse. Se conserva el estado/metodología de ajustes; ajustes pendientes no se presentan como reasignaciones aprobadas.

### Secciones narrativas
4. **Principales hallazgos**
   - Hasta cuatro hallazgos de la salida vigente, con textos y métricas íntegros.
5. **Conclusión y recomendación**
   - Una pareja completa de la salida vigente, con sus referencias incluidas en los hallazgos seleccionados.

El contrato público no ofrece prioridad numérica ni `evidencia_id`. La selección utiliza las prioridades verificadas del prompt backend que sí se expresan por `tipo`: cruces/patrones primero, restantes tipos operativos después y atribución complementaria al final. Los códigos desempatan de forma determinista; su posición en el array no se interpreta como importancia. No se reescriben textos ni se invoca IA al descargar.

## 5. Reglas funcionales
- El reporte debe generarse desde la sección **Atribución de Incidentes**.
- Debe usar los filtros efectivos ya aplicados en el dashboard.
- Proyecto y tipo de incidente solo se muestran si están filtrados.
- Si no hay datos suficientes, la descarga debe bloquearse con estado informativo.
- La exportación debe seguir el protocolo ya aprobado en reportes PNG previos.
- Esperar al análisis vigente de los mismos filtros; aceptar origen IA o respaldo por reglas, mostrando procedencia, modelo cuando exista y advertencia. Bloquear respuestas incompletas, errores, `sin_datos` y versiones anteriores. La ausencia exclusiva de servidores es válida.
- Reutilizar exclusivamente las tres fuentes cargadas: `distribucionAjustada`, `topServidores` y `resultadoAnalisisIA`. No condicionar el resumen a causas, tipos, proyectos o resolutores del reporte largo.
- Conservar una instantánea propia y control de generación/revisión de fuentes, versión, renderizado y captura. Reintentar render/captura no vuelve a consultar datos ni IA.
- Renderizar solo al solicitar la descarga; el componente presentacional se carga de forma diferida y no realiza HTTP.

## 6. Diseño y estilo
- Formato horizontal y compacto.
- Cabecera azul marino.
- Fondo claro.
- Acentos naranja y verde.
- Tipografía y composición consistentes con R01–R04 de `incident-consolidated`.
- Enfoque ejecutivo: lectura rápida, poco texto, alto contraste y jerarquía visual clara.
- Ancho de 1400 px CSS y captura a escala 2. Cabecera y tres KPI horizontales; fila de gráficos Servidores/Dona/Comparación 38/28/34; sin servidores, dos columnas. Cuarta fila: hallazgos 60 % y conclusión/recomendación 40 %.
- Encabezados azul marino, iconos estáticos y gráficos SVG/HTML sin controles. Nombres y textos completos en varias líneas. Si el contenido alcanza 1400 px CSS de altura o deja de ser legible, se bloquea el PNG sin recortes y se indica el reporte completo como alternativa.

## 7. Criterios de aceptación
- Existe un botón **Reporte 1** en la sección **Atribución de Incidentes**.
- El reporte se exporta en PNG sin controles del dashboard.
- El diseño mantiene consistencia visual con los reportes ya aprobados.
- El reporte muestra correctamente:
  - total de incidentes
  - incidentes con atribución definida
  - incidentes sin atribución
  - distribución por atribución
  - comparación original vs ajustada
  - top de servidores
  - hallazgos
  - conclusión y recomendación
- Proyecto y tipo de incidente solo aparecen cuando corresponda.
- El resultado final es más corto y más ejecutivo que el reporte actual.

## 8. Riesgos
- Dependencia de múltiples bloques de datos ya existentes en el módulo.
- Posibles inconsistencias entre visualizaciones si el dashboard usa cargas independientes.
- Necesidad de preservar la legibilidad del reporte en una sola composición horizontal.

## 9. Decisiones pendientes
- El componente es `incident-executive-summary-report`, independiente del reporte largo y de R01–R04.
- La franja de gráficos es única y respeta el orden Servidores/Dona/Comparación. No existe una segunda fila para servidores.
- Quedan pendientes la aceptación con datos reales y referencias originales y otros navegadores. Evidencias reproducibles y fallos preexistentes en [TEST_PLAN.md](../TEST_PLAN.md#resumen-ejecutivo-de-incidentes--reporte-1).


# PRD — Resumen Ejecutivo de Auditoría de Categorización

## 1. Contexto

El módulo **Auditoría de Categorización** dispone de un reporte PNG que incluye indicadores, distribuciones, gráficos mensuales y tablas estadísticas.

Aunque el reporte actual permite revisar los resultados, su extensión dificulta la lectura ejecutiva y su presentación visual no está alineada con el estándar reciente de reportes de CANVIA.

Se requiere rediseñar el reporte existente para sintetizar los principales resultados, manteniendo la confiabilidad de los datos y la funcionalidad actual del dashboard.

## 2. Objetivo

Implementar un **Resumen Ejecutivo de Auditoría de Categorización**, descargable en PNG, que facilite la interpretación del desempeño de categorización y permita identificar oportunidades de revisión.

## 3. Componentes afectados

- Padre: `app-requirement-categorization-audit`.
- Reporte existente: `app-requirement-categorization-report`.
- Botón de descarga: `Descargar Reporte PNG`.

La implementación reutilizará el botón y el flujo de descarga existentes.

## 4. Alcance funcional

### Cabecera

- Título: Resumen Ejecutivo Auditoría de Categorización.
- Período: mes inicial y final con año.
- Grupo resolutor: según filtro aplicado.
- Proyecto: mostrar únicamente cuando exista un proyecto filtrado.

### Indicadores KPI

1. Total de tickets evaluados.
2. Categorizaciones correctas: cantidad y porcentaje.
3. Categorizaciones incorrectas: cantidad y porcentaje.

Los indicadores deben respetar los filtros efectivos del dashboard y el criterio existente de tickets únicos evaluados.

### Visualizaciones

**Gráfico 1 — Distribución de Categorizaciones**

- Dona con categorizaciones correctas e incorrectas.
- Mostrar cantidades y porcentajes.
- Denominador: tickets evaluados.

**Gráfico 2 — Distribución por Motivo Resolución**

- Dona con categorías de motivo de resolución.
- Mostrar cantidades y porcentajes.
- Mantener categorías sin dato cuando correspondan.

**Gráfico 3 — Top 10 de Tickets por Colaborador**

- Barras horizontales.
- Mostrar categorizaciones correctas e incorrectas por colaborador.
- Destacar las incorrectas.
- Verificar y documentar el criterio de ordenamiento del ranking.

**Gráfico 4 — Categorizaciones Correctas e Incorrectas por Mes**

- Barras mensuales apiladas.
- Mostrar cantidades y diferenciación por color.
- Respetar el período filtrado.

### Análisis ejecutivo

**Principales hallazgos:** generar tres hallazgos basados en las cifras del reporte.

**Conclusión:** generar una conclusión que sintetice el desempeño de categorización.

**Recomendaciones:** generar tres recomendaciones vinculadas con los hallazgos observados.

Los textos se calcularán mediante reglas determinísticas, sin incorporar nuevos servicios de IA.

## 5. Reglas de negocio

- Los filtros del reporte deben ser los filtros globales efectivos.
- Las ediciones pendientes de aplicar no deben afectar la exportación.
- La población de tickets debe respetar las reglas existentes de evaluación vigente y deduplicación.
- La suma de correctas e incorrectas debe conciliar con el total evaluado, conforme al contrato actual.
- Los porcentajes deben calcularse sobre denominadores consistentes.
- Los gráficos mensuales deben respetar las agrupaciones y reglas existentes.
- Los textos automáticos no deben inventar causas técnicas ni atribuir responsabilidades individuales sin evidencia.
- Ante ausencia de datos, mostrar un estado informativo sin generar indicadores ficticios.

## 6. Diseño visual

Mantener el estándar ejecutivo de CANVIA:

- Cabecera: `#0B2342`.
- Naranja principal: `#FF620F`.
- Verde: `#16835B`.
- Fondo: `#F7F9FB`.
- Rojo para categorizaciones incorrectas.
- Documento horizontal de 1400 px CSS.
- Tres KPI en una fila.
- Cuatro gráficos distribuidos en dos columnas y dos filas.
- Bloque inferior con hallazgos, conclusión y recomendaciones.
- Tipografía, iconografía, bordes y espacios consistentes con los reportes aprobados.

La exportación debe producir una imagen legible, sin controles, cortes ni desbordamientos.

## 7. Exclusiones

No se incluirán en el nuevo PNG:

- Cuadro Estadístico Mensual completo.
- Top 10 Estadístico por Colaborador completo.

Los datos relevantes continuarán representados mediante gráficos e indicadores.

No se modificarán las tablas existentes del dashboard.

## 8. Criterios de aceptación

- El botón actual descarga el nuevo resumen ejecutivo.
- No se crea un botón adicional.
- Los filtros de período, grupo y proyecto funcionan correctamente.
- Se muestran los tres KPI conciliados.
- Se muestran los cuatro gráficos.
- Se generan tres hallazgos, una conclusión y tres recomendaciones.
- El reporte presenta el estándar visual de CANVIA.
- El PNG es más compacto que el reporte anterior.
- No se modifican endpoints ni dependencias.
- No se afectan otros reportes.
- Las pruebas de cálculo, filtrado y exportación resultan satisfactorias.

## 9. Plan de implementación

1. Revisar el reporte actual y los contratos de datos.
2. Identificar cálculos y estructuras reutilizables.
3. Rediseñar el HTML y CSS del reporte.
4. Incorporar los textos ejecutivos determinísticos.
5. Integrar la exportación con el botón actual.
6. Ejecutar pruebas funcionales y de regresión.
7. Validar los PNG con datos reales y escenarios de filtros.

## 10. Decisiones pendientes

- Confirmar el criterio de orden del Top 10 de colaboradores.
- Verificar la disponibilidad de todos los datos con los endpoints existentes.
- Definir el comportamiento del ranking con menos de diez colaboradores.
- Validar la composición final con descripciones y nombres extensos.