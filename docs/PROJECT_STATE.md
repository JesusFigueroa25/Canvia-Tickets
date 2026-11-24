# Estado del proyecto

## Cómo leer este documento

Este inventario refleja archivos, rutas y dependencias presentes en el repositorio. No implica que cada función esté desplegada, tenga datos productivos o haya sido validada en ejecución. No se ejecutaron la aplicación, las pruebas ni conexiones a bases de datos durante esta revisión.

## Funcionalidades identificadas en el código

| Área | Evidencia comprobable | Límite de lo comprobado |
|---|---|---|
| Navegación y acceso | Angular declara páginas/rutas para portada, login y panel. Backend incluye `POST /auth/login`. | No se verificó el comportamiento en navegador ni el nivel de protección de las demás rutas. |
| Panel y reportes | El frontend incluye home, componentes de KPI y gráficos. Backend ofrece `/home/resumen` y `/daily-report` con filtros, resumen, KPI, serie diaria y proyectos. | Datos disponibles, exactitud de indicadores y aceptación funcional deben confirmarse con usuarios. |
| SLA | Vistas de SLA de incidentes y requerimientos; routers `/incident-sla` y `/requirement-sla` con importación, filtros, KPI, tendencias, desgloses y tickets. | No se validaron archivos reales, reglas de cálculo, resultados ni tablas productivas. |
| Datos consolidados | Vistas para incidentes, requerimientos y tareas; routers `/incident-consolidated`, `/requirement-consolidated` y `/task-consolidated` incluyen importaciones, filtros, métricas y consultas de tickets. | No se confirmó si todos los datos o rutas están habilitados en cada entorno. |
| Productividad y cambios manuales | La vista consolidada de requerimientos tiene componentes de productividad, atención paralela y actualizaciones manuales. Backend incluye endpoints de productividad/atención/actualizaciones y un router de importación manual. | Reglas de negocio, fuentes y reconciliación de cambios necesitan validación. |
| Categorización | Existe una página de auditoría y gráficos asociados. El backend define corridas, resúmenes, tickets, resolutores, categorías y grupos de auditoría. Hay preprocesamiento y motor semántico con sentence-transformers. | No se evaluaron precisión, umbrales, modelo descargado, rendimiento ni aprobación de categorías sugeridas. |
| Análisis de causas | Angular registra `incident-cause-analysis`; backend de incidentes consolidados expone análisis, hallazgos y generación de análisis ejecutivo IA. | No se validó el resultado analítico ni la disponibilidad del servicio IA. |
| Chat analítico IA | Página y componentes de chat; API para enviar mensajes, listar/obtener conversaciones e historial. Hay servicios de contexto, consulta, herramientas y chat. | No se probó la conexión con proveedor IA, controles de consulta, persistencia, límites ni calidad de respuestas. |
| ETL de prueba SQLite | `/etl-test/upload/{tipo}` procesa tipos SLA/consolidados y guarda tablas SQLite reemplazándolas; `/etl-test/data/{tipo}` consulta sus datos. | Está separado de las cargas SQL Server y no debe confundirse con ETL productivo. No se ejecutaron cargas. |

## Reporte PNG de Auditoría de Categorización

Implementado el botón «Descargar Reporte PNG» y un reporte agregado de siete secciones. Reutiliza las cuatro consultas agregadas del padre y respeta los filtros efectivos, sin cargar tickets adicionales ni modificar backend. La descarga espera respuestas correctas, coherencia de conteos y confirmación de renderizado; es independiente del explorador de tickets. El cuadro mensual incluye todos los registros; la sección 07 muestra el mismo Top 10 del gráfico por incorrectas, con «Subtotal Top 10». Los KPIs y totales generales conservan el conjunto completo y la tabla del dashboard no cambia.

