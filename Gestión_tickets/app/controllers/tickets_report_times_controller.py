"""API para importar el reporte de acciones de ocupabilidad."""
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.etl.validator import ETLValidationError
from app.schemas.tickets_report_times_schema import TicketsReportTimesImportOut
from app.services import tickets_report_times_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tickets-report-times",
    tags=["Tickets Report Times"],
)

from datetime import date
from fastapi import Query
from app.schemas.tickets_report_times_schema import (
    TicketsReportTimesDashboardFilters,
    TicketsReportTimesFiltersOut,
    TicketsReportTimesKPIOut,
    TicketsReportTimesVolumenItem,
    TicketsReportTimesResolverTablaOut,
    TicketsReportTimesProjectTablaOut,
    TicketsReportTimesGraficoOut,
)



@router.post("/import", response_model=TicketsReportTimesImportOut)
def importar_tickets_report_times(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_sqlserver_db),
):
    nombre = Path(archivo.filename or "").name
    if not nombre:
        raise HTTPException(status_code=400, detail="Debe seleccionar un archivo Excel")
    if Path(nombre).suffix.lower() not in (".xlsx", ".xlsm"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .xlsx o .xlsm")

    try:
        archivo.file.seek(0, 2)
        tamano = archivo.file.tell()
        archivo.file.seek(0)
        if tamano > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="El archivo supera los 50 MB")
        if tamano == 0:
            raise HTTPException(status_code=400, detail="El archivo está vacío")

        return tickets_report_times_service.importar(
            db=db, archivo=archivo.file, nombre_archivo=nombre
        )
    except HTTPException:
        raise
    except (ETLValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error interno al importar reporte de tiempos")
        raise HTTPException(
            status_code=500,
            detail="Error interno durante la importación. Revise los logs del backend.",
        ) from exc
    finally:
        archivo.file.close()


def _filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = Query(default="BASE DE DATOS Y EBS", max_length=150),
    periodo: str | None = Query(default=None, pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"),
    proyectos: list[str] | None = Query(default=None),
    todos_proyectos: bool = False,
) -> TicketsReportTimesDashboardFilters:
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=422, detail="La fecha Desde no puede superar Hasta")
    if proyectos and len(proyectos) > 200:
        raise HTTPException(status_code=422, detail="No se permiten más de 200 proyectos")
    if proyectos and any(len(p) > 200 for p in proyectos):
        raise HTTPException(status_code=422, detail="Un proyecto supera 200 caracteres")
    return TicketsReportTimesDashboardFilters(
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        periodo=periodo,
        proyectos=proyectos or [],
        todos_proyectos=todos_proyectos,
    )


@router.get("/filters", response_model=TicketsReportTimesFiltersOut)
def obtener_filtros(
    grupo_resolutor: str | None = Query(default="BASE DE DATOS Y EBS", max_length=150),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_opciones_filtros(db, grupo_resolutor)


@router.get("/kpis", response_model=TicketsReportTimesKPIOut)
def obtener_kpis(
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_kpis(db, filtros)


@router.get("/volumen-mensual", response_model=list[TicketsReportTimesVolumenItem])
def obtener_volumen_mensual(
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_volumen_mensual(db, filtros)


@router.get("/tiempos-resolutores", response_model=TicketsReportTimesResolverTablaOut)
def obtener_tiempos_resolutores(
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=25, ge=1, le=100),
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_tiempos_resolutores(
        db, filtros, pagina, tamano
    )


@router.get("/tiempos-resolutores-grafico", response_model=TicketsReportTimesGraficoOut)
def obtener_tiempos_resolutores_grafico(
    limite: int = Query(default=10, ge=1, le=30),
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_tiempos_resolutores_grafico(
        db, filtros, limite
    )


@router.get("/tiempos-proyectos", response_model=TicketsReportTimesProjectTablaOut)
def obtener_tiempos_proyectos(
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=25, ge=1, le=100),
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_tiempos_proyectos(
        db, filtros, pagina, tamano
    )


@router.get("/tiempos-proyectos-grafico", response_model=TicketsReportTimesGraficoOut)
def obtener_tiempos_proyectos_grafico(
    limite: int = Query(default=10, ge=1, le=30),
    filtros: TicketsReportTimesDashboardFilters = Depends(_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return tickets_report_times_service.obtener_tiempos_proyectos_grafico(
        db, filtros, limite
    )
