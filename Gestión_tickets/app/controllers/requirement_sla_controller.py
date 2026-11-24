
from fastapi import (APIRouter,Depends,File,HTTPException, Query,UploadFile,)
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.sla_import_schema import (RequirementSLACondicionDiaOut, RequirementSLACumplimientoHorarioOut, RequirementSLACumplimientoOut, RequirementSLACumplimientoPrioridadOut, RequirementSLACumplimientoTipoOut, RequirementSLAExploradorTiposOut, RequirementSLAParetoCategoriaOut, RequirementSLAParetoGraficoOut, RequirementSLATop10CategoriaOut, SLAImportOut,RequirementSLAKPIOut,RequirementSLAFiltersOut,RequirementSLASolucionTendenciaItem,RequirementSLAVolumenItem,RequirementSLAProyectoItem,RequirementSLAParticipacionProyectoItem,RequirementSLAParetoItem,RequirementSLATendenciaItem,RequirementSLAResolutorItem,)
from app.schemas.sla_import_schema import (RequirementSLADashboardFilters,RequirementSLATicketsOut)
from app.schemas.resolutor_dashboard_schema import (
    ResolverRendimientoOut, ResolverTicketsPorResolutorOut,
)
from app.services import (requirement_sla_service,)
from datetime import date
from typing import Literal, Optional

router = APIRouter(prefix="/requirement-sla", tags=["Requirement SLA"])

