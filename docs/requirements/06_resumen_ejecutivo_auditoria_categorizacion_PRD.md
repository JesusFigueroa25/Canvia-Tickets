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