# PRD 03 — Ampliación de KPIs: promedio mensual de horas y tickets

| Campo | Detalle |
|---|---|
| Identificador | CANVIA-PRD-03 |
| Módulo | Análisis de Tiempos de Informes Mensuales |
| Estado | Implementado según cambios reportados; pruebas integrales pendientes de constatar |
| Fecha | 2026-11-19 |
| Tipo | Mejora funcional de analítica y visualización |
| Dependencia | `01_tiempos_atencion_informes_mensuales_PRD.md` |

## 1. Resumen ejecutivo

Ampliar el bloque de indicadores del módulo **Análisis de Tiempos de Informes Mensuales** de cuatro a **seis KPIs**, incorporando **Promedio de Horas por Mes** y **Promedio de Tickets por Mes**. Centralizar en `GET /tickets-report-times/kpis` los valores de **Horas Totales** y **Total Resolutores**, que antes se derivaban de otras fuentes en el frontend. Los seis indicadores deben responder a los filtros globales del módulo y utilizar definiciones uniformes para evitar discrepancias con tablas, gráficos y el reporte PNG.

## 2. Problema y justificación

El dashboard mostraba métricas esenciales, pero carecía de un promedio mensual explícito para comparar la carga de trabajo a lo largo del período. Además, obtener las horas y los resolutores desde endpoints distintos introducía dependencias de carga y posibles diferencias de filtrado. La mejora permite interpretar el volumen mensual de trabajo sin modificar la definición de ticket, acción o período.

## 3. Objetivo y resultado esperado

- Presentar **seis KPIs**: Total de Tickets, Horas Totales, Total de Proyectos, Total Resolutores, Promedio Horas/Mes y Promedio Tickets/Mes.
- Calcular los promedios en FastAPI y devolverlos en una única respuesta de `/tickets-report-times/kpis`.
- Aplicar coherentemente fechas, período, grupo resolutor y selección de proyectos.
- Mantener la visualización responsive en **tres columnas por dos filas** en escritorio, con adaptación a pantallas menores.
- Conservar la compatibilidad con el reporte PNG y los componentes existentes.

## 4. Alcance

### Incluye

1. Actualización del esquema de salida Pydantic de KPIs.
2. Agregaciones SQLAlchemy/SQL Server para totales, resolutores distintos y períodos con datos.
3. Cálculo de promedios en la capa de servicio.
4. Ampliación del modelo TypeScript `TicketsReportTimesKPI`.
5. Actualización de las tarjetas del componente padre Angular y del bloque KPI del reporte PNG.
6. Actualización de los datos ficticios de pruebas para el nuevo contrato.

### No incluye

- Crear tablas SQL Server ni modificar el ETL de acciones.
- Modificar los criterios de agrupación por proyecto/resolutor.
- Cambiar reglas de SLA, prioridad o categorización.
- Mostrar como KPI los campos históricos `alta_criticidad` y `porcentaje_alta_criticidad`; pueden permanecer temporalmente en el contrato por compatibilidad.

## 5. Fuente de datos y filtros

- Fuente principal: tabla SQL Server `tickets_report_times`, con un registro por **acción**.
- Categoría de análisis: `Categorizacion_Nivel_3 = 'Elaboracion Informe Mensual'`.
- Los períodos mensuales se determinan mediante `Fecha_Creacion` del ticket (no por la fecha de ejecución de la acción).
- Filtros: `desde`, `hasta`, `grupo_resolutor`, `periodo` (`YYYY-MM`), `proyectos` y `todos_proyectos`.
- Si `todos_proyectos = false` y no se especifican proyectos, se conserva la selección predeterminada de ocho proyectos definida por el módulo.
- Un mes sin registros bajo los filtros aplicados **no entra en el denominador** de los promedios.

## 6. Reglas de negocio

| Indicador | Definición |
|---|---|
| Total de Tickets | `COUNT(DISTINCT Ticket_ID)` del conjunto filtrado |
| Horas Totales | `SUM(Horas)` de las acciones filtradas |
| Total de Proyectos | `COUNT(DISTINCT Proyecto)` de valores informados/no vacíos |
| Total Resolutores | `COUNT(DISTINCT Nombre_Resolutor)` de valores informados/no vacíos |
| Meses con Datos | Número de parejas año-mes de `Fecha_Creacion` que tienen acciones filtradas |
| Promedio Horas/Mes | `SUM(Horas) / meses_con_datos` |
| Promedio Tickets/Mes | `SUM(COUNT(DISTINCT Ticket_ID) por mes) / meses_con_datos` |

**Precisiones:**

