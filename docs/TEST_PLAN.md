# Plan de pruebas

## Alcance y estado de evidencia

Este plan describe archivos y aserciones inspeccionados en `Gestión_tickets/test/` y los comandos que pueden ejecutarlos. No se ejecutó ninguna prueba en esta tarea; por tanto, no hay resultados, tasas de cobertura ni estado de aprobación que reportar. No se encontró configuración propia de pytest (`pytest.ini`, `pyproject.toml`, `setup.cfg` o `tox.ini`) en el backend.

## Pruebas automatizadas principales

Los tres archivos `test_incident_analysis_ai*.py` bajo `Gestión_tickets/test/` usan pytest. El primer comando es el utilizado por el equipo. Ejecutar desde `Gestión_tickets/`:

```powershell
py -m pytest test\test_incident_analysis_ai_decision.py test\test_incident_analysis_ai_cross.py -v
```

El comando anterior **no incluye** `test_incident_analysis_ai.py`. Para ejecutar esa suite aislada:

```powershell
py -m pytest test\test_incident_analysis_ai.py -v
```

Para que pytest descubra todos los archivos con patrón `test_*.py` bajo `test/`, incluidos los de `test/Otros/`:

```powershell
py -m pytest test -v
```

La última orden es un comando de descubrimiento coherente con los nombres de archivo; no se verificó que toda la colección sea ejecutable en un entorno común ni que no requiera configuración adicional.

| Archivo | Tipo/evidencia de integración | Qué comprueba el código de prueba |
|---|---|---|
| `test/test_incident_analysis_ai_decision.py` | Unitarias con pytest; sustituye la llamada al modelo; docstring declara sin OpenAI ni SQL Server. | Catálogo de hallazgos; comparación de periodos completos; exclusión de identificadores privados del contexto; rechazo de cifras/evidencias inventadas; conservación del schema Angular; fallback operativo, reintento y ensamblado de narrativa. |
| `test/test_incident_analysis_ai_cross.py` | Unitarias con pytest y mocks; docstring declara sin SQL Server ni OpenAI. | Conteo único de tickets y menciones; cobertura de muestra; cruces y denominadores; redacción de menciones como evidencia no como acción verificada; no exposición de datos sensibles; filtros y compilación de consultas en dialecto SQL Server; compatibilidad de narrativa con el contrato. |
| `test/test_incident_analysis_ai.py` | Unitarias con pytest; carga aislada del módulo y sustituye dependencias; docstring declara sin SQL Server ni consumo de tokens. | Filtrado de fechas/proyecto, referencias y cifras permitidas, ausencia de texto de tickets en el contexto, fallback cuando faltan credenciales o falla OpenAI, diagnóstico seguro y parámetros de respuesta del modelo. |

### Pruebas unitarias complementarias de `test/Otros/`

Estos archivos llevan prefijo `test_` y contienen clases `unittest.TestCase`/`TestCase`, por lo que pytest puede descubrirlos. Sus objetivos se identifican por las clases, imports y casos presentes; la ejecución conjunta no se ha comprobado.

| Archivo | Área que cubre |
|---|---|
| `Otros/test_tool_service.py` | Registro de herramientas analíticas, validación de fuente/herramienta, filtros incompatibles y fechas. |
| `Otros/test_requirement_categorization_audit.py` | Reglas de auditoría, schemas, repositorio, servicio y controlador, con dependencias simuladas. |
| `Otros/test_query_service.py` | Validación y planificación de consultas analíticas, filtros y límites. |
| `Otros/test_context_service.py` | Composición y actualización del contexto conversacional. |
| `Otros/test_chat_service.py` | Interpretación de preguntas y comportamiento de chat mediante un cliente OpenAI simulado. |
| `Otros/test_chat_router.py` | Enrutamiento de solicitudes del chat a herramientas/consultas y tratamiento de planes. |
| `Otros/test_chat_redaccion.py` | Redacción/formato de respuestas del chat y fallback ante errores de OpenAI. |
| `Otros/test_chat_patch_temporal.py` | Cambios/patches temporales del contexto del chat y sus validaciones. |
| `Otros/test_chat_orquestacion.py` | Orquestación de interpretación, consulta, redacción, persistencia y rollback usando dobles de prueba. |
| `Otros/test_categorization_engine.py` | Reglas y decisiones del motor de categorización con datos sintéticos. |
| `Otros/test_ai_chat_api.py` | Contrato y rutas de chat a través de `TestClient` con resultados y persistencia simulados. |

## Validaciones de integración y manuales

### API de análisis ejecutivo

`test/prueba_analisis_incidentes_ia_api.py` no es una prueba unitaria: llama a una instancia FastAPI real. Exige `--confirm-live`; sin esa opción termina con error de argumento. Desde `Gestión_tickets/`, una ejecución local puede adoptar esta forma (ajustar solo la URL al entorno autorizado):

```powershell
py .\test\prueba_analisis_incidentes_ia_api.py --base-url http://127.0.0.1:8080/incident-consolidated --confirm-live
```

La URL por defecto del script es `http://127.0.0.1:8000/incident-consolidated`, que no coincide con el puerto 8080 declarado por el Dockerfile y la guía local; usar `--base-url` o `CANVIA_API_BASE` para indicar el destino correcto. El script puede enviar `Authorization: Bearer ...` si está presente `CANVIA_TEST_TOKEN`, sin requerir que se incluya su valor en la documentación.

