# PRD 04 — Visualización dinámica del tiempo: minutos y horas

| Campo | Detalle |
|---|---|
| Identificador | CANVIA-PRD-04 |
| Módulo | Análisis de Tiempos de Informes Mensuales |
| Estado | Implementado según cambios reportados; revisión visual integral pendiente de constatar |
| Fecha | 2026-11-19 |
| Tipo | Mejora de precisión y presentación de datos temporales |
| Dependencia | `03_kpis_promedio_horas_tickets_PRD.md` |

## 1. Resumen ejecutivo

Incorporar una **presentación automática de duraciones en minutos u horas** en los KPIs, tablas, gráficos y reporte PNG. Si el tiempo **acumulado de la celda, serie, mes o indicador es menor de una hora**, se muestra en minutos; a partir de una hora, se muestra en horas. Para duraciones menores de una hora se utilizarán los **segundos originales** registrados en SQL Server, evitando la pérdida de precisión que produce convertir las horas ya redondeadas.

## 2. Problema y justificación

Mostrar `0,74 h`, `0,78 h` o `0,01 h` exige que el usuario interprete fracciones decimales de hora. Además, las columnas `Horas` del origen pueden estar redondeadas por acción. Al disponer de `Segundos`, CANVIA puede mostrar la duración real de forma intuitiva, como `44,43 min`, y mantener los totales consolidados que ya emplea el sistema.

## 3. Objetivo y resultado esperado

- En tablas, etiquetas gráficas, tooltips y KPIs, mostrar **minutos para duraciones inferiores a 3.600 segundos** y **horas para duraciones de 3.600 segundos o más**.
- Acumular primero los segundos originales por agrupación antes de decidir la unidad.
- Preservar los campos numéricos de horas y las escalas de Chart.js para no alterar la altura de las barras, filtros o rankings existentes.
- Evitar divergencias de visualización entre dashboard y PNG mediante una función TypeScript reutilizable.

## 4. Regla de negocio y precisión

**Regla de presentación:**

```text
si segundos_acumulados < 3600:
    mostrar (segundos_acumulados / 60) + " min"
si segundos_acumulados >= 3600:
    mostrar horas_acumuladas_existentes + " h"
```

- Presentar **dos decimales** con formato local `es-PE`.
- La decisión de unidad se toma sobre el **tiempo total de la entidad visualizada** (celda por mes/proyecto o resolutor, total de fila, total visible, KPI, barra), nunca sobre cada acción por separado.
- Los segundos originales son la referencia para el umbral y el cálculo de minutos. Si `Segundos` es nulo en una acción, el backend utiliza `Horas × 3600` como respaldo.
- Para valores de una hora o más, el frontend puede conservar `SUM(Horas)` ya entregado, para mantener los totales históricos y el comportamiento de redondeo; no debe sustituirse silenciosamente por `SUM(Segundos)/3600`.
- La conversión afecta **solo la representación**; no cambia tickets distintos, cantidad de acciones, agrupaciones, filtros ni reglas SLA.
- Una duración nula o cero debe tratarse de forma consistente; no debe producir `NaN`, `Infinity` ni valores negativos en la interfaz.

### 4.1 Casos de referencia verificados

| Ticket | Acciones | Horas origen sumadas | Segundos sumados | Visualización requerida |
|---|---:|---:|---:|---|
| `100-271682` · SAN MIGUEL FRUIT | 1 | 0,74 h | 2.666 | **44,43 min** (`2666 / 60`) |
| `100-271005` · KOMATSU | 2 | 3,07 h | 11.017 | **3,07 h** (horas acumuladas existentes) |

**Aclaración de precisión:** `0,68 h × 60 = 40,80 min`; no equivale a `44,43 min`. Los `44,43 min` proceden de los 2.666 segundos originales. En KOMATSU, `SUM(Horas) = 3,07 h`, mientras que `11017 / 3600 ≈ 3,06 h`; esa diferencia por redondeos individuales es esperable y debe quedar documentada.

### 4.2 Validación SQL reportada

```sql
SELECT
    Ticket_ID,
    COUNT(*) AS total_acciones,
    SUM(Horas) AS horas_actuales,
    SUM(COALESCE(Segundos, Horas * 3600)) AS segundos_totales,
    ROUND(
        SUM(COALESCE(Segundos, Horas * 3600)) / 60.0,
        2
    ) AS minutos_calculados
FROM dbo.tickets_report_times
WHERE Ticket_ID IN ('100-271682', '100-271005')
  AND Categorizacion_Nivel_3 = 'Elaboracion Informe Mensual'
GROUP BY Ticket_ID;
```