- El promedio de tickets utiliza el conteo distinto **dentro de cada mes**; un mismo ticket que apareciera en meses distintos podría contabilizarse una vez por cada mes. Por ello, la suma mensual no debe sustituir al `COUNT(DISTINCT Ticket_ID)` global.
- Si no hay meses con datos, ambos promedios son `0` y no se realiza una división entre cero.
- Las horas y promedios se presentan con dos decimales, según la precisión de salida definida en el backend/frontend.
- Si se selecciona un solo período con registros, su promedio mensual coincide con el total de ese mes.
- Los conteos de tickets, proyectos y resolutores nunca se calculan sumando filas de las tablas paginadas.

## 7. Contrato de API

**Endpoint existente ampliado:** `GET /tickets-report-times/kpis`.

Ejemplo real reportado con `grupo_resolutor=BASE DE DATOS Y EBS` y `todos_proyectos=false`:

```json
{
  "total_tickets": 150,
  "total_proyectos": 8,
  "horas_totales": 502.53,
  "total_resolutores": 16,
  "promedio_horas": 50.25,
  "promedio_tickets": 15,
  "alta_criticidad": 0,
  "porcentaje_alta_criticidad": 0
}
```

Este ejemplo corresponde a la **primera ampliación del KPI**, antes de que la mejora de precisión temporal añadiera `segundos_totales` y `promedio_segundos` al contrato.

## 8. Componentes afectados

| Capa | Archivo / componente | Responsabilidad |
|---|---|---|
| Backend · repositorio | `Gestión_tickets/app/repositories/tickets_report_times_repository.py` | Agregaciones de totales y agrupación mensual para los denominadores |
| Backend · servicio | `Gestión_tickets/app/services/tickets_report_times_service.py` | Cálculo de los promedios, redondeo y control de valores vacíos |
| Backend · schema | `Gestión_tickets/app/schemas/tickets_report_times_schema.py` | Contrato `TicketsReportTimesKPIOut` |
| Frontend · modelo | `fronted-tickets/src/app/models/tickets-report-times.ts` | Interfaz `TicketsReportTimesKPI` |
| Frontend · padre | `fronted-tickets/src/app/components/pages/tickets-report-times/tickets-report-times.ts` y `.html` | Carga y presentación de las seis tarjetas |
| Frontend · estilos | `fronted-tickets/src/app/components/pages/tickets-report-times/tickets-report-times.css` | Grid responsive de tarjetas |
| Frontend · PNG | `fronted-tickets/src/app/components/charts/Consolidated/tickets-report-times-report/` | Inclusión de seis KPIs en el reporte y fixtures compatibles |

**Sin cambios requeridos en la ruta HTTP ni en el servicio Angular:** se aprovecha el método existente `obtenerKpis()`.

## 9. Criterios de aceptación

- **CA-01:** El endpoint devuelve seis valores funcionales sin depender de otros endpoints para horas y resolutores.
- **CA-02:** Ante el ejemplo reportado, muestra 150 tickets, 502,53 horas, ocho proyectos, 16 resolutores, 50,25 horas/mes y 15 tickets/mes.
- **CA-03:** Al cambiar `desde`, `hasta`, `grupo_resolutor`, `periodo` o proyecto, todos los KPIs se recalculan con los mismos filtros.
- **CA-04:** Con cero registros, responde conteos y promedios en cero sin errores de división.
- **CA-05:** En escritorio se muestran seis tarjetas en una grilla de 3 × 2; en tamaños menores se conservan la legibilidad y el diseño responsive.
- **CA-06:** El reporte PNG incorpora los mismos seis KPI correspondientes al snapshot filtrado.
- **CA-07:** Los tests y fixtures tipados contienen todas las propiedades obligatorias de `TicketsReportTimesKPI`.

## 10. Pruebas y validaciones sugeridas

1. Contrastar resultados de `/tickets-report-times/kpis` con consultas SQL de `COUNT(DISTINCT Ticket_ID)`, `SUM(Horas)` y `COUNT(DISTINCT Nombre_Resolutor)`.
2. Comprobar rango completo, un mes seleccionado, ausencia de datos y proyectos por defecto frente a `todos_proyectos=true`.
3. Revisar que `promedio_horas × meses_con_datos` y `promedio_tickets × meses_con_datos` coincidan con sus agregados correspondientes dentro de las tolerancias de redondeo.
4. Ejecutar `npm run build` y las pruebas Angular disponibles; verificar manualmente las seis tarjetas y el PNG.

## 11. Estado y decisiones

- **Implementación:** reportada como completada.
- **Validación conocida:** el usuario confirmó que el endpoint devuelve los totales y promedios mostrados en el ejemplo.
- **Validación pendiente de evidencia:** compilación y suite de pruebas integrales; no se documentan como ejecutadas.
- **Evolución posterior:** `04_visualizacion_tiempos_minutos_horas_PRD.md` incorpora segundos para la presentación precisa de los tiempos sin cambiar las fórmulas anteriores.
