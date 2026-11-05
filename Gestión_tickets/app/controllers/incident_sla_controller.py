
from fastapi import (APIRouter,Depends,File,HTTPException,UploadFile,)
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.sla_import_schema import (IncidentSLAFiltersOut, IncidentSLAInsightsOut, IncidentSLAParetoItem, IncidentSLAProyectoItem, IncidentSLAResolutorItem, IncidentSLATendenciaOut, IncidentSLATrendItem, IncidentSLAVolumenItem, SLAImportOut, IncidentSLAKPIOut)
from app.services import (incident_sla_service,)
from app.schemas.sla_import_schema  import (IncidentSLADashboardFilters,IncidentSLATicketsOut)
from datetime import date
from typing import Optional
from fastapi import Query

router = APIRouter( prefix="/incident-sla",  tags=["Incident SLA"])

@router.post("/import", response_model=SLAImportOut)
def importar_incident_sla(archivo: UploadFile = File(...), db: Session = Depends(get_sqlserver_db)):
    try:
        return incident_sla_service.importar(db,archivo.file,archivo.filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    
@router.get("/filters", response_model=IncidentSLAFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return incident_sla_service.obtener_opciones_filtros(db)


#--------------------------------------------------------------------
#Schema de Filtros del Dashboard
#--------------------------------------------------------------------
def _obtener_filtros_dashboard(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    grupo_resolutor: Optional[str] = None,
    prioridad: Optional[str] = None,
    proyecto: Optional[str] = None,
    tipo_incidente: Optional[list[str]] = Query(default=None),
    periodo: Optional[str] = Query(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    ),
    proyectos_excluidos: Optional[list[str]] = Query(default=None),
    ticket_id: Optional[str] = Query(default=None, max_length=20)
) -> IncidentSLADashboardFilters:

    return IncidentSLADashboardFilters(
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        prioridad=prioridad,
        proyecto=proyecto,
        tipo_incidente=tipo_incidente or [],
        periodo=periodo,
        proyectos_excluidos=proyectos_excluidos or [],
        ticket_id=ticket_id
    )


#KPIs
@router.get("/kpis",response_model=IncidentSLAKPIOut)
def obtener_kpis(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_kpis(
        db=db,
        filtros=filtros
    )


#Insights
@router.get("/insights",response_model=IncidentSLAInsightsOut)
def obtener_insights(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_insights(
        db=db,
        filtros=filtros
    )


#--------------------------------------------------------------------
#Gráficos Principales
#--------------------------------------------------------------------

#SLA Solución: Tendencia
@router.get("/sla-solucion-tendencia",response_model=list[IncidentSLATrendItem])
def obtener_sla_solucion_tendencia(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_sla_solucion_tendencia(
        db=db,
        filtros=filtros
    )


#Volumen de Incidentes
@router.get("/volumen-incidentes",response_model=list[IncidentSLAVolumenItem])
def obtener_volumen_incidentes(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_volumen_incidentes(
        db=db,
        filtros=filtros
    )


#--------------------------------------------------------------------
#Empresa
#--------------------------------------------------------------------

#Explorador por Proyectos
@router.get("/proyectos",response_model=list[IncidentSLAProyectoItem])
def obtener_explorador_proyectos(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_explorador_proyectos(
        db=db,
        filtros=filtros
    )


#--------------------------------------------------------------------
#Alertas
#--------------------------------------------------------------------

#Pareto de Tipos de Incidente
@router.get("/pareto-tipos",response_model=list[IncidentSLAParetoItem])
def obtener_pareto_tipos(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_pareto_tipos(
        db=db,
        filtros=filtros
    )


#Tendencia de Incidentes    
@router.get("/tendencia-incidentes",response_model=IncidentSLATendenciaOut)
def obtener_tendencia_incidentes(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_tendencia_incidentes(
        db=db,
        filtros=filtros
    )


#--------------------------------------------------------------------
#Resolutores
#--------------------------------------------------------------------

#Desempeño por Resolutor
@router.get("/resolutores",response_model=list[IncidentSLAResolutorItem])
def obtener_desempeno_resolutores(
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_sla_service.obtener_desempeno_resolutores(
        db=db,
        filtros=filtros
    )


# TABLA PAGINADA - DETALLE DE TICKETS INCIDENTES SLA
@router.get(
    "/tickets",
    response_model=IncidentSLATicketsOut
)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: IncidentSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):

    return incident_sla_service.obtener_tickets(
        db,
        filtros,
        pagina=pagina,
        tamano=tamano
    )
