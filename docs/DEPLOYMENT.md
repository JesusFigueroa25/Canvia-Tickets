# Despliegue CANVIA — Gestión de Tickets

## Alcance y grado de verificación

Este runbook separa lo comprobado en el repositorio de la secuencia comunicada para el entorno CANVIA. El código local contiene un Dockerfile para FastAPI, configuración de build/serve Angular y un proxy de desarrollo. **No contiene** procedimiento versionado de WinSCP, Nginx, servicio Linux, directorios de publicación/respaldo ni rollback. Por ello, los datos operativos indicados por el equipo se consideran información pendiente de contrastar con el servidor.

No se ejecutó build, empaquetado, conexión SSH/SFTP, acción de servicio, migración ni operación productiva para redactar este documento.

## Arquitectura de despliegue comprobada en el repositorio

- Backend: `Gestión_tickets/Dockerfile` usa `python:3.11-slim`, instala `requirements.txt`, expone el puerto 8080 y arranca `uvicorn app.main:app --host 0.0.0.0 --port 8080`.
- Variables del backend: `DB_SERVER`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` y `JWT_SECRET_KEY`; las funciones IA leen `OPENAI_API_KEY` y `OPENAI_MODEL`. Los valores deben venir de configuración segura del entorno y no del artefacto.
- Frontend: Angular CLI, `npm run build`, configuración de build de producción con hashing. `angular.json` no declara `baseHref`, `deployUrl`, `outputPath` ni una configuración de despliegue para `/canvia/`.
- API en desarrollo: `proxy.conf.json` reenvía `/api` a `http://127.0.0.1:8080` y quita `/api`. CORS local permite `http://localhost:4200`. El proxy no es configuración de Nginx ni de producción.
- Los servicios Angular construyen rutas relativas `api/...`; las rutas FastAPI se sirven como `/home/...`, `/incident-consolidated/...`, etc. En producción debe existir un mapeo equivalente al proxy de desarrollo que enrute `/canvia/api/...` al path de backend sin ese prefijo.
- FastAPI publica `GET /`, que responde JSON con un mensaje de estado. No es una prueba completa de conexión a SQL Server ni de disponibilidad de OpenAI.

El proyecto también configura SQLite en `Gestión_tickets/assets/tickets_test.db` para el flujo ETL de prueba. Confirmar si ese archivo/directorio está presente y si contiene datos que deban persistirse en el host; no incluirlo ni eliminarlo a ciegas.

## Procedimiento reportado por el equipo, pendiente de validar

La secuencia indicada para el servidor CANVIA es: compilar Angular bajo `/canvia/`, empaquetar frontend y backend, transferir con WinSCP a un servidor Linux, servir el frontend mediante Nginx y ejecutar FastAPI como servicio. La estructura de pasos siguiente documenta esa secuencia; no equivale a un procedimiento confirmado ni proporciona comandos productivos no encontrados en el repositorio.

### 1. Preparar artefactos

1. Confirmar commit/versión que se va a publicar y construir frontend desde `fronted-tickets/` con base path `/canvia/`.
2. El repositorio define el script `npm run build`, pero no contiene un comando de publicación para el subpath. `npm run build -- --base-href /canvia/` es una forma candidata de pasar ese parámetro a Angular CLI; debe probarse en build de staging y confirmarse como comando oficial antes de adoptarla.
3. Confirmar el directorio real de salida del builder y el contenido que debe incluir cada paquete. `angular.json` no declara `outputPath`.
4. El árbol contiene `fronted-tickets/fronted-tickets-canvia.tar.gz` y `Gestión_tickets/gestion-tickets-backend-update.tar.gz`; su presencia no acredita que sean los artefactos vigentes. No se inspeccionaron sus contenidos, fecha, procedencia ni reproducibilidad.
5. Mantener fuera del paquete los secretos, credenciales y archivos de entorno. Generar el backend a partir del código y dependencias aprobadas; confirmar si el servidor ejecuta el código directamente o una imagen Docker.

### 2. Preparar servidor y respaldos

Antes de transferir, registrar con Infraestructura/Operaciones los siguientes valores (no aparecen en el repositorio):

| Dato operativo | Valor que debe confirmar el equipo |
|---|---|
| Host/entorno y usuario de transferencia WinSCP | No documentado aquí |
| Directorio de releases/staging y directorio activo publicado | No documentado aquí |
| Raíz Nginx que sirve `/canvia/` y configuración habilitada | No se encontró archivo Nginx |
| Directorio y retención de respaldos | No documentado aquí |
| Nombre de unidad/servicio FastAPI, usuario Linux, working directory y puerto local | No se encontró unidad o script de servicio |
| Ubicación protegida de `.env`, `.venv`, `assets` y caché/modelos IA | Confirmar en servidor; no inferir rutas |

Crear y verificar el respaldo previo de frontend/backend antes de cambiar el enlace/directorio activo. Respaldar por separado configuración y datos persistentes. No sustituir ni borrar `.env`, `.venv`, `assets` o caché de modelos como parte de una copia genérica. Confirmar permisos y propietario con Operaciones.

### 3. Transferir y activar

El flujo indicado por el equipo usa WinSCP para copiar artefactos al servidor Linux. Transferir primero a un área de staging y validar que los archivos completos y corresponden a la versión aprobada. El repositorio no establece rutas de destino, nombres de paquetes de release, comandos de extracción, enlaces simbólicos ni orden de parada/inicio; obtener y registrar esos detalles en el runbook operativo antes de aplicar el cambio.

Nginx debe servir la SPA bajo `/canvia/`, permitir fallback de rutas Angular a su documento de entrada y reenviar el prefijo de API al backend eliminando `/canvia/api` (o el mapeo que se confirme). La configuración de desarrollo elimina solo `/api`; no valida automáticamente la ruta productiva `/canvia/api`.

