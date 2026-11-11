import logging
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.schemas.consolidated_import_schema import ConsolidatedImportOut
from app.schemas.task_consolidated_schema import (
    TaskConsolidatedDashboardFilters,
    TaskConsolidatedFiltersOut,
    TaskConsolidatedKPIOut,
    TaskConsolidatedPrioridadItem,
    TaskConsolidatedPrioridadMensualItem,
    TaskConsolidatedProyectoItem,
    TaskConsolidatedTicketsOut,
    TaskConsolidatedTipoItem,
    TaskConsolidatedTopProyectosOut,
    TaskConsolidatedVolumenItem,
)
from app.services import task_consolidated_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/task-consolidated", tags=["Task Consolidated"])


@router.post("/import", response_model=ConsolidatedImportOut)
def importar_task_consolidated(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_sqlserver_db),
):
    try:
        if not archivo.filename or not archivo.filename.lower().endswith(".xlsx"):
            raise HTTPException(
                status_code=400,
                detail="Se requiere un archivo Excel .xlsx de Tareas Consolidadas",
            )
        return task_consolidated_service.importar(db, archivo.file, archivo.filename)
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ConnectionError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("Error inesperado al importar Tareas Consolidadas")
        raise HTTPException(
            status_code=500,
            detail="No fue posible importar el archivo de Tareas. Consulte los registros del servidor.",
        ) from error


@router.get("/filters", response_model=TaskConsolidatedFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return task_consolidated_service.obtener_opciones_filtros(db)


def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    prioridad: str | None = None,
    motivo_estado: str | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
    periodo: str | None = Query(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$",
    ),
    tipo_tarea: list[str] | None = Query(default=None),
    proyectos_excluidos: list[str] | None = Query(default=None),
    ticket_id: str | None = Query(default=None, max_length=20),
) -> TaskConsolidatedDashboardFilters:
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=422, detail="La fecha desde no puede ser posterior a hasta")

    return TaskConsolidatedDashboardFilters(
        desde=desde,
        hasta=hasta,
        prioridad=prioridad,
        motivo_estado=motivo_estado,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
        periodo=periodo,
        tipo_tarea=tipo_tarea or [],
        proyectos_excluidos=proyectos_excluidos or [],
        ticket_id=ticket_id,
    )


@router.get("/kpis", response_model=TaskConsolidatedKPIOut)
def obtener_kpis(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_kpis(db, filtros)


@router.get("/volumen-mensual", response_model=list[TaskConsolidatedVolumenItem])
def obtener_volumen_mensual(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_volumen_mensual(db, filtros)


@router.get("/proyectos", response_model=list[TaskConsolidatedProyectoItem])
def obtener_proyectos(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_proyectos(db, filtros)


@router.get("/tipos", response_model=list[TaskConsolidatedTipoItem])
def obtener_tipos(
    limite: int = Query(10, ge=1, le=100),
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_tipos(db, filtros, limite=limite)


@router.get("/prioridades", response_model=list[TaskConsolidatedPrioridadItem])
def obtener_prioridades(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_prioridades(db, filtros)


@router.get("/top-proyectos", response_model=TaskConsolidatedTopProyectosOut)
def obtener_top_proyectos(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_top_proyectos(db, filtros)


@router.get("/prioridad-mensual", response_model=list[TaskConsolidatedPrioridadMensualItem])
def obtener_prioridad_mensual(
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_prioridad_mensual(db, filtros)


@router.get("/tickets", response_model=TaskConsolidatedTicketsOut)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: TaskConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return task_consolidated_service.obtener_tickets(
        db, filtros, pagina=pagina, tamano=tamano
    )