La validación consulta KPI, causas, atribución y distribución ajustada, y luego ejecuta el POST de análisis ejecutivo. Comprueba consistencia de totales/denominadores, conteo de causas, atribuciones, ajustes pendientes, unicidad de códigos y referencias de conclusiones. `--require-ia` falla si el origen no es IA; `--require-cross` exige evidencia de cruces/patrones. La propia prueba advierte que el POST puede consumir tokens si el servidor tiene OpenAI configurado. No usar contra producción sin autorización y presupuesto aprobados.

**Aprobación esperada, no resultado observado:** código de salida 0 y mensaje `OK: denominadores, conteos y referencias consistentes.`; si se solicitaron `--require-ia` o `--require-cross`, también debe cumplirse esa condición.

### SQL de solo lectura

`test/validar_filtros_analisis_ia.sql` contiene consultas `SELECT` para contrastar conteos/atribuciones con filtros y límites de fecha. No modifica datos según el contenido inspeccionado. Requiere escoger explícitamente una conexión/base de pruebas y comparar el resultado con la respuesta API; no se ejecutó ni se validó su conexión.

### Scripts manuales y pruebas contra dependencias reales

`test/Otros/` también contiene scripts `prueba_*.py` de consulta con SQL Server, chat con OpenAI, herramientas, categorización semántica y escrituras de evaluación. No siguen el patrón `test_*.py` de descubrimiento por defecto. Algunos declaran o evidencian consumo de proveedor, requieren conexión o pueden escribir; revisar el archivo y el destino antes de ejecutarlos. Ejemplos identificables por nombre: `prueba_chat_router_sqlserver.py`, `prueba_chat_redaccion_sqlserver.py`, `prueba_chat_orquestacion_sqlserver.py`, `prueba_tools_sqlserver.py`, `prueba_ai_chat_api_sqlserver.py`, `prueba_requirement_categorization_sqlserver.py` y `prueba_gpt4_conexion.py`.

Los scripts de registro/experimentos CSV dentro de `Otros/` son material de evaluación manual, no resultados automatizados de CI. El nombre de un archivo no demuestra que haya sido ejecutado ni que su resultado siga vigente.

## Criterios de aprobación

1. Para pytest: proceso finaliza con código 0, sin errores ni tests fallidos. El resumen debe indicar cuántos tests fueron descubiertos; un resultado con 0 tests no cuenta como aprobación.
2. Para la validación HTTP: se cumplen las aserciones de conteos, sumas, códigos y referencias descritas arriba. Usar flags de exigencia solo cuando el entorno esté configurado para satisfacerlos.
3. Para SQL: los agregados de la consulta de solo lectura concuerdan con el endpoint usando los mismos filtros y límites temporales.
4. Registrar destino/commit, entorno, versión de Python y configuración no sensible cuando se publiquen resultados. No guardar tokens ni valores de variables de entorno en evidencias.

No se especifican umbrales de cobertura porque no hay cobertura reportada ni objetivo configurado revisado.

## Pruebas adicionales propuestas

### Validaciones de Incidentes Consolidados

Desde `fronted-tickets/`, ejecutar `npm test -- --watch=false` y `npm run build`.
Los nuevos specs de `volume-month` y `Consolidated/category-distribution` cubren:

- Título según las barras visibles, selección y limpieza del mes sin reducir el rango mostrado, un solo mes, respuesta vacía y períodos que cruzan años.
- Orden optativo Critical, High, Medium, Low con prefijos y etiquetas originales; desconocidas al final, cantidades y colores conservados y orden por volumen para consumidores que no activan la opción.

Resultado de ejecución del 18/11/2026: las cinco pruebas nuevas pasan. La suite completa registra siete pruebas aprobadas y dos fallidas en specs existentes: `App` no reconoce `app-landing` y `Login` carece de proveedor de `ActivatedRoute`. La compilación termina con código 0 al disponer de acceso a Google Fonts; advierte excesos de presupuesto del bundle inicial y de estilos. No se realizó validación visual en navegador.

Validación manual pendiente: aplicar y limpiar filtros, seleccionar/desmarcar una barra mensual, comprobar el estado vacío, tooltips y pantalla completa; confirmar que requerimientos, tareas y SLA conservan sus títulos y órdenes actuales. El gráfico de distribución por prioridad solo presenta cantidades en su contrato actual; el gráfico mensual apilado con porcentajes no se modifica.

Estas pruebas son propuestas, no funcionalidades ya presentes:

- Pruebas de contrato para todas las rutas FastAPI y comparación automática con los modelos TypeScript/consumidores Angular.
- Pruebas de integración SQL Server aisladas con esquema/datos efímeros para repositorios, transacciones e importaciones; excluir credenciales y bases productivas.
- Pruebas API de importación para archivos válidos, inválidos, vacíos, duplicados y límites de tamaño/formato.
- Pruebas de autenticación que verifiquen hashing de contraseñas, vencimiento JWT y autorización endpoint por endpoint.
- Pruebas para límites/rate-limit, timeout y fallback de OpenAI usando cliente simulado; reservar una prueba externa real controlada y separada.
- Smoke tests de frontend para rutas, carga/error/vacío, filtros, tablas responsivas y accesibilidad.
- Integrar en CI las pruebas unitarias deterministas; mantener las que requieren red, SQL Server o tokens en una etapa manual/aislada.
