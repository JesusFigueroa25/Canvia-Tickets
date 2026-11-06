from __future__ import annotations
from datetime import date
from typing import Any,Callable,TypeVar
from fastapi import APIRouter,BackgroundTasks,Depends,HTTPException,Path,Query,status
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.requirement_categorization_audit_schema import (
    AuditCategoryListOut,
    AuditGroupResolutionReasonListOut,
    AuditResolverListOut,
    AuditRunCreate,
    AuditRunOut,
    AuditSummaryOut,
    AuditTicketFilters,
    AuditTicketListOut,
    CategorizationStatus,
    AuditGroupCreate,
    AuditGroupOut,
    AuditGroupSummaryOut,
    AuditGroupTicketListOut,
    AuditGroupResolverListOut,
    AuditGroupMonthlyStatsOut,
    AuditDashboardFilters,
    AuditGroupFilterOptionsOut,
)
from app.services import requirement_categorization_audit_service as servicio
from app.services.requirement_categorization_audit_service import (AuditoriaEnCursoError,AuditoriaNoEncontradaError,)
from pydantic import ValidationError

router = APIRouter(prefix="/requirement-categorization-audit",tags=["Auditoría de Categorización"])

T = TypeVar("T")


def _ejecutar_operacion(operacion: Callable[...,T],*args: Any,**kwargs: Any) -> T:
    try:
        return operacion(*args,**kwargs)
    except AuditoriaNoEncontradaError as exc:
        raise HTTPException(status_code=404,detail=str(exc)) from exc
    except AuditoriaEnCursoError as exc:
        raise HTTPException(status_code=409,detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    



def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
    resultado: CategorizationStatus | None = None,
    motivo_resolucion: str | None = None,
    mes: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    nombre_resolutor: str | None = None,
    ticket_id: str | None = None,
) -> AuditDashboardFilters:

    try:
        return AuditDashboardFilters(
            desde=desde,
            hasta=hasta,
            grupo_resolutor=grupo_resolutor,
            proyecto=proyecto,
            resultado=resultado,
            motivo_resolucion=motivo_resolucion,
            mes=mes,
            nombre_resolutor=nombre_resolutor,
            ticket_id=ticket_id,
        )

    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc


@router.post("/runs",response_model=AuditRunOut,status_code=status.HTTP_202_ACCEPTED)
def crear_auditoria(datos: AuditRunCreate,background_tasks: BackgroundTasks,db: Session = Depends(get_sqlserver_db)):
    ejecucion = _ejecutar_operacion(servicio.crear_ejecucion,db,datos)
    background_tasks.add_task(servicio.ejecutar_auditoria,ejecucion.run_id)
    return ejecucion


@router.get("/runs",response_model=list[AuditRunOut])
def listar_auditorias(
    grupo_resolutor: str | None = None,
    limite: int = Query(default=50,ge=1,le=200),
    offset: int = Query(default=0,ge=0),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.listar_ejecuciones,db,
        grupo_resolutor=grupo_resolutor,limite=limite,offset=offset,
    )


@router.get("/runs/{run_id}",response_model=AuditRunOut)
def obtener_auditoria(
    run_id: int = Path(ge=1),
    grupo_resolutor: str | None = None,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_ejecucion,db,
        run_id=run_id,grupo_resolutor=grupo_resolutor,
    )


@router.get("/summary",response_model=AuditSummaryOut)
def obtener_resumen(
    run_id: int | None = Query(default=None,gt=0),
    grupo_resolutor: str | None = None,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_resumen,db,
        run_id=run_id,grupo_resolutor=grupo_resolutor,
    )


@router.get("/tickets",response_model=AuditTicketListOut)
def obtener_tickets(
    run_id: int | None = Query(default=None,gt=0),
    grupo_resolutor: str | None = None,
    resultado: CategorizationStatus | None = None,
    nombre_resolutor: str | None = None,
    ticket_id: str | None = None,
    proyecto: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    page: int = Query(default=1,ge=1),
    page_size: int = Query(default=25,ge=1,le=200),
    db: Session = Depends(get_sqlserver_db),
):
    filtros = AuditTicketFilters(
        run_id=run_id,
        grupo_resolutor=grupo_resolutor,
        resultado=resultado,
        nombre_resolutor=nombre_resolutor,
        ticket_id=ticket_id,
        proyecto=proyecto,
        desde=desde,
        hasta=hasta,
        page=page,
        page_size=page_size,
    )

    return _ejecutar_operacion(servicio.obtener_tickets,db,filtros)


@router.get("/resolvers",response_model=AuditResolverListOut)
def obtener_resolutores(
    run_id: int | None = Query(default=None,gt=0),
    grupo_resolutor: str | None = None,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_resolutores,db,
        run_id=run_id,grupo_resolutor=grupo_resolutor,
    )


