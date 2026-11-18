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