FastAPI debe iniciarse desde su directorio de aplicación y con las variables de entorno necesarias. El servicio Linux y su gestor (por ejemplo, systemd u otro) no se identifican en el código; no hay nombre de unidad ni comando de reinicio verificado.

### 4. Verificaciones posteriores

Realizar estas verificaciones en staging/entorno autorizado antes de considerar la versión activa:

1. Solicitar `GET https://<host>/canvia/`; validar código HTTP esperado, documento Angular, carga de scripts/estilos y ausencia de errores de carga en navegador.
2. Solicitar el endpoint raíz del backend por su URL/puerto interno real; FastAPI declara `GET /` con JSON de estado. Esta señal confirma que Uvicorn responde, no que SQL Server, autenticación, chat IA o todas las vistas estén sanas.
3. Desde la SPA, inspeccionar una llamada `/canvia/api/...` y comprobar en Nginx que se transforma al path FastAPI correspondiente. La página `/canvia/` con API rota no es una publicación correcta.
4. Verificar una ruta de lectura representativa contra datos de prueba y confirmar filtros/respuesta. No ejecutar endpoints de importación para smoke test sin autorización y datos de ensayo.
5. Revisar logs de Nginx y del servicio FastAPI en la ruta/plataforma confirmada. Si el servicio resulta ser systemd, obtener del equipo el nombre de unidad antes de usar `systemctl`/`journalctl`; esos nombres y ubicaciones no constan aquí.
6. Revisar errores de base y OpenAI usando mensajes sanitizados. No registrar cuerpos con datos personales, tokens, contraseñas ni claves.

## Datos y archivos que deben conservarse

- **`.env`:** conservar configuración de entorno mediante el mecanismo seguro del host; no empaquetarlo, copiarlo a un destino público ni reemplazarlo con un archivo del repositorio. Los nombres de variables se describen en `README.md` y `API_CONTRACT.md`, sin valores.
- **`.venv`:** si el backend se ejecuta desde un entorno virtual existente, no eliminarlo como parte de una actualización de código ordinaria. Los cambios de dependencias requieren procedimiento separado: preparar/validar un entorno compatible y planificar sustitución controlada; conservar el anterior hasta confirmar rollback.
- **`assets/`:** preservar según contenido real. El código usa SQLite de ETL de prueba en `Gestión_tickets/assets/tickets_test.db`; confirmar si está en el servidor y qué datos contiene antes de copiar o reemplazarlo.
- **Modelos IA:** sentence-transformers configura un modelo multilingüe y puede depender de archivos descargados/caché local; la ubicación efectiva depende del entorno y no está fijada en el código inspeccionado. Identificarla en el host antes de limpiar o cambiar usuario de servicio. La integración OpenAI es externa y no debe confundirse con un modelo local descargado.
- **Respaldos:** confirmar directorio/retención y mantener disponibles al menos el artefacto previo y su configuración asociada durante la ventana de reversión.

## Rollback

No se encontró un procedimiento automatizado de rollback. La reversión debe restaurar la versión anterior de frontend y backend desde el respaldo verificado, reactivar la configuración anterior de Nginx/servicio cuando esos componentes hayan cambiado y recuperar `.env`, entorno virtual, assets y caché/modelos conforme al plan del host. Después, repetir las verificaciones HTTP y revisar logs.

No revertir cambios de esquema con restauración de archivos solamente. Cualquier migración o cambio SQL Server requiere un plan y aprobación del DBA, respaldo de base y estrategia de compatibilidad explícita. No se identificó sistema de migraciones en el repositorio.

## Despliegues especiales

| Cambio | Consideraciones que requieren procedimiento específico |
|---|---|
| Dependencias Angular | Actualizar `package.json` y lockfile como cambio separado; reconstruir paquete estático y validar base `/canvia/`. |
| Dependencias Python | Cambia el entorno de ejecución; `requirements.txt` no fija versiones para la mayoría. Preparar y validar entorno nuevo antes de sustituir `.venv`/imagen, con rollback disponible. |
| Modelo/categorización IA | Verificar nombre/versión del modelo, caché, permisos y conectividad de descarga; planificar espacio y usuario de servicio. |
| Configuración OpenAI | Cambiar `OPENAI_API_KEY`/`OPENAI_MODEL` mediante gestión de secretos; validar respuesta con entorno y cuota aprobados sin imprimir valores. |
| Esquema/base de datos | Coordinar con DBA; documentar DDL, compatibilidad, respaldo, migración y recuperación. No hay migraciones automatizadas documentadas. |
| Nginx, subpath o dominio | Revisar base href, fallback SPA, prefijo y rewrite de `/canvia/api/`, TLS y reload según el procedimiento de Infraestructura. La configuración no está versionada en este repositorio. |

## Pendientes antes de declarar este runbook operativo

1. Obtener el procedimiento real de WinSCP y comandos/rutas aprobados de build, empaquetado y extracción.
2. Registrar directorios activos, staging y respaldo; verificar si los tarballs del repo son los paquetes oficiales y documentar cómo se generan.
3. Obtener configuración Nginx, nombre/gestor de servicio, puerto/health URL, ubicaciones de logs y comandos de restart/rollback.
4. Confirmar tratamiento y respaldo de `.env`, `.venv`, `assets` y cachés de modelos; establecer qué vive en disco persistente y qué se reconstruye.
5. Probar en staging la build `/canvia/` y el rewrite entre `/canvia/api/...` y las rutas backend, ya que el proxy solo está configurado para desarrollo.
6. Definir evidencia de aceptación, ventana de mantenimiento, responsable de aprobación y runbook de base de datos.
