from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field


class SLAImportOut(BaseModel):
    tipo: str
    tabla_staging: str
    tabla_destino: str
    filas_excel: int 
    filas_procesadas: int
    filas_staging: int
    duplicados: int
    nuevos: int = 0
    modificados: int = 0
    sin_cambios: int = 0
    mensaje: str
    
#INCIDENTES SLA    
class IncidentSLAKPIOut(BaseModel):
    total_tickets: int
    sla_respuesta: float
    sla_solucion: float
    ola_respuesta: float
    ola_solucion: float

class IncidentSLAFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    grupos_resolutores: list[str]
    prioridades: list[str]

    proyectos: list[str]
    tipos_incidente: list[str]
    
class IncidentSLAInsightsOut(BaseModel):
    estado_sla: str
    principal_foco: str
    prioridad_vigilar: str
    
class IncidentSLATrendItem(BaseModel):
    mes: str
    cumplimiento: float
    objetivo: float
    medibles: int
    
class IncidentSLAVolumenItem(BaseModel):
    mes: str
    tickets: int
    media_movil_3m: float | None = None
    
class IncidentSLAProyectoItem(BaseModel):
    proyecto: str | None
    tickets: int
    medibles: int
    sin_medicion: int
    cumple: int
    incumple: int
    sla_solucion: float
    sla_respuesta: float
    porcentaje_volumen: float
    
class IncidentSLAParetoItem(BaseModel):
    ranking: int
    tipo_incidente: str | None
    tickets: int
    porcentaje: float
    porcentaje_acumulado: float
    
class IncidentSLATendenciaPunto(BaseModel):
    mes: str
    tickets: int

class IncidentSLATendenciaSerie(BaseModel):
    ranking: int
    tipo_incidente: str | None
    puntos: list[IncidentSLATendenciaPunto]

class IncidentSLATendenciaOut(BaseModel):
    grupo: str
    series: list[IncidentSLATendenciaSerie]
    
class IncidentSLAResolutorItem(BaseModel):
    resolutor: str | None
    tickets: int
    sla: float
    
    

class IncidentSLADashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    grupo_resolutor: str | None = None
    prioridad: str | None = None
    proyecto: str | None = None
    tipo_incidente: list[str] = Field(default_factory=list)
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    )
    proyectos_excluidos: list[str] = Field(default_factory=list)
    ticket_id: str | None = Field(
        default=None,
        max_length=20
    )
    
    

class IncidentSLATicketItem(BaseModel):
    Ticket_ID: str
    Proyecto: str | None = None
    Descripcion: str | None = None
    Detalle: str | None = None
    Fecha_Creacion: datetime | None = None
    Fecha_Resolucion: datetime | None = None
    Estado: str | None = None
    Codigo_Motivo: str | None = None
    Prioridad: str | None = None
    Usuario_Resolutor: str | None = None
    Grupo_Resolutor: str | None = None
    Categorizacion_Clase: str | None = None
    Categorizacion_Categoria: str | None = None
    Categorizacion_Tipo: str | None = None
    SLA_Respuesta_Condicion: str | None = None
    OLA_Respuesta_Condicion: str | None = None
    SLA_Solucion_Condicion: str | None = None
    OLA_Solucion_Condicion: str | None = None
    Condicion_dia: str


