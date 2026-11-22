# PRD 05 - Automatización de las pruebas del análisis ejecutivo de incidentes

| Campo | Detalle |
|---|---|
| Identificador | CANVIA-PRD-05 |
| Fecha | 2026-11-22 |
| Módulo | Backend FastAPI · Análisis ejecutivo de incidentes con IA |
| Estado | Mejora aprobada. Implementación y validación pendientes. |

## 1. Contexto y problema

La mejora 4 de la auditoría propone hacer reproducibles las validaciones. El [plan de pruebas](../TEST_PLAN.md) documenta un comando habitual que ejecuta las suites `decision` y `cross`. La suite [test_incident_analysis_ai.py](../../Gestión_tickets/test/test_incident_analysis_ai.py) se ejecuta mediante otro comando. Un cambio que permita incorporar cifras inventadas a una conclusión podría pasar la primera comprobación y fallar en la segunda.

La suite aislada contiene 13 funciones de prueba. Comprueba, entre otros casos, los filtros de fecha y proyecto, la conservación de cifras y referencias, la exclusión de textos de tickets del contexto y la respuesta de respaldo ante un fallo del proveedor. Usa datos de prueba, sustituye el servicio de incidentes y simula las respuestas del modelo. Al redactar este PRD, la rama carece de un workflow versionado que ejecute la suite. El conteo proviene de la inspección del archivo. La primera ejecución establecerá el resultado de referencia.

## 2. Objetivos

- Dar al revisor de cada pull request pertinente un resultado visible de la suite antes de integrar el cambio.
- Permitir que un desarrollador reproduzca el resultado con Python 3.11, un manifiesto de pruebas y el mismo comando de pytest que usa CI.

## 3. Alcance y exclusiones

La entrega comprende un workflow, un manifiesto mínimo de dependencias de prueba y la actualización del plan de pruebas. Se ejecutará el archivo completo, incluidos los casos que se le añadan en el futuro.

Quedan fuera las suites `decision` y `cross`, el descubrimiento global con pytest, los scripts de integración, el frontend, los cambios al servicio o a sus aserciones, el despliegue y la configuración de protecciones de rama.

## 4. Requisitos técnicos

| Elemento | Comportamiento requerido |
|---|---|
| Disparador | Evento `pull_request` al abrir, reabrir o actualizar un PR que cambie `Gestión_tickets/**` o `.github/workflows/incident-analysis-tests.yml`. Aplicar a cualquier rama destino. |
| Entorno | Un job en un runner Linux de GitHub con Python 3.11, alineado con el Dockerfile. Tras obtener el repositorio, ejecutar los comandos de instalación y prueba desde `Gestión_tickets/`. |
| Dependencias | Preparar un manifiesto específico con versiones exactas verificadas en un entorno limpio. Partir de pytest, Pydantic 2 y SQLAlchemy. Justificar cualquier dependencia directa adicional mediante la ejecución de la suite. |
| Ejecución | Instalar con `python -m pip install -r requirements-test-incident-ai.txt` y ejecutar `python -m pytest -q test/test_incident_analysis_ai.py`. Conservar el código de salida de pytest. |
| Resultado | El resumen de pytest debe quedar visible en el registro del job. Un fallo de instalación, colección o aserción debe marcar el job como fallido. |

## 5. Archivos involucrados

| Ruta desde la raíz | Intervención prevista |
|---|---|
| `.github/workflows/incident-analysis-tests.yml` | Crear el workflow de validación. |
| `Gestión_tickets/requirements-test-incident-ai.txt` | Crear el manifiesto verificado para esta suite. |
| `docs/TEST_PLAN.md` | Documentar preparación local, comando, disparador y cobertura del job junto a las instrucciones existentes. |
| `Gestión_tickets/test/test_incident_analysis_ai.py` | Referencia para la colección, los dobles de prueba y las aserciones. |
| `Gestión_tickets/app/services/incident_analysis_ai_service.py` y `Gestión_tickets/app/schemas/consolidated_import_schema.py` | Referencias para comprobar importaciones y comportamiento ejercitado. |
| `Gestión_tickets/Dockerfile` y `Gestión_tickets/requirements.txt` | Referencias para contrastar versión de Python y dependencias de producción. |