Resultados comunicados:

```text
100-271005 | 2 | 3.0700 | 11017.0000 | 183.620000
100-271682 | 1 | 0.7400 | 2666.0000  | 44.430000
```

La consulta es de **solo lectura**. No requiere modificar la base de datos.

## 5. Alcance

### Incluye

- Ampliación de los resultados de agregación del backend para devolver segundos acumulados.
- KPIs: tiempo total y promedio mensual, con su precisión en segundos.
- Resumen Ejecutivo Mensual: etiquetas y tooltips de tiempos.
- Detalle por resolutor: gráfico, etiquetas de barra apilada, tooltips y tabla pivote.
- Detalle por proyecto: gráfico, resumen de ranking, etiquetas, tooltips y tabla pivote.
- Exportación PNG: seis KPIs, barras, matrices mensuales, totales por fila y total de período.
- Actualización de fixtures y validadores del reporte ante los nuevos campos.

### No incluye

- Crear, modificar o recalcular columnas SQL Server ni reimportar los datos.
- Convertir las unidades numéricas de las series de Chart.js; los ejes siguen expresados en horas.
- Cambiar el orden de rankings, el selector de métrica (`Horas`, `Acciones`, `Tickets`) o la definición de tickets únicos.
- Modificar la paginación, búsqueda, selección local, modo pantalla completa o filtros globales.

## 6. Contratos de API ampliados

Se amplían los endpoints existentes; **no se cambian rutas**:

| Endpoint | Campos de duración añadidos |
|---|---|
| `GET /tickets-report-times/kpis` | `segundos_totales`, `promedio_segundos` |
| `GET /tickets-report-times/volumen-mensual` | `segundos_totales` por mes |
| `GET /tickets-report-times/tiempos-resolutores` | `segundos_totales` en `resumen` y `items` |
| `GET /tickets-report-times/tiempos-proyectos` | `segundos_totales` en `resumen` y `items` |
| `GET /tickets-report-times/tiempos-resolutores-grafico` | `segundos_totales` por serie y `segundos` por punto mensual |
| `GET /tickets-report-times/tiempos-proyectos-grafico` | `segundos_totales` por serie y `segundos` por punto mensual |

Los campos preexistentes (`horas_totales`, `promedio_horas`, `horas`, `tickets`, `acciones`, etc.) permanecen disponibles. El filtro de categoría sigue siendo `Elaboracion Informe Mensual` y los períodos se basan en `Fecha_Creacion` del ticket.

## 7. Cambios de arquitectura

### Backend — FastAPI / SQLAlchemy / SQL Server

1. **Repositorio:** sumar `Segundos` a nivel de agregado mediante una expresión SQL equivalente a `SUM(COALESCE(Segundos, Horas * 3600))`.
2. **Servicio:** conservar los totales de horas, devolver segundos y calcular `promedio_segundos` con el mismo denominador `meses_con_datos` utilizado por `promedio_horas`.
3. **Schema:** ampliar las respuestas de KPIs, volumen, resumen, tablas y series con sus propiedades de segundos.
4. **Controlador / modelo / ETL:** sin cambios requeridos en rutas, tablas ni procesos de importación.

Archivos relevantes:

- `Gestión_tickets/app/repositories/tickets_report_times_repository.py`
- `Gestión_tickets/app/services/tickets_report_times_service.py`
- `Gestión_tickets/app/schemas/tickets_report_times_schema.py`

### Frontend — Angular / Chart.js

- `fronted-tickets/src/app/models/tickets-report-times.ts`: declarar campos nuevos en interfaces de respuesta.
- `fronted-tickets/src/app/utils/formatear-tiempo.ts`: reutilizar `formatearTiempo(segundos, horas?)` en todos los componentes.
- `fronted-tickets/src/app/components/pages/tickets-report-times/tickets-report-times.ts` y `.html`: aplicar el formateo a KPIs, etiquetas y tooltips del gráfico ejecutivo.
- `fronted-tickets/src/app/components/charts/Report-Times/report-times-resolver-chart/`: formatear etiquetas y tooltips del gráfico horizontal apilado conservando sus datos numéricos en horas.
- `fronted-tickets/src/app/components/charts/Report-Times/report-times-project-chart/`: formatear barras, tooltips y total del ranking.
- `fronted-tickets/src/app/components/charts/Report-Times/report-times-resolver-table/`: mantener horas y segundos acumulados en cada indicador mensual; visualizar con unidad dinámica.
- `fronted-tickets/src/app/components/charts/Report-Times/report-times-project-table/`: mismo tratamiento de segundos para celdas, fila y total visible.
- `fronted-tickets/src/app/components/charts/Consolidated/tickets-report-times-report/`: conservar horas y segundos en las matrices, formatear el PNG, validar agregados y actualizar fixtures.