@router.post("/import", response_model=SLAImportOut)
def importar_requirement_sla(archivo: UploadFile = File(...), db: Session = Depends(get_sqlserver_db)):
    try:
        return requirement_sla_service.importar(db,archivo.file,archivo.filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@router.get("/filters", response_model=RequirementSLAFiltersOut)
def obtener_opciones_filtros(db: Session = Depends(get_sqlserver_db),):
    return requirement_sla_service.obtener_opciones_filtros(db)


#Schema de Filtros del Dashboard

def _obtener_filtros_dashboard(
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    prioridad: str | None = None,
    categoria: str | None = None,
    proyecto: str | None = None,
    tipo_requerimiento: Optional[list[str]] = Query(default=None),
    condicion_dia: Literal["Lun-Vie","Fuera Horario","Fin Sem."] | None = None,
    sla_solucion_condicion: Literal["Cumplido","No cumplido"] | None = None,
    periodo: str | None = Query(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    ),
    proyectos_excluidos: Optional[list[str]] = Query(default=None),
    nombre_resolutor: str | None = Query(default=None, max_length=150),
    ticket_id: str | None = Query(default=None, max_length=20)

) -> RequirementSLADashboardFilters:
    return RequirementSLADashboardFilters(
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        prioridad=prioridad,
        categoria=categoria,
        proyecto=proyecto,
        tipo_requerimiento=tipo_requerimiento or [],
        condicion_dia=condicion_dia,
        sla_solucion_condicion=sla_solucion_condicion,
        periodo=periodo,
        proyectos_excluidos=proyectos_excluidos or [],
        nombre_resolutor=nombre_resolutor,
        ticket_id=ticket_id
    )


#KPIs
@router.get("/kpis", response_model=RequirementSLAKPIOut)
def obtener_kpis(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_kpis(
        db,
        filtros
    )


#SLA Solución: Cumplidos vs Incumplidos
@router.get("/sla-solucion-tendencia", response_model=list[RequirementSLASolucionTendenciaItem])
def obtener_sla_solucion_tendencia(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_sla_solucion_tendencia(
        db,
        filtros
    )


#Volumen de Requerimientos
@router.get("/volumen-requerimientos", response_model=list[RequirementSLAVolumenItem])
def obtener_volumen_requerimientos(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_volumen_requerimientos(
        db,
        filtros
    )


#Explorador por Proyectos
@router.get("/proyectos", response_model=list[RequirementSLAProyectoItem])
def obtener_proyectos(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_proyectos(
        db,
        filtros
    )


#Pareto de Tipos de Requerimiento
@router.get("/pareto-requerimientos", response_model=list[RequirementSLAParetoItem])
def obtener_pareto_requerimientos(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_pareto_requerimientos(
        db,
        filtros
    )


#Tendencia de Requerimientos
@router.get("/tendencia-requerimientos", response_model=list[RequirementSLATendenciaItem])
def obtener_tendencia_requerimientos(
    ranking_desde: int = 1,
    ranking_hasta: int = 5,
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return requirement_sla_service.obtener_tendencia_requerimientos(
        db,
        filtros,
        ranking_desde=ranking_desde,
        ranking_hasta=ranking_hasta
    )


#Desempeño por Resolutor
@router.get("/resolutores", response_model=list[RequirementSLAResolutorItem])
def obtener_resolutores(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_resolutores(
        db,
        filtros
    )


#Participación por Proyecto
@router.get("/participacion-proyectos", response_model=list[RequirementSLAParticipacionProyectoItem])
def obtener_participacion_proyectos(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_participacion_proyectos(
        db,
        filtros
    )


#Explorador de Tipos de Requerimientos
@router.get("/explorador-tipos",response_model=RequirementSLAExploradorTiposOut)
def obtener_explorador_tipos(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_explorador_tipos(
        db,
        filtros
    )
    
    
#Distribución por Condición Día
@router.get("/distribucion-condicion-dia", response_model=RequirementSLACondicionDiaOut)
def obtener_distribucion_condicion_dia(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_distribucion_condicion_dia(
        db,
        filtros
    )


#Porcentaje de Cumplimiento de SLA
@router.get("/porcentaje-cumplimiento-sla",response_model=RequirementSLACumplimientoOut)
def obtener_porcentaje_cumplimiento_sla(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_porcentaje_cumplimiento_sla(
        db,
        filtros
    )


#Cumplimiento de SLA por Horario - Condición Día
@router.get("/cumplimiento-sla-horario",response_model=RequirementSLACumplimientoHorarioOut)
def obtener_cumplimiento_sla_horario(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_cumplimiento_sla_horario(
        db,
        filtros
    )
    

#Cumplimiento de SLA por Prioridad
@router.get("/cumplimiento-sla-prioridad",response_model=RequirementSLACumplimientoPrioridadOut)
def obtener_cumplimiento_sla_prioridad(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_cumplimiento_sla_prioridad(
        db,
        filtros
    )    


#Top 10 - Cumplimiento de SLA por Categoría
@router.get("/top10-cumplimiento-sla-categoria",response_model=RequirementSLATop10CategoriaOut)
def obtener_top10_cumplimiento_sla_categoria(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_top10_cumplimiento_sla_categoria(
        db,
        filtros
    )
    

#Cumplimiento de SLA por Tipo
@router.get("/cumplimiento-sla-tipo",response_model=RequirementSLACumplimientoTipoOut)
def obtener_cumplimiento_sla_tipo(
    limite: int | None = Query(
        default=None,
        ge=1,
        le=100
    ),
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_cumplimiento_sla_tipo(
        db,
        filtros,
        limite=limite
    )


#Análisis de Pareto de Incumplimientos por Categoría
@router.get("/pareto-sla-categorias",response_model=RequirementSLAParetoCategoriaOut)
def obtener_pareto_sla_categorias(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_pareto_sla_categorias(
        db,
        filtros
    )
    

#Cant Req. No Cumplidos y % Acum. por Categorización - Categoría
@router.get("/pareto-sla-categorias-grafico",response_model=RequirementSLAParetoGraficoOut)
def obtener_pareto_sla_categorias_grafico(
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):
    return requirement_sla_service.obtener_pareto_sla_categorias_grafico(
        db,
        filtros
    )


# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS SLA
@router.get(
    "/tickets",
    response_model=RequirementSLATicketsOut
)
def obtener_tickets(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db)
):

    return requirement_sla_service.obtener_tickets(
        db,
        filtros,
        pagina=pagina,
        tamano=tamano
    )



# PRD 06 - RESOLUTORES: tabla mensual paginada y ranking.
@router.get("/rendimiento-resolutores", response_model=ResolverRendimientoOut)
def obtener_rendimiento_resolutores(
    pagina: int = Query(1, ge=1),
    tamano: int = Query(20, ge=1, le=100),
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return requirement_sla_service.obtener_rendimiento_resolutores(
        db, filtros, pagina=pagina, tamano=tamano
    )


@router.get("/tickets-por-resolutor", response_model=ResolverTicketsPorResolutorOut)
def obtener_tickets_por_resolutor(
    tamano: int = Query(5, ge=1, le=20),
    filtros: RequirementSLADashboardFilters = Depends(_obtener_filtros_dashboard),
    db: Session = Depends(get_sqlserver_db),
):
    return requirement_sla_service.obtener_tickets_por_resolutor(
        db, filtros, limite=tamano
    )
