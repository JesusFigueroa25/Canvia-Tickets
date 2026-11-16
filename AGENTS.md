# Guía para agentes

## Contexto

Este repositorio reúne una SPA Angular (`fronted-tickets/`) y una API FastAPI (`Gestión_tickets/`). La API utiliza SQL Server en sus dominios principales y SQLite en un flujo ETL de prueba. Lee [README.md](README.md) para ejecución local.

## Reglas de trabajo

- Antes de cambiar código, revisa los documentos pertinentes en `docs/` y sigue los consumidores frontend/backend del flujo afectado.
- Mantén contratos y nombres de rutas sincronizados entre servicios Angular, controladores FastAPI y schemas. No supongas que una modificación de un lado basta.
- No expongas credenciales, tokens, datos personales ni contenido de archivos de entorno en documentación, logs o ejemplos. Usa marcadores ficticios cuando un ejemplo sea imprescindible.
- No cambies esquemas, datos ni configuración de bases compartidas sin autorización explícita.
- No afirmes que una funcionalidad, prueba o despliegue funciona sin evidencia de ejecución. Indica claramente lo que no pudo verificarse.
- No realices commits ni despliegues salvo solicitud explícita.

## Convenciones observadas

- Frontend organizado en páginas y componentes (`src/app/components/`), servicios HTTP (`src/app/services/`) y modelos TypeScript (`src/app/models/`). La aplicación usa `AppModule` y `AppRoutingModule`.
- Backend organizado en `controllers/`, `schemas/`, `services/`, `repositories/`, `models/`, `database/` y `etl/`.
- Conserva la separación entre SQL Server y SQLite. No cambies el motor de un flujo sin rastrear las dependencias y validar la persistencia objetivo.
- Los paquetes Python no tienen versiones fijadas en su mayoría. No introduzcas ni actualices dependencias sin necesidad y sin reflejarlo en los manifiestos correspondientes.

## Documentación

- [README.md](README.md): descripción e inicio local.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): componentes, capas y flujos de datos.
- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md): funcionalidades observadas y pendientes de confirmación.
- `docs/API_CONTRACT.md`: contrato API; actualmente pendiente de completar.
- `docs/DB_SCHEMA.md`: esquema persistente; requiere cotejo con SQL Server.
- `docs/DESIGN_SYSTEM.md`: patrones visuales frontend.
- `docs/TEST_PLAN.md`: alcance y ejecución de pruebas.
- `docs/DEPLOYMENT.md`: despliegue y operación.

Actualiza la documentación técnica correspondiente cuando un cambio autorizado altere arquitectura o comportamiento observable. Evita duplicar detalles: enlaza al documento que mantiene la fuente de verdad.