## 6. Plan de implementación por fases

1. **Establecer la referencia local.** Crear un entorno virtual limpio con Python 3.11, resolver las dependencias mínimas y ejecutar las comprobaciones de colección y resultado de la sección 8. Si una prueba existente falla, conservar su diagnóstico y distinguir un problema de instalación de un fallo funcional. Una corrección funcional requerirá un alcance separado.
2. **Reproducir el entorno en CI.** Fijar las versiones comprobadas en el manifiesto y repetir la instalación desde cero. Crear el workflow con los filtros, permisos y comando especificados.
3. **Documentar y verificar.** Actualizar el plan de pruebas, verificar la propagación de fallos con una copia temporal y recoger el resultado remoto en el primer PR autorizado que active el workflow.

## 7. Criterios de aceptación

- **CA-01.** En un entorno limpio con Python 3.11, el manifiesto permite recolectar los 13 casos actuales y obtener `13 passed` con código de salida 0.
- **CA-02.** Un PR que cambie el backend o el propio workflow muestra el job y su resultado. Un cambio limitado a `fronted-tickets/` queda fuera de los filtros.
- **CA-03.** La ejecución usa exclusivamente el archivo indicado. Un fallo de prueba llega al estado final del job.
- **CA-04.** El job funciona con permiso `contents: read`, sin secretos de aplicación, configuración de producción ni servicios de base de datos.
- **CA-05.** Los pasos de instalación y ejecución documentados en `docs/TEST_PLAN.md` coinciden con el manifiesto y los comandos efectivos del workflow.

## 8. Plan de pruebas

Ejecutar las comprobaciones locales desde `Gestión_tickets/`, con el entorno virtual de Python 3.11 activo.

| Comprobación | Procedimiento | Evidencia esperada |
|---|---|---|
| Instalación y colección | Instalar el manifiesto en el entorno limpio. Ejecutar `python -m pytest --collect-only -q test/test_incident_analysis_ai.py`. | 13 casos recolectados del archivo previsto. |
| Ejecución positiva | Ejecutar `python -m pytest -q test/test_incident_analysis_ai.py` sin cargar archivos de entorno. | 13 aprobados, cero omitidos y salida 0. |
| Propagación de fallo | En una copia temporal, hacer fallar una aserción y repetir el comando. Revisar que el paso equivalente de CI ejecuta pytest directamente y carece de `continue-on-error`. | Pytest identifica el caso y devuelve salida 1. La modificación temporal queda fuera del PR. |
| Activación y paridad | Revisar ambos patrones de rutas y el directorio de trabajo. En el primer PR pertinente, contrastar el registro del job con el resultado local. | Check visible, instalación correcta y la misma suite aprobada. Hasta observar el check, la validación remota queda pendiente. |

## 9. Riesgos y consideraciones de seguridad

| Riesgo | Tratamiento |
|---|---|
| Activar un servicio externo durante la prueba | Mantener los dobles de prueba existentes. Omitir archivos de entorno, claves de OpenAI, cadenas de conexión y servicios SQL del job. Si aparece una dependencia de integración, investigar la ruta de importación antes de ampliar el entorno. |
| Ejecutar código de un PR con permisos excesivos | Usar `pull_request` con `permissions: contents: read`. Evitar `pull_request_target`, secretos de aplicación y pasos de publicación o despliegue. |
| Divergencia entre el equipo local y CI | Usar el mismo manifiesto y Python 3.11. Registrar las versiones resueltas al investigar diferencias entre plataformas. |
| Ruta mal escrita o alcance de pruebas interpretado incorrectamente | Conservar la tilde y las mayúsculas de `Gestión_tickets/` en Linux. Identificar el job como prueba unitaria del análisis ejecutivo. El resultado acredita únicamente esta suite. |
