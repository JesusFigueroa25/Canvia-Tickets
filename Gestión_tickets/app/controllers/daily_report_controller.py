from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.services import daily_report_service

router = APIRouter(prefix="/daily-report", tags=["Daily Report"])

class DailyReportDashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    grupo_resolutor: str | None = None
    proyecto: str | None = None


class DailyReportFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    grupos_resolutores: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)


class DailyReportKPIOut(BaseModel):
    total_tickets: int
    total_incidentes: int
    total_requerimientos: int
    total_tareas: int


class DailyReportDayOut(BaseModel):
    fecha_accion: date
    total_tickets: int
    incidentes: int
    requerimientos: int
    tareas: int

class DailyReportSummaryOut(BaseModel):
    kpis: DailyReportKPIOut
    diario: list[DailyReportDayOut]


class DailyReportProyectoItem(BaseModel):
    proyecto: str
    cantidad: int


class DailyReportTopPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str


class DailyReportTopMesItem(BaseModel):
    periodo: str
    tickets: int


class DailyReportTopProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    mensual: list[DailyReportTopMesItem]


class DailyReportTopProyectosOut(BaseModel):
    periodos: list[DailyReportTopPeriodoItem]
    proyectos: list[DailyReportTopProyectoItem]


# FILTROS COMPARTIDOS
def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = Query(default=None, max_length=150),
    proyecto: str | None = Query(default=None, max_length=200),
) -> DailyReportDashboardFilters:
    if desde is not None and hasta is not None and desde > hasta:
        raise HTTPException(
            status_code=422,
            detail="La fecha Desde no puede ser posterior a Hasta",
        )

    return DailyReportDashboardFilters(
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
    )


def _consultar_resumen(db: Session, filtros: DailyReportDashboardFilters) -> dict:
    return daily_report_service.obtener_resumen(
        db,
        desde=filtros.desde,
        hasta=filtros.hasta,
        grupo_resolutor=filtros.grupo_resolutor,
        proyecto=filtros.proyecto,
    )


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/filters", response_model=DailyReportFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return daily_report_service.obtener_opciones_filtros(db)


@router.get("/resumen", response_model=DailyReportSummaryOut)
def obtener_resumen(
    filtros: DailyReportDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return _consultar_resumen(db, filtros)


@router.get("/kpis", response_model=DailyReportKPIOut)
def obtener_kpis(
    filtros: DailyReportDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return _consultar_resumen(db, filtros)["kpis"]


@router.get("/diario", response_model=list[DailyReportDayOut])
def obtener_diario(
    filtros: DailyReportDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return _consultar_resumen(db, filtros)["diario"]



@router.get("/proyectos",response_model=list[DailyReportProyectoItem])
def obtener_proyectos(
    filtros: DailyReportDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return daily_report_service.obtener_proyectos(
        db,
        desde=filtros.desde,
        hasta=filtros.hasta,
        grupo_resolutor=filtros.grupo_resolutor,
        proyecto=filtros.proyecto,
    )


@router.get("/top-proyectos",response_model=DailyReportTopProyectosOut)
def obtener_top_proyectos(
    filtros: DailyReportDashboardFilters = Depends(
        _obtener_filtros_dashboard
    ),
    db: Session = Depends(get_sqlserver_db),
):
    return daily_report_service.obtener_top_proyectos(
        db,
        desde=filtros.desde,
        hasta=filtros.hasta,
        grupo_resolutor=filtros.grupo_resolutor,
        proyecto=filtros.proyecto,
    )
