# Gestión de Tickets

Aplicación de análisis y seguimiento de tickets. El repositorio contiene una SPA Angular y una API FastAPI. El backend ofrece paneles de SLA y datos consolidados, importación de archivos, auditoría de categorización, reportes y consultas analíticas asistidas por IA. La persistencia principal de estos dominios usa SQL Server; existe además un flujo ETL de prueba separado que escribe y lee SQLite.

## Tecnologías

- **Frontend:** Angular 22, TypeScript 6, Angular Material, RxJS y Chart.js (`ng2-charts`). Las versiones son las declaradas en `fronted-tickets/package.json` y `package-lock.json`; el proyecto no declara una versión de Node.js.
- **Backend:** FastAPI, Uvicorn, SQLAlchemy y Pydantic. `requirements.txt` no fija la mayoría de versiones Python.
- **Datos y procesamiento:** Microsoft SQL Server mediante `pyodbc` y ODBC Driver 18; SQLite para ETL de prueba; pandas y openpyxl para archivos; sentence-transformers para categorización semántica; OpenAI se incluye como dependencia para funcionalidades de IA.
- **Contenedor backend:** Dockerfile basado en `python:3.11-slim`, que publica el puerto 8080.

## Estructura

```text
fronted-tickets/       SPA Angular: páginas, componentes, servicios HTTP y modelos
Gestión_tickets/app/   API y backend: controladores, schemas, servicios, repositorios,
                       modelos, persistencia, seguridad y ETL
Gestión_tickets/test/  Pruebas, scripts de validación y datos de evaluación
docs/                  Arquitectura y estado del proyecto
```

La guía de arquitectura está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); el inventario de funcionalidades y sus límites comprobables, en [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md). Los documentos técnicos previstos se enlazan desde [AGENTS.md](AGENTS.md).

## Ejecución local

Los siguientes pasos reflejan los scripts y configuración presentes. No se ha verificado la ejecución en una máquina limpia. Se necesita acceso a SQL Server y al controlador ODBC 18 para los endpoints que usan esa base. El frontend requiere una versión de Node.js compatible con Angular 22; el repositorio no fija dicha versión.

### 1. Configurar el backend

En PowerShell:

```powershell
cd Gestión_tickets
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Antes de iniciar la API, configura en el entorno de proceso las variables que lee `app/core/config.py`: `DB_SERVER`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` y `JWT_SECRET_KEY`. No guardes credenciales en el repositorio. La configuración SQL Server se valida al inicializar el módulo de conexión; sin los valores requeridos, la API no arranca.

Inicia FastAPI desde `Gestión_tickets/`:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8080
```

El contenedor usa Uvicorn en `0.0.0.0:8080`; su Dockerfile no sustituye la configuración de las variables requeridas por la aplicación.

### 2. Instalar e iniciar el frontend

En otra terminal:

```powershell
cd fronted-tickets
npm ci
npm start
```

El servidor de desarrollo de Angular se configura para el puerto 4200. `proxy.conf.json` reenvía las llamadas cuyo path comienza con `/api` a `http://127.0.0.1:8080`, quitando ese prefijo. La API configura CORS para `http://localhost:4200`.

## Comandos disponibles

Desde `fronted-tickets/`, los scripts declarados son `npm start`, `npm run build` y `npm test`. El backend declara sus dependencias en `Gestión_tickets/requirements.txt`; el comando de arranque está también en `Gestión_tickets/Dockerfile`. La ejecución y cobertura de pruebas no se han validado como parte de esta documentación.

## Límites conocidos

- La persistencia SQL Server y la SQLite del flujo `/etl-test` tienen configuraciones separadas; consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- No hay una versión Python fijada para desarrollo en un manifiesto de dependencias, aunque el contenedor utiliza Python 3.11.
- El repositorio no documenta aún topología productiva, despliegue del frontend ni proceso de migraciones.
