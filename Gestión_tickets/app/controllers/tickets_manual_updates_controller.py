import logging
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.etl.validator import ETLValidationError
from app.schemas.tickets_manual_updates_schema import (
    TicketsManualUpdatesImportOut,
)
from app.services import tickets_manual_updates_service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tickets-manual-updates",
    tags=["Tickets Manual Updates"]
)


@router.post(
    "/import",
    response_model=TicketsManualUpdatesImportOut
)
def importar_tickets_manual_updates(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_sqlserver_db)
):

    nombre_archivo = Path(
        archivo.filename or ""
    ).name

    if not nombre_archivo:
        raise HTTPException(
            status_code=400,
            detail="Debe seleccionar un archivo Excel."
        )

    extension = Path(nombre_archivo).suffix.lower()

    if extension not in (".xlsx", ".xls"):
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten archivos Excel."
        )

    try:
        # Comprobar el tamaño real del archivo.
        archivo.file.seek(0, 2)
        tamano = archivo.file.tell()
        archivo.file.seek(0)

        if tamano > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="El archivo supera los 50 MB."
            )

        return tickets_manual_updates_service.importar(
            db=db,
            archivo=archivo.file,
            nombre_archivo=nombre_archivo
        )

    except HTTPException:
        raise

    except (ETLValidationError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error

    except ConnectionError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except Exception as error:
        logger.exception(
            "Error al importar tickets manuales."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Error interno durante la importación. "
                "Revise los logs del backend."
            )
        ) from error

    finally:
        archivo.file.close()


# ============================================================
# PASO 3: ENDPOINTS DE ATENCION PARALELA
# ============================================================
from datetime import date
from fastapi import Query
from sqlalchemy.exc import DBAPIError
from app.schemas.tickets_manual_updates_schema import (
    TipoTicketParalelo, TicketsParallelFilters, TicketsParallelFiltersOut,
    TicketsParallelKPIOut, TicketsParallelMonthlyItem, TicketsParallelResolverItem,
    TicketsParallelTicketsOut, TicketsParallelDetailOut, TicketsParallelProjectItem,
    TicketsParallelResolverPage, TicketsParallelProjectPage,
)


def _filtros_paralelos(
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = Query(default="BASE DE DATOS Y EBS", max_length=150),
    prioridad: str | None = Query(default=None, max_length=30),
    motivo: str | None = Query(default=None, max_length=250),
    proyectos: list[str] | None = Query(default=None),
    todos_proyectos: bool = False,
    ticket_type: TipoTicketParalelo | None = None,
) -> TicketsParallelFilters:
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=422, detail="La fecha Desde no puede superar Hasta.")
    if hasta == date.max or desde == date.max:
        raise HTTPException(status_code=422, detail="Fecha fuera del rango admitido.")
    if proyectos and (len(proyectos) > 200 or any(not p.strip() or len(p) > 200 for p in proyectos)):
        raise HTTPException(status_code=422, detail="Máximo 200 proyectos no vacíos de hasta 200 caracteres.")
    grupo = (grupo_resolutor or "").strip()
    if grupo.casefold() in {"", "todos", "all"}:
        grupo = None
    def opcion(value):
        value = (value or "").strip()
        return None if value.casefold() in {"", "todos", "todas", "all"} else value
    return TicketsParallelFilters(desde=desde, hasta=hasta, grupo_resolutor=grupo,
                                  prioridad=opcion(prioridad), motivo=opcion(motivo),
                                  proyectos=list(dict.fromkeys(p.strip() for p in (proyectos or []))),
                                  todos_proyectos=todos_proyectos, ticket_type=ticket_type)


def _consulta(func, *args):
    try:
        return func(*args)
    except HTTPException:
        raise
    except ValueError as exc:
        logger.warning("Error de validación en atención paralela: %s", exc)
        raise HTTPException(status_code=422, detail="Rango o parámetros de análisis inválidos.") from exc
    except (DBAPIError, ConnectionError) as exc:
        logger.exception("Error SQL Server en atención paralela.")
        raise HTTPException(status_code=503, detail="No se pudo consultar SQL Server.") from exc
    except Exception as exc:
        logger.exception("Error interno en atención paralela.")
        raise HTTPException(status_code=500, detail="Error interno en el análisis de atención paralela.") from exc


@router.get("/filters", response_model=TicketsParallelFiltersOut)
def obtener_filtros_paralelos(
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(tickets_manual_updates_service.obtener_opciones_filtros, db, filtros)


@router.get("/kpis", response_model=TicketsParallelKPIOut)
def obtener_kpis_paralelos(
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(tickets_manual_updates_service.obtener_kpis, db, filtros)


@router.get("/resumen-ejecutivo-mensual", response_model=list[TicketsParallelMonthlyItem])
def obtener_resumen_ejecutivo_mensual(
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(tickets_manual_updates_service.obtener_resumen_ejecutivo_mensual, db, filtros)


@router.get("/paralelos-resolutores", response_model=list[TicketsParallelResolverItem] | TicketsParallelResolverPage)
def obtener_paralelos_resolutores(
    pagina: int | None = Query(default=None, ge=1, description="Página de entidades; si se omite con tamano, usa 1."),
    tamano: int | None = Query(default=None, ge=1, le=100, description="Entidades por página; si se omite con pagina, usa 10."),
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(tickets_manual_updates_service.obtener_paralelos_resolutores, db, filtros, pagina, tamano)


@router.get(
    "/paralelos-tickets",
    response_model=TicketsParallelTicketsOut
)
def obtener_paralelos_tickets(
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=25, ge=1, le=100),
    tipo_ticket_local: TipoTicketParalelo | None = None,
    resolutor_busqueda: str | None = Query(
        default=None,
        max_length=300
    ),
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(
        tickets_manual_updates_service.obtener_paralelos_tickets,
        db,
        filtros,
        pagina,
        tamano,
        tipo_ticket_local,
        resolutor_busqueda
    )


@router.get("/paralelos-tickets/{ticket_id}/detalle", response_model=TicketsParallelDetailOut)
def obtener_detalle_paralelos(
    ticket_id: str,
    resolutor: str = Query(..., min_length=1, max_length=300),
    tipo_ticket: TipoTicketParalelo = Query(...),
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    if not ticket_id.strip() or len(ticket_id) > 20 or not resolutor.strip():
        raise HTTPException(status_code=422, detail="Identidad del ticket o resolutor inválida.")
    detalle = _consulta(tickets_manual_updates_service.obtener_detalle_paralelos, db, filtros, ticket_id, tipo_ticket, resolutor)
    if detalle is None:
        raise HTTPException(status_code=404, detail="Ticket sin coincidencias para el resolutor y filtros seleccionados.")
    return detalle


@router.get("/paralelos-proyectos", response_model=list[TicketsParallelProjectItem] | TicketsParallelProjectPage)
def obtener_paralelos_proyectos(
    pagina: int | None = Query(default=None, ge=1, description="Página de entidades; si se omite con tamano, usa 1."),
    tamano: int | None = Query(default=None, ge=1, le=100, description="Entidades por página; si se omite con pagina, usa 10."),
    filtros: TicketsParallelFilters = Depends(_filtros_paralelos),
    db: Session = Depends(get_sqlserver_db),
):
    return _consulta(tickets_manual_updates_service.obtener_paralelos_proyectos, db, filtros, pagina, tamano)
