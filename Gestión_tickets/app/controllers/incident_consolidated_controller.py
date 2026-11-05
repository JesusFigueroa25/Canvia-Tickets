
from datetime import date
from fastapi import (APIRouter,Depends,File,HTTPException, Query,UploadFile,)
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.consolidated_import_schema import (ConsolidatedImportOut, IncidentConsolidatedDetalleEventosOut, IncidentConsolidatedExploradorDescripcionesOut, IncidentConsolidatedFiltersOut, IncidentConsolidatedIncidentesPorcentajesOut, IncidentConsolidatedKPIOut, IncidentConsolidatedPrioridadItem, IncidentConsolidatedPrioridadMensualItem, IncidentConsolidatedProyectoItem, IncidentConsolidatedRendimientoOut, IncidentConsolidatedTicketsPorResolutorOut, IncidentConsolidatedTipoItem, IncidentConsolidatedTopDescripcionProyectoOut, IncidentConsolidatedTopDetallesOut, IncidentConsolidatedTopProyectosOut, IncidentConsolidatedVolumenItem,)
from app.schemas.consolidated_import_schema import (IncidentConsolidatedDashboardFilters, IncidentConsolidatedTicketsOut)
from app.services import (incident_consolidated_service,)

router = APIRouter(prefix="/incident-consolidated", tags=["Incident Consolidated"])


@router.post("/import", response_model=ConsolidatedImportOut)
def importar_incident_consolidated(archivo: UploadFile = File(...), db: Session = Depends(get_sqlserver_db)):
    try:
        return incident_consolidated_service.importar(db, archivo.file, archivo.filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/filters",response_model=IncidentConsolidatedFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db)):
    return incident_consolidated_service.obtener_opciones_filtros(db)


#--------------------------------------------------------------------
#Schema de Filtros del Dashboard
#--------------------------------------------------------------------

def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    prioridad: str | None = None,
    motivo_estado: str | None = None,
    motivo_resolucion: str | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
    nombre_resolutor: str | None = None,
    descripcion: str | None = None,
    periodo: str | None = Query(default=None, pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"),
    tipo_incidente: list[str] | None = Query(default=None),
    detalle_id: str | None = Query(default=None, max_length=20),
    proyectos_excluidos: list[str] | None = Query(default=None),
    ticket_id: str | None = Query(default=None, max_length=20)
) -> IncidentConsolidatedDashboardFilters:

    return IncidentConsolidatedDashboardFilters(
        desde=desde,
        hasta=hasta,
        prioridad=prioridad,
        motivo_estado=motivo_estado,
        motivo_resolucion=motivo_resolucion,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
        nombre_resolutor=nombre_resolutor,
        descripcion=descripcion,
        periodo=periodo,
        tipo_incidente=tipo_incidente or [],
        detalle_id=detalle_id,
        proyectos_excluidos=proyectos_excluidos or [],
        ticket_id=ticket_id
    )



#--------------------------------------------------------------------
#KPIs
#--------------------------------------------------------------------

@router.get("/kpis",response_model=IncidentConsolidatedKPIOut)
def obtener_kpis(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_kpis(
        db,filtros
    )


#--------------------------------------------------------------------
#Gráficos Principales
#--------------------------------------------------------------------

#Nro Incidentes por Mes
@router.get("/volumen-mensual",response_model=list[IncidentConsolidatedVolumenItem])
def obtener_volumen_mensual(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_volumen_mensual(
        db,filtros
    )


#Distribución por Tipo de Incidente
@router.get("/tipos",response_model=list[IncidentConsolidatedTipoItem])
def obtener_tipos(
    limite: int = Query(10, ge=1, le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_tipos(
        db,filtros,limite=limite
    )


#--------------------------------------------------------------------
#Resolutor
#--------------------------------------------------------------------

#Rendimiento por Resolutor
@router.get("/rendimiento-resolutores",response_model=IncidentConsolidatedRendimientoOut)
def obtener_rendimiento_resolutores(
    pagina: int = Query(1,ge=1),
    tamano: int = Query(20,ge=1,le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_rendimiento_resolutores(
        db,filtros,pagina=pagina,tamano=tamano
    )


#Número de Tickets por Resolutor
@router.get("/tickets-por-resolutor",response_model=IncidentConsolidatedTicketsPorResolutorOut)
def obtener_tickets_por_resolutor(
    tamano: int = Query(5, ge=1, le=20),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_tickets_por_resolutor(
        db,filtros,limite=tamano
    )


#--------------------------------------------------------------------
#Empresa
#--------------------------------------------------------------------

#Explorador por Proyectos
@router.get("/proyectos",response_model=list[IncidentConsolidatedProyectoItem])
def obtener_proyectos(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_proyectos(
        db,filtros
    )


#Top 10: Tickets por Proyecto y Mes
@router.get("/top-proyectos",response_model=IncidentConsolidatedTopProyectosOut)
def obtener_top_proyectos(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_top_proyectos(
        db,filtros
    )


#N.º de Incidencias por Prioridad
@router.get("/prioridad-mensual",response_model=list[IncidentConsolidatedPrioridadMensualItem])
def obtener_prioridad_mensual(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_prioridad_mensual(
        db,filtros
    )


#--------------------------------------------------------------------
#Alertas
#--------------------------------------------------------------------

#Explorador por Descripciones x Mes
@router.get("/explorador-descripciones",response_model=IncidentConsolidatedExploradorDescripcionesOut)
def obtener_explorador_descripciones(
    buscar: str | None = None,
    pagina: int = Query(1,ge=1),
    tamano: int = Query(10,ge=1,le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_explorador_descripciones(
        db,filtros,pagina=pagina,tamano=tamano,buscar=buscar
    )


#Tabla Detalle de Eventos Técnicos
@router.get("/detalle-eventos-tecnicos",response_model=IncidentConsolidatedDetalleEventosOut)
def obtener_detalle_eventos_tecnicos(
    buscar: str | None = None,
    pagina: int = Query(1,ge=1),
    tamano: int = Query(10,ge=1,le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_detalle_eventos_tecnicos(
        db,filtros,pagina=pagina,tamano=tamano,buscar=buscar
    )


#N.º de Incidentes x Porcentajes
@router.get("/incidentes-porcentajes",response_model=IncidentConsolidatedIncidentesPorcentajesOut)
def obtener_incidentes_porcentajes(
    limite: int = Query(20,ge=1,le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_incidentes_porcentajes(
        db,filtros,limite=limite
    )


#--------------------------------------------------------------------
#Detalle Alertas
#--------------------------------------------------------------------

#Distribución por Prioridad
@router.get("/prioridades",response_model=list[IncidentConsolidatedPrioridadItem])
def obtener_prioridades(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_prioridades(
        db,filtros
    )


#TOP 10 Tickets por Descripción y Proyecto
@router.get("/top-descripciones-proyectos",response_model=IncidentConsolidatedTopDescripcionProyectoOut)
def obtener_top_descripciones_proyectos(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_top_descripciones_proyectos(
        db,filtros
    )


#Top 10 Tickets por Detalle
@router.get("/top-detalles",response_model=IncidentConsolidatedTopDetallesOut)
def obtener_top_detalles(
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return incident_consolidated_service.obtener_top_detalles(
        db,filtros
    )


# TABLA PAGINADA - DETALLE DE TICKETS

@router.get(
    "/tickets",
    response_model=IncidentConsolidatedTicketsOut
)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: IncidentConsolidatedDashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):

    return incident_consolidated_service.obtener_tickets(
        db,
        filtros,
        pagina=pagina,
        tamano=tamano
    )
