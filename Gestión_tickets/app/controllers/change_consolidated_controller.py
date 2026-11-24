import logging
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.schemas.consolidated_import_schema import ConsolidatedImportOut
from app.schemas.change_consolidated_schema import (
    ChangeConsolidatedCategoriaItem,
    ChangeConsolidatedDashboardFilters,
    ChangeConsolidatedFiltersOut,
    ChangeConsolidatedKPIOut,
    ChangeConsolidatedVolumenItem,
    ChangeConsolidatedProyectoItem,
    ChangeConsolidatedTipoItem,
    ChangeConsolidatedPrioridadItem,
    ChangeConsolidatedTopProyectosOut,
    ChangeConsolidatedPrioridadMensualItem,
    ChangeConsolidatedTicketsOut,
    ChangeConsolidatedActividadesBDOut,
    ChangeConsolidatedHorasCambioOut,
    ChangeConsolidatedHorasResolutorItem,
    ChangeConsolidatedHorasMensualesItem,
)
from app.schemas.resolutor_dashboard_schema import (
    ResolverRendimientoOut, ResolverTicketsPorResolutorOut,
)
from app.services import change_consolidated_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/change-consolidated", tags=["Change Consolidated"])


@router.post("/import", response_model=ConsolidatedImportOut)
def importar_change_consolidated(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_sqlserver_db),
):
    try:
        if not archivo.filename or not archivo.filename.lower().endswith(".xlsx"):
            raise HTTPException(
                status_code=400,
                detail="Se requiere un archivo Excel .xlsx de Cambios Consolidados",
            )
        return change_consolidated_service.importar(db, archivo.file, archivo.filename)
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ConnectionError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("Error inesperado al importar Cambios Consolidados")
        raise HTTPException(
            status_code=500,
            detail="No fue posible importar el archivo de Cambios. Consulte los registros del servidor.",
        ) from error


@router.get("/filters", response_model=ChangeConsolidatedFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return change_consolidated_service.obtener_opciones_filtros(db)


def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    prioridad: str | None = None,
    motivo: str | None = None,
    grupo_resolutor: str | None = None,
    estado: str | None = None,
    proyecto: str | None = None,
    periodo: str | None = Query(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$",
    ),
    tipo_cambio: list[str] | None = Query(default=None),
    proyectos_excluidos: list[str] | None = Query(default=None),
    nombre_resolutor: str | None = Query(default=None, max_length=150),
    ticket_id: str | None = Query(default=None, max_length=20),
) -> ChangeConsolidatedDashboardFilters:
    if desde and hasta and desde > hasta:
        raise HTTPException(
            status_code=422,
            detail="La fecha desde no puede ser posterior a hasta",
        )
    return ChangeConsolidatedDashboardFilters(
        desde=desde,
        hasta=hasta,
        prioridad=prioridad,
        motivo=motivo,
        grupo_resolutor=grupo_resolutor,
        estado=estado,
        proyecto=proyecto,
        periodo=periodo,
        tipo_cambio=tipo_cambio or [],
        proyectos_excluidos=proyectos_excluidos or [],
        nombre_resolutor=nombre_resolutor,
        ticket_id=ticket_id,
    )


@router.get("/kpis", response_model=ChangeConsolidatedKPIOut)
def obtener_kpis(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_kpis(db, filtros)


# VOLUMEN MENSUAL DE TICKETS DE CAMBIOS
@router.get("/volumen-mensual", response_model=list[ChangeConsolidatedVolumenItem])
def obtener_volumen_mensual(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_volumen_mensual(db, filtros)


# EXPLORADOR POR PROYECTOS
@router.get("/proyectos", response_model=list[ChangeConsolidatedProyectoItem])
def obtener_proyectos(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_proyectos(db, filtros)


# DISTRIBUCION POR TIPO DE CAMBIO (Tipo_Cambio, no categorización nivel 3)
@router.get("/tipos", response_model=list[ChangeConsolidatedTipoItem])
def obtener_tipos(
    limite: int = Query(10, ge=1, le=100),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_tipos(db, filtros, limite=limite)


# DISTRIBUCION POR CATEGORIA (Categorizacion_Nivel_3)
@router.get("/categorias", response_model=list[ChangeConsolidatedCategoriaItem])
def obtener_categorias(
    limite: int = Query(10, ge=1, le=100),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_categorias(
        db, filtros, limite=limite
    )

# DISTRIBUCION POR PRIORIDAD
@router.get("/prioridades", response_model=list[ChangeConsolidatedPrioridadItem])
def obtener_prioridades(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_prioridades(db, filtros)


# TOP 10 PROYECTOS POR MES
@router.get("/top-proyectos", response_model=ChangeConsolidatedTopProyectosOut)
def obtener_top_proyectos(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_top_proyectos(db, filtros)


# NUMERO DE CAMBIOS POR PRIORIDAD Y MES
@router.get(
    "/prioridad-mensual",
    response_model=list[ChangeConsolidatedPrioridadMensualItem],
)
def obtener_prioridad_mensual(
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_prioridad_mensual(db, filtros)


# EXPLORADOR PAGINADO DE TICKETS
@router.get("/tickets", response_model=ChangeConsolidatedTicketsOut)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_tickets(
        db, filtros, pagina=pagina, tamano=tamano
    )

# ================================================================
# PRD 05 - ANALISIS DE ACTIVIDADES Y HORAS DE CAMBIOS
# ================================================================

@router.get("/actividades-bd", response_model=ChangeConsolidatedActividadesBDOut)
def obtener_actividades_bd(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    incluir_solo_validacion: bool = Query(True),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_actividades_bd(
        db, filtros, pagina, tamano, incluir_solo_validacion
    )


@router.get("/horas-por-cambio", response_model=ChangeConsolidatedHorasCambioOut)
def obtener_horas_por_cambio(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    incluir_solo_validacion: bool = Query(True),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_horas_por_cambio(
        db, filtros, pagina, tamano, incluir_solo_validacion
    )


@router.get(
    "/horas-por-resolutor",
    response_model=list[ChangeConsolidatedHorasResolutorItem],
)
def obtener_horas_por_resolutor(
    incluir_solo_validacion: bool = Query(True),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_horas_por_resolutor(
        db, filtros, incluir_solo_validacion
    )


@router.get(
    "/horas-mensuales",
    response_model=list[ChangeConsolidatedHorasMensualesItem],
)
def obtener_horas_mensuales(
    incluir_solo_validacion: bool = Query(True),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_horas_mensuales(
        db, filtros, incluir_solo_validacion
    )



# PRD 06 - RESOLUTORES: tabla mensual paginada y ranking.
@router.get("/rendimiento-resolutores", response_model=ResolverRendimientoOut)
def obtener_rendimiento_resolutores(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(20, ge=1, le=100),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_rendimiento_resolutores(
        db, filtros, pagina=pagina, tamano=tamano
    )


@router.get("/tickets-por-resolutor", response_model=ResolverTicketsPorResolutorOut)
def obtener_tickets_por_resolutor(
    tamano: int = Query(5, ge=1, le=20),
    filtros: ChangeConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return change_consolidated_service.obtener_tickets_por_resolutor(
        db, filtros, limite=tamano
    )
