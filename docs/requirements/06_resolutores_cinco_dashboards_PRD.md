# PRD 06 — Implementación de Resolutores en cinco dashboards

**Proyecto:** CANVIA — Gestión de Tickets  
**Tipo:** Nueva funcionalidad y reutilización de componentes  
**Estado:** Pendiente de implementación  
**Fecha:** 24/11/2026

## 1. Contexto

Actualmente, el dashboard de Incidentes Consolidados cuenta con una sección denominada "Resolutor", conformada por dos componentes:

- **Rendimiento por Resolutor:** tabla de distribución mensual de tickets por resolutor.
- **Número de Tickets por Resolutor:** gráfico de barras con ranking de resolutores y desglose mensual.

Se requiere extender estas funcionalidades a cinco dashboards adicionales, manteniendo la arquitectura existente y reutilizando los componentes Angular.

## 2. Objetivo

Incorporar una sección independiente denominada **Resolutor** en cinco dashboards, permitiendo analizar el volumen mensual de tickets atendidos por cada resolutor, con filtros dinámicos, paginación y rankings.

## 3. Dashboards involucrados

| Dashboard | Componente Angular |
|---|---|
| Incidentes SLA | `app-incident-sla` |
| Requerimientos SLA | `app-requirement-sla` |
| Requerimientos Consolidados | `app-requirement-consolidated` |
| Tareas Consolidadas | `app-task-consolidated` |
| Cambios Consolidados | `app-change-consolidated` |

Incidentes Consolidados funcionará como módulo de referencia y debe conservar su comportamiento actual.

## 4. Alcance backend

Implementar dos endpoints GET nuevos en cada uno de los cinco módulos, utilizando el prefijo de router correspondiente.

### 4.1. Rendimiento por Resolutor

**Ruta:** `/rendimiento-resolutores`

Parámetros:

- `pagina`: entero positivo, valor predeterminado 1.
- `tamano`: entero entre 1 y 100, valor predeterminado 20.
- Filtros existentes del dashboard correspondiente.

Respuesta compatible con el contrato actual:

- `periodos`
- `resolutores`
- `totales_mensuales`
- `total_general`
- `total_resolutores`
- `pagina`
- `tamano`
- `total_paginas`

Cada resolutor incluirá su nombre, total de tickets y distribución mensual.

### 4.2. Número de Tickets por Resolutor

**Ruta:** `/tickets-por-resolutor`

Parámetros:

- `tamano`: entero entre 1 y 20, valor predeterminado 5.
- Filtros existentes del dashboard correspondiente.

Respuesta compatible con el contrato actual:

- `total_general`
- `limite`
- `periodos`
- `resolutores`

El gráfico permitirá mostrar los primeros 5, 10, 15 o 20 resolutores.

### 4.3. Arquitectura

Implementar los endpoints respetando las capas existentes:

1. Repository: consultas y agregaciones SQLAlchemy.
2. Service: consolidación de períodos, ranking, totales y paginación.
3. Controller: endpoints FastAPI y validación de parámetros.
4. Schema: contratos Pydantic para respuestas y filtros.

Se evaluará reutilizar funciones auxiliares comunes cuando no existan diferencias de negocio entre módulos.

## 5. Reglas de negocio

**RN01.** Contabilizar los tickets propios de cada módulo, sin mezclar fuentes de otros dashboards.

**RN02.** Agrupar por resolutor y período mensual, utilizando el campo de fecha vigente en cada módulo.

**RN03.** Ordenar resolutores por total de tickets descendente y, ante empates, por nombre ascendente.

**RN04.** Aplicar todos los filtros globales y dinámicos compatibles con el dashboard correspondiente.

**RN05.** Normalizar nombres nulos o vacíos siguiendo el comportamiento de referencia: `Sin especificar`.

**RN06.** Mantener la paginación de la tabla y el límite de resolutores del gráfico.

**RN07.** Devolver cero o listas vacías cuando no existan registros, evitando errores de procesamiento.

**RN08.** Mantener la consistencia entre los totales mensuales, totales por resolutor y total general.

**RN09.** Evitar duplicación de tickets por relaciones entre registros, utilizando la clave única y granularidad correspondiente a cada módulo.

**RN10.** Conservar los cálculos existentes de cumplimiento SLA, criticidad, indicadores y productividad, sin alterarlos.

**Pendiente de validación:** identificar en cada backend el campo de fecha, la clave del ticket o tarea, el campo de resolutor y las reglas de filtrado específicas.

## 6. Alcance frontend

### 6.1. Models y services