@router.get("/categories",response_model=AuditCategoryListOut)
def obtener_categorias(
    grupo_resolutor: str | None = None,
    limite: int = Query(default=200,ge=1,le=1000),
    offset: int = Query(default=0,ge=0),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_categorias,db,
        grupo_resolutor=grupo_resolutor,limite=limite,offset=offset,
    )



# AGRUPACIONES DE AUDITORÍAS

# 1. CREAR AGRUPACIÓN

@router.post(
    "/groups",
    response_model=AuditGroupOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_grupo_auditoria(
    datos: AuditGroupCreate,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.crear_grupo,
        db,
        datos,
    )


# 2. LISTAR AGRUPACIONES

@router.get(
    "/groups",
    response_model=list[AuditGroupOut],
)
def listar_grupos_auditoria(
    grupo_resolutor: str | None = None,
    limite: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.listar_grupos,
        db,
        grupo_resolutor=grupo_resolutor,
        limite=limite,
        offset=offset,
    )


# 3. OBTENER AGRUPACIÓN POR ID

@router.get(
    "/groups/{group_id}",
    response_model=AuditGroupOut,
)
def obtener_grupo_auditoria(
    group_id: int = Path(ge=1),
    grupo_resolutor: str | None = None,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_grupo,
        db,
        group_id=group_id,
        grupo_resolutor=grupo_resolutor,
    )


# 4. OBTENER EJECUCIONES DE UNA AGRUPACIÓN

@router.get(
    "/groups/{group_id}/runs",
    response_model=list[AuditRunOut],
)
def listar_ejecuciones_agrupadas(
    group_id: int = Path(ge=1),
    grupo_resolutor: str | None = None,
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.listar_ejecuciones_grupo,
        db,
        group_id=group_id,
        grupo_resolutor=grupo_resolutor,
    )


# 5. OBTENER KPIs ACUMULADOS


# 5. KPIs ACUMULADOS CON FILTROS
@router.get(
    "/groups/{group_id}/summary",
    response_model=AuditGroupSummaryOut,
)
def obtener_resumen_agrupado(
    group_id: int = Path(ge=1),
    filtros: AuditDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_resumen_grupo,
        db,
        group_id=group_id,
        filtros=filtros,
    )


# 6. EXPLORADOR DE TICKETS CON FILTROS
@router.get(
    "/groups/{group_id}/tickets",
    response_model=AuditGroupTicketListOut,
)
def obtener_tickets_agrupados(
    group_id: int = Path(ge=1),
    filtros: AuditDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_sqlserver_db),
):
    filtros_tickets = AuditTicketFilters(
        **filtros.model_dump(),
        page=page,
        page_size=page_size,
    )

    return _ejecutar_operacion(
        servicio.obtener_tickets_grupo,
        db,
        group_id,
        filtros_tickets,
    )


# 7. RESOLUTORES CON FILTROS
@router.get(
    "/groups/{group_id}/resolvers",
    response_model=AuditGroupResolverListOut,
)
def obtener_resolutores_agrupados(
    group_id: int = Path(ge=1),
    filtros: AuditDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_resolutores_grupo,
        db,
        group_id=group_id,
        filtros=filtros,
    )


# 8. ESTADÍSTICAS MENSUALES CON FILTROS
@router.get(
    "/groups/{group_id}/monthly-stats",
    response_model=AuditGroupMonthlyStatsOut,
)
def obtener_estadisticas_mensuales_agrupadas(
    group_id: int = Path(ge=1),
    filtros: AuditDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_estadisticas_mensuales_grupo,
        db,
        group_id=group_id,
        filtros=filtros,
    )


# 9. DISTRIBUCIÓN POR MOTIVO RESOLUCIÓN CON FILTROS
@router.get(
    "/groups/{group_id}/resolution-reasons",
    response_model=AuditGroupResolutionReasonListOut,
)
def obtener_motivos_resolucion_agrupados(
    group_id: int = Path(ge=1),
    filtros: AuditDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_distribucion_motivo_resolucion_grupo,
        db,
        group_id=group_id,
        filtros=filtros,
    )
 

# 10. OPCIONES PARA FILTROS Y BUSCADORES
@router.get(
    "/groups/{group_id}/filter-options",
    response_model=AuditGroupFilterOptionsOut,
)
def obtener_opciones_filtros_agrupados(
    group_id: int = Path(ge=1),
    db: Session = Depends(get_sqlserver_db),
):
    return _ejecutar_operacion(
        servicio.obtener_opciones_filtros_grupo,
        db,
        group_id=group_id,
    )