## 8. Criterios de aceptación

- **CA-01:** Un agregado de 2.666 segundos aparece como `44,43 min` en cualquier representación temporal equivalente.
- **CA-02:** Un agregado de 11.017 segundos, con horas preexistentes acumuladas de 3,07, se muestra como `3,07 h`.
- **CA-03:** Las duraciones inferiores a 3.600 segundos muestran `min`; las iguales o superiores a 3.600 muestran `h`.
- **CA-04:** Antes de seleccionar la unidad, los segundos se suman por **proyecto/resolutor y mes**, así como por totales de filas y totales visibles.
- **CA-05:** Las dos tablas pivote muestran la nueva unidad para las celdas, el total por fila y el pie `TOTAL VISIBLE` cuando el indicador seleccionado es Horas.
- **CA-06:** Al elegir Acciones o Tickets en las tablas, se siguen mostrando enteros y funcionan búsqueda, ordenamiento y paginación.
- **CA-07:** Los gráficos mantienen sus escalas y ordenamientos, pero las etiquetas y los tooltips comunican minutos u horas correctamente.
- **CA-08:** Los KPIs, tablas y gráficos del PNG respetan las mismas reglas de visualización y el snapshot filtrado.
- **CA-09:** No se produce una nueva consulta HTTP por cada celda ni se recalculan duraciones a partir de horas redondeadas cuando los segundos están disponibles.
- **CA-10:** Los registros sin tiempo o los estados sin datos no causan errores de compilación ni visualización.

## 9. Pruebas y validaciones

1. **SQL:** confirmar los dos tickets de referencia con `SUM(Horas)` y `SUM(Segundos)`.
2. **API:** revisar que los seis endpoints con datos temporales devuelvan segundos junto a los campos anteriores, respetando filtros.
3. **Unidad del formateador:** `2666 → 44,43 min`, `(11017, 3.07) → 3,07 h`, `19 → 0,32 min`, `3600 → 1,00 h`.
4. **Tablas:** comprobar cambio de unidad mensual, total de fila y `TOTAL VISIBLE`; alternar a Acciones/Tickets, ordenar, buscar y paginar.
5. **Gráficos:** comprobar etiquetas y tooltips en resolutores/proyectos, incluidos los casos de un único mes, varias acciones por ticket y selección local.
6. **PNG:** comprobar coherencia con la pantalla y que no se alteran los datos originales al construir el snapshot.
7. **Compilación y tests:** ejecutar `npm run build` y `npx ng test --watch=false`; registrar resultados reales antes de cerrar la verificación.

## 10. Riesgos y consideraciones

- **Redondeos históricos:** sumar horas previamente redondeadas puede dar una cifra ligeramente distinta de `SUM(Segundos)/3600`. La mejora no cambia unilateralmente esa fórmula histórica.
- **Umbral:** una celda de varias acciones se evalúa por su duración acumulada, no por el tiempo aislado de cada acción.
- **Charts:** las etiquetas usan unidad dinámica, pero los ejes pueden seguir indicados en horas, lo cual debe ser explícito para evitar confusiones.
- **Paginación:** el total visible de las tablas corresponde a las filas visualizadas; no debe confundirse con el total global de la API.
- **Integridad:** las validaciones del PNG deben utilizar los segundos además de las horas, tolerando el redondeo numérico documentado.

## 11. Estado y trazabilidad

- **Backend:** el usuario verificó que los endpoints funcionan y contrastó con SQL los segundos de SAN MIGUEL FRUIT y KOMATSU.
- **Frontend:** se reportó el ajuste del Resumen Ejecutivo Mensual y se prepararon cambios para las cuatro visualizaciones restantes y el PNG; no se dispone aquí de evidencia de ejecución final de toda la suite.
- **Relación con PRD 03:** los promedios mensuales y los seis KPIs se mantienen; el presente PRD mejora únicamente la precisión y la forma de mostrar duraciones.