El 18/11/2026 se ejecutaron compilación Angular, pruebas unitarias y una descarga real en Edge con datos ficticios locales. No se validó contra SQL Server ni datos productivos. Consultar [arquitectura y límites](ARCHITECTURE.md#reporte-png-de-auditoría-de-categorización) y [resultados de pruebas](TEST_PLAN.md#reporte-png-de-auditoría-de-categorización). Se preservó la declaración local preexistente del componente en `AppModule`; no se añadieron dependencias.

## Reporte PNG de Tiempos de Informes Mensuales

Implementado en la página `tickets-report-times`: botón «Descargar PNG», seis secciones, rankings Top 10 y matrices completas. Reutiliza las seis respuestas iniciales y carga solo las páginas faltantes del detalle mediante los endpoints existentes; no añade dependencias ni cambios backend. Conserva el componente y la declaración local preexistentes, los filtros globales y dinámicos y las vistas del dashboard.

La exportación requiere respuestas válidas, tablas completas y renderizado confirmado. Utiliza snapshots y versiones, permite reintentar páginas fallidas y descargas, descarta capturas obsoletas y rechaza imágenes excesivas sin recortar filas. Los filtros locales no se exportan. La paginación visual posterior es independiente del reporte preparado.

La validación del 18/11/2026 incluye pruebas Angular, compilación y descarga real en Edge con datos ficticios locales. No acredita resultados de negocio ni funcionamiento contra SQL Server. Consultar [arquitectura y límites](ARCHITECTURE.md#reporte-png-de-tiempos-de-informes-mensuales) y [evidencia de pruebas](TEST_PLAN.md#reporte-png-de-tiempos-de-informes-mensuales). Persisten diferencias documentales del alcance original: la consulta actual no restringe `Ticket_type` a `Service Request` y la selección de proyectos afecta también al KPI y al volumen. Estas reglas no se modificaron.

## Reporte PNG R02 de Incidentes Consolidados

Implementado «Reporte 2» en Empresa: análisis general por proyecto con filtros globales efectivos y exclusiones, sin selección individual ni otros filtros dinámicos. Incluye tres KPI, Top 10 con barras verticales agrupadas, dona Top 5 + Otros sobre la distribución completa, tendencia y textos ejecutivos generados mediante reglas. Reutiliza la arquitectura y presentación de R01 sin modificar sus archivos; no cambia backend ni dependencias. El módulo contempla exactamente cuatro reportes; los estados de R03 y R04 se detallan a continuación.

El 24/11/2026 se aprobaron 71 pruebas relacionadas R01/R02 y la compilación Angular. Se descargaron PNG reales en Edge con datos ficticios, incluyendo nombres largos, un proyecto y rangos extensos; se verificó también la regresión de R01. No se consultó SQL Server ni se validaron datos productivos. Detalles y límites en la [arquitectura](ARCHITECTURE.md#reporte-png-r02-de-incidentes-consolidados) y la [evidencia de pruebas](TEST_PLAN.md#reporte-png-r02-de-incidentes-consolidados).

## Reporte PNG R03 de Incidentes Consolidados

Implementado «Reporte 3» junto a R02 en Empresa, habilitado por `proyectoSeleccionado` y fechas efectivas válidas. Consulta KPI y ranking filtrados por el proyecto, valida los totales y prepara su propia instantánea. Muestra tres KPI, un único gráfico mensual completo y tres hallazgos/conclusión/tres recomendaciones en composición horizontal 62/38. Conserva nombres íntegros y bloquea rangos ilegibles sin recortar. No modifica R01/R02, backend ni dependencias.

El 24/11/2026 se aprobaron las **42 pruebas nuevas R03** y la compilación Angular. El conjunto relacionado registró **113 aprobadas y un fallo previo de R02**, comprobado también antes de R03. Edge descargó PNG ficticios de uno a cuarenta meses, nombres extensos y extremos parciales, y bloqueó sesenta meses y denominadores incoherentes. No se consultaron bases de datos ni se validó información productiva. Consultar [arquitectura](ARCHITECTURE.md#reporte-png-r03-de-incidentes-consolidados) y [pruebas](TEST_PLAN.md#reporte-png-r03-de-incidentes-consolidados).

## Reporte PNG R04 de Incidentes Consolidados

Implementado «Reporte 4» en Alertas, general o del proyecto seleccionado, con filtros globales efectivos y exclusiones compatibles. Reutiliza exclusivamente `obtenerIncidentesPorcentajes(filtros, 5)`, preserva el ranking original y valida subtotal, denominador y porcentajes. Incluye tres KPI, barras horizontales, dona agregada Top 5/Otros, tres hallazgos, una conclusión y tres recomendaciones mediante funciones puras, sin GPT ni causas inferidas. Conserva nombres completos y estados de exportación propios, sin alterar R01–R03, backend o dependencias.

El 24/11/2026 se aprobaron **42 pruebas nuevas de R04**; el conjunto R01–R04 registró **158 aprobadas y el único fallo previo de R02**. La compilación Angular y las descargas PNG locales de ambos modos se validaron con datos ficticios, sin consultar bases de datos. El módulo completa sus cuatro reportes. Detalles, evidencias y límites en la [arquitectura](ARCHITECTURE.md#reporte-png-r04-de-incidentes-consolidados) y el [plan de pruebas](TEST_PLAN.md#reporte-png-r04-de-incidentes-consolidados).

## Tecnologías declaradas

- Frontend: Angular `^22.2.x`, TypeScript `~6.0.2`, RxJS `~7.8.0`, Angular Material, Chart.js y `ng2-charts`. `package-lock.json` registra resoluciones; `package.json` no declara una versión de Node.
- Backend: FastAPI, Uvicorn, SQLAlchemy, Pydantic, pandas, openpyxl, `pyodbc`, `python-jose`, OpenAI, numpy y sentence-transformers. La mayoría de las dependencias Python no tiene versión fijada en `requirements.txt`.
- El Dockerfile usa Python `3.11-slim`, instala `requirements.txt` y arranca Uvicorn en puerto 8080.
- Persistencia: SQL Server mediante ODBC Driver 18 para la mayoría de los controladores; SQLite en `assets/tickets_test.db` para el ETL de prueba.

## Estado de calidad y operación

### Comprobado en el árbol de archivos

- Hay pruebas frontend bajo `src/app` y un script de test configurado como `ng test` con el builder Angular de pruebas.
- `Gestión_tickets/test/` contiene pruebas de análisis IA y otros scripts de pruebas/validación de chat, consultas SQL Server y categorización.
- El frontend configura un proxy local hacia `127.0.0.1:8080`; CORS backend permite `http://localhost:4200`.
- Hay un Dockerfile para backend; no se encontró en el conjunto revisado un proceso documentado para construir/publicar el frontend o promover despliegues.

### No comprobado

- Instalación limpia, compilación Angular, ejecución FastAPI y resultado de cualquier prueba.
- Conectividad, disponibilidad, esquema y datos de SQL Server o SQLite.
- Estado de despliegue, usuarios reales, telemetría, rendimiento, respaldo y recuperación.
- Alcance efectivo de autenticación/autorización: el login crea un JWT, pero la revisión de routers no acreditó protección transversal de los endpoints.
- Aceptación del producto, prioridades, responsables, incidentes abiertos y calendario de releases.

## Pendientes de validación técnica

1. **Modelo `ImportRun`:** está declarado sobre la `Base` SQLite y es usado por el servicio de importación de tareas que recibe una sesión SQL Server. Confirmar con DDL/DBA el destino real de `import_run`, sus columnas y el ciclo de vida esperado.
2. **Seguridad de SQL Server:** el código configura `Encrypt=no` y `TrustServerCertificate=yes`; confirmar con infraestructura la configuración que corresponde a cada entorno.
3. **Autenticación:** verificar almacenamiento/validación de contraseñas, dependencias JWT y protección de rutas. No asumir que emitir un token significa que el resto de la API lo exige.
4. **Entornos:** documentar variables requeridas y valores no sensibles en un ejemplo seguro, sin publicar credenciales; verificar versiones Python/Node y ODBC para desarrollo/producción.
5. **Contrato y esquema:** cotejar rutas y schemas con consumidores Angular y contrastar modelos SQLAlchemy con el esquema físico. Estos detalles pertenecen a `API_CONTRACT.md` y `DB_SCHEMA.md`.
6. **Pruebas:** establecer cómo se ejecutan pruebas con dependencias externas y qué cobertura crítica se exige. Los archivos de prueba existentes no demuestran por sí solos que el conjunto pase.

## Próxima actualización

Actualizar este documento cuando se comprueben cambios funcionales, despliegues o decisiones de estado. Mantener los procedimientos de ejecución en `README.md`, la descripción de componentes en `ARCHITECTURE.md` y los contratos/esquemas detallados en sus documentos técnicos.
