
from datetime import date

from fastapi import (APIRouter,Depends,File,HTTPException, Query,UploadFile,)
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.consolidated_import_schema import (ConsolidatedImportOut, RequirementConsolidatedFiltersOut, RequirementConsolidatedKPIOut, RequirementConsolidatedPrioridadItem, RequirementConsolidatedPrioridadMensualItem, RequirementConsolidatedProyectoItem, RequirementConsolidatedTipoItem, RequirementConsolidatedTopProyectosOut, RequirementConsolidatedVolumenItem,)
from app.schemas.consolidated_import_schema import (RequirementConsolidatedDashboardFilters,RequirementConsolidatedTicketsOut)
from app.services import (requirement_consolidated_service,)

router = APIRouter(prefix="/requirement-consolidated", tags=["Requirement Consolidated"])

@router.post("/import", response_model=ConsolidatedImportOut)
def importar_requirement_consolidated(archivo: UploadFile = File(...), db: Session = Depends(get_sqlserver_db)):
    try:
        return requirement_consolidated_service.importar(db, archivo.file, archivo.filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/filters",response_model=RequirementConsolidatedFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return requirement_consolidated_service.obtener_opciones_filtros(db)


#-------------------------------------------------------------
#Schema de Filtros del Dashboard
#-------------------------------------------------------------

def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    prioridad: str | None = None,
    motivo_estado: str | None = None,
    motivo_resolucion: str | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
    periodo: str | None = Query(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    ),
    tipo_requerimiento: list[str] | None = Query(default=None),
    proyectos_excluidos: list[str] | None = Query(default=None),
    ticket_id: str | None = Query(default=None, max_length=20)
) -> RequirementConsolidatedDashboardFilters:
    return RequirementConsolidatedDashboardFilters(
        desde=desde,
        hasta=hasta,
        prioridad=prioridad,
        motivo_estado=motivo_estado,
        motivo_resolucion=motivo_resolucion,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
        periodo=periodo,
        tipo_requerimiento=tipo_requerimiento or [],
        proyectos_excluidos=proyectos_excluidos or [],
        ticket_id=ticket_id
    )


# KPIs
@router.get(
    "/kpis",
    response_model=RequirementConsolidatedKPIOut
)
def obtener_kpis(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_kpis(
        db,
        filtros
    )


# Volumen Mensual de Requerimientos
@router.get("/volumen-mensual", response_model=list[RequirementConsolidatedVolumenItem])
def obtener_volumen_mensual(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_volumen_mensual(
        db,
        filtros
    )


# Explorador por Proyectos
@router.get("/proyectos", response_model=list[RequirementConsolidatedProyectoItem])
def obtener_proyectos(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_proyectos(
        db,
        filtros
    )


# Distribución por Tipo de Requerimiento
@router.get("/tipos", response_model=list[RequirementConsolidatedTipoItem])
def obtener_tipos(
    limite: int = Query(10, ge=1, le=100),
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_tipos(
        db,
        filtros,
        limite=limite
    )


# Distribución por Prioridad
@router.get("/prioridades", response_model=list[RequirementConsolidatedPrioridadItem])
def obtener_prioridades(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_prioridades(
        db,
        filtros
    )


# Top 10: Tickets por Proyecto y Mes
@router.get("/top-proyectos", response_model=RequirementConsolidatedTopProyectosOut)
def obtener_top_proyectos(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_top_proyectos(
        db,
        filtros
    )


# N.º de Requerimientos por Prioridad
@router.get("/prioridad-mensual", response_model=list[RequirementConsolidatedPrioridadMensualItem])
def obtener_prioridad_mensual(
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_consolidated_service.obtener_prioridad_mensual(
        db,
        filtros
    )



# Tabla Tickets
@router.get("/tickets", response_model=RequirementConsolidatedTicketsOut)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: RequirementConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):

    return requirement_consolidated_service.obtener_tickets(
        db,
        filtros,
        pagina=pagina,
        tamano=tamano
    )