class IncidentSLATicketsOut(BaseModel):
    tickets: list[IncidentSLATicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int

    
#REQUERIMIENTOS SLA
class RequirementSLAKPIOut(BaseModel):

    # KPIS EXISTENTES
    total_tickets: int
    sla_respuesta: float
    sla_solucion: float
    ola_respuesta: float
    ola_solucion: float

    # NUEVOS KPIS
    cant_req_cumplidos: int
    cant_req_no_cumplidos: int
    porcentaje_cumpl_req: float


class RequirementSLAFiltersOut(BaseModel):

    fecha_min: date | None = None
    fecha_max: date | None = None
    grupos_resolutores: list[str]
    prioridades: list[str]
    categorias: list[str]
    proyectos: list[str]
    tipos_requerimiento: list[str]
    condiciones_dia: list[str]


class RequirementSLASolucionTendenciaItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    cumplidos: int
    incumplidos: int


class RequirementSLAVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int
    tendencia: float


class RequirementSLAProyectoItem(BaseModel):
    proyecto: str | None
    tickets: int
    medibles: int
    sin_medicion: int
    cumple: int
    incumple: int
    sla_solucion: float
    sla_respuesta: float
    porcentaje_volumen: float


class RequirementSLAParticipacionProyectoItem(BaseModel):
    proyecto: str | None
    tickets: int
    participacion: float


class RequirementSLAParetoItem(BaseModel):
    ranking: int
    tipo_requerimiento: str | None
    cantidad: int
    porcentaje: float
    porcentaje_acumulado: float


class RequirementSLATendenciaItem(BaseModel):
    ranking: int
    tipo_requerimiento: str | None
    anio: int
    mes: int
    periodo: str
    tickets: int


class RequirementSLAResolutorItem(BaseModel):
    resolutor: str | None
    cantidad: int
    
# EXPLORADOR DE TIPOS DE REQUERIMIENTOS - SLA

class RequirementSLAExploradorPeriodo(BaseModel):
    anio: int
    mes: int
    periodo: str

class RequirementSLAExploradorMetricas(BaseModel):
    tot: int
    c: int
    i: int
    porcentaje_inc: float

class RequirementSLAExploradorMensual(
    RequirementSLAExploradorPeriodo,
    RequirementSLAExploradorMetricas
):
    pass

class RequirementSLAExploradorFila(BaseModel):
    tipo_requerimiento: str
    mensual: list[RequirementSLAExploradorMensual]
    total: RequirementSLAExploradorMetricas

class RequirementSLAExploradorTotal(BaseModel):
    mensual: list[RequirementSLAExploradorMensual]
    total: RequirementSLAExploradorMetricas

class RequirementSLAExploradorTiposOut(BaseModel):
    periodos: list[RequirementSLAExploradorPeriodo]
    filas: list[RequirementSLAExploradorFila]
    total_general: RequirementSLAExploradorTotal
    
# DISTRIBUCION POR CONDICION DIA
class RequirementSLACondicionDiaItem(BaseModel):
    condicion_dia: str
    tickets: int
    porcentaje: float

class RequirementSLACondicionDiaOut(BaseModel):
    total_tickets: int
    distribucion: list[RequirementSLACondicionDiaItem]
    
# PORCENTAJE DE CUMPLIMIENTO SLA
class RequirementSLACumplimientoItem(BaseModel):
    condicion: str
    tickets: int
    porcentaje: float

class RequirementSLACumplimientoOut(BaseModel):
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int
    otros: int
    porcentaje_cumpl_req: float
    distribucion: list[RequirementSLACumplimientoItem]
    
# CUMPLIMIENTO SLA POR HORARIO
class RequirementSLACumplimientoHorarioItem(BaseModel):
    condicion_dia: str
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int

class RequirementSLACumplimientoHorarioOut(BaseModel):
    total_tickets: int
    total_cumplidos: int
    total_incumplidos: int
    total_cancelados: int
    distribucion: list[RequirementSLACumplimientoHorarioItem]
    
# CUMPLIMIENTO SLA POR PRIORIDAD
class RequirementSLACumplimientoPrioridadItem(BaseModel):
    prioridad: str
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int

class RequirementSLACumplimientoPrioridadOut(BaseModel):
    total_tickets: int
    total_cumplidos: int
    total_incumplidos: int
    total_cancelados: int
    distribucion: list[RequirementSLACumplimientoPrioridadItem]
    
# TOP 10 CUMPLIMIENTO SLA POR CATEGORIA
class RequirementSLATop10CategoriaItem(BaseModel):
    categoria: str
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int

class RequirementSLATop10CategoriaOut(BaseModel):
    total_tickets: int
    total_cumplidos: int
    total_incumplidos: int
    total_cancelados: int
    distribucion: list[RequirementSLATop10CategoriaItem]
    
    
# CUMPLIMIENTO SLA POR TIPO DE REQUERIMIENTO
class RequirementSLACumplimientoTipoItem(BaseModel):
    tipo_requerimiento: str
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int

class RequirementSLACumplimientoTipoOut(BaseModel):
    total_tickets: int
    total_cumplidos: int
    total_incumplidos: int
    total_cancelados: int
    distribucion: list[RequirementSLACumplimientoTipoItem]    
    
    
# PARETO SLA POR CATEGORIAS
class RequirementSLAParetoCategoriaItem(BaseModel):
    categoria: str
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int
    ranking: int
    incumplidos_acumulados: int
    porcentaje_req: float
    porcentaje_acumulado: float
    semaforo: str


class RequirementSLAParetoCategoriaTotal(BaseModel):
    total_tickets: int
    cumplidos: int
    incumplidos: int
    cancelados: int
    incumplidos_acumulados: int
    porcentaje_req: float
    porcentaje_acumulado: float

class RequirementSLAParetoCategoriaOut(BaseModel):
    total_categorias: int
    total_general: RequirementSLAParetoCategoriaTotal
    filas: list[RequirementSLAParetoCategoriaItem]
    
    
# GRAFICO PARETO SLA POR CATEGORIAS
class RequirementSLAParetoGraficoItem(BaseModel):
    categoria: str
    ranking: int
    cumplidos: int
    incumplidos: int
    incumplidos_acumulados: int
    porcentaje_req: float
    porcentaje_acumulado: float
    semaforo: str

class RequirementSLAParetoGraficoOut(BaseModel):
    total_categorias: int
    categorias_con_incumplimientos: int
    total_incumplimientos: int
    categorias_para_80: int
    porcentaje_categorias_para_80: float
    porcentaje_incumplimientos_cubiertos: float
    serie: list[RequirementSLAParetoGraficoItem]
    
    

class RequirementSLADashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    grupo_resolutor: str | None = None
    prioridad: str | None = None
    categoria: str | None = None
    proyecto: str | None = None
    tipo_requerimiento: list[str] = Field(default_factory=list)
    condicion_dia: Literal[
        "Lun-Vie",
        "Fuera Horario",
        "Fin Sem."
    ] | None = None
    sla_solucion_condicion: Literal[
        "Cumplido",
        "No cumplido"
    ] | None = None
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    )
    proyectos_excluidos: list[str] = Field(default_factory=list)
    ticket_id: str | None = Field(
        default=None,
        max_length=20
    )




# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS SLA
class RequirementSLATicketItem(BaseModel):
    Ticket_ID: str
    Proyecto: str | None = None
    Descripcion: str | None = None
    Detalle: str | None = None
    Fecha_Creacion: datetime | None = None
    Fecha_Resolucion: datetime | None = None
    Estado: str | None = None
    Codigo_Motivo: str | None = None
    Prioridad: str | None = None
    Usuario_Resolutor: str | None = None
    Grupo_Resolutor: str | None = None
    Categorizacion_Clase: str | None = None
    Categorizacion_Categoria: str | None = None
    Categorizacion_Tipo: str | None = None
    SLA_Respuesta_Condicion: str | None = None
    OLA_Respuesta_Condicion: str | None = None
    SLA_Solucion_Condicion: str | None = None
    OLA_Solucion_Condicion: str | None = None
    Condicion_dia: str


class RequirementSLATicketsOut(BaseModel):
    tickets: list[RequirementSLATicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int