Actualizar los modelos TypeScript y servicios HTTP de los cinco dashboards para incorporar:

- Las interfaces de respuesta de ambos endpoints.
- Los métodos HTTP correspondientes.
- Los parámetros de filtros, paginación y límite.

Generalizar los contratos compartidos de los componentes hijos cuando sea necesario, conservando compatibilidad con Incidentes Consolidados.

### 6.2. Componentes reutilizables

Reutilizar:

- `app-resolutor-performance-table`
- `app-resolver-monthly-tickets`

Mantener sus funcionalidades actuales: filtro por resolutor, paginación, selector Top N, tooltips, datalabels y presentación mensual.

Adaptar las descripciones para que no hagan referencia exclusivamente a incidentes.

No crear cinco copias de cada componente.

### 6.3. Componentes padre

En cada dashboard:

1. Agregar una nueva sección visual titulada **Resolutor**.
2. Incorporar la navegación interna hacia la sección, cuando corresponda.
3. Integrar la tabla y el gráfico reutilizables.
4. Implementar la carga HTTP, estados de carga y manejo de errores.
5. Conectar la sección con los filtros existentes.
6. Implementar los eventos de selección, paginación y cambio de límite.
7. Mantener el comportamiento de pantalla completa compatible con cada dashboard.
8. Conservar el diseño responsive de CANVIA.

## 7. Diseño visual

Mantener la identidad gráfica de CANVIA:

- Naranja: `#FF620F`
- Verde: `#16835B`
- Fondo: `#F7F9FB`
- Blanco: `#FFFFFF`
- Texto: `#101828`
- Bordes: `#E5E9EE`

La sección contendrá primero la tabla "Rendimiento por Resolutor" y posteriormente el gráfico "Número de Tickets por Resolutor", siguiendo el diseño de Incidentes Consolidados.

## 8. Plan de implementación

### Fase 0 — Análisis y definición

- Revisar backend y frontend de Incidentes Consolidados.
- Identificar contratos y comportamientos reutilizables.
- Revisar la estructura del proyecto.
- Elaborar el presente PRD.

### Fase 1 — Backend

- Revisar los cinco backends.
- Identificar modelos, filtros y reglas de negocio.
- Implementar dos endpoints por módulo.
- Actualizar repositories, services, controllers y schemas.
- Validar respuestas y conteos con pruebas.

### Fase 2 — Models y services Angular

- Incorporar interfaces TypeScript compatibles.
- Incorporar métodos HTTP.
- Validar parámetros y contratos de respuesta.

### Fase 3 — Reutilización de componentes hijos

- Desacoplar interfaces específicas de incidentes.
- Adaptar textos descriptivos.
- Mantener la configuración visual y funcional existente.

### Fase 4 — Integración en componentes padre

- Integrar la sección Resolutor en los cinco dashboards.
- Conectar filtros globales y dinámicos.
- Integrar eventos de tabla y gráfico.
- Ajustar HTML y CSS.
- Validar navegación, carga, errores y comportamiento responsive.

## 9. Criterios de aceptación

- [ ] Los cinco dashboards muestran la sección Resolutor.
- [ ] Los diez endpoints responden correctamente.
- [ ] Cada endpoint respeta los filtros de su módulo.
- [ ] Las tablas muestran el total de tickets por resolutor y mes.
- [ ] Los gráficos muestran correctamente el Top 5, 10, 15 y 20.
- [ ] La paginación funciona correctamente.
- [ ] La selección de resolutor actualiza los datos correspondientes.
- [ ] Los totales coinciden con consultas SQL de validación.
- [ ] Los datos nulos y estados sin resultados se gestionan correctamente.
- [ ] No aparecen duplicados por errores de agregación.
- [ ] Los componentes originales continúan funcionando.
- [ ] No se modifican las reglas de negocio existentes.
- [ ] El frontend compila y las pruebas correspondientes finalizan correctamente.

## 10. Decisiones pendientes

Se resolverán durante la revisión de los cinco backends:

- Campo de fecha para la distribución mensual de cada módulo.
- Identificador único y granularidad de conteo, especialmente en Tareas Consolidadas.
- Disponibilidad del campo resolutor y de su catálogo de opciones.
- Filtros propios de SLA y otros módulos que deberán aplicarse.
- Posibilidad de compartir lógica de agregación entre repositorios y servicios sin alterar las reglas existentes.

## 11. Control de versiones

**Rama Git:** `feat/resolutores-cinco-dashboards`

**Commit final recomendado:**

`feat: agregar sección de resolutores en cinco dashboards`