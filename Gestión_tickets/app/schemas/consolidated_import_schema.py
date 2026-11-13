from pydantic import BaseModel, Field
from datetime import date, datetime

class ConsolidatedImportOut(BaseModel):
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
    
#Incidentes Consolidado

class IncidentConsolidatedFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    prioridades: list[str]
    motivos_estado: list[str]
    motivos_resolucion: list[str]
    grupos_resolutores: list[str]
    proyectos: list[str]
    nombres_resolutores: list[str]
    tipos_incidente: list[str] = Field(default_factory=list)
    
class IncidentConsolidatedKPIOut(BaseModel):
    total_tickets: int
    total_proyectos: int
    alta_criticidad: int
    porcentaje_alta_criticidad: float
    
class IncidentConsolidatedVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int
    
class IncidentConsolidatedProyectoItem(BaseModel):
    proyecto: str
    cantidad: int    
    
class IncidentConsolidatedTipoItem(BaseModel):
    tipo_incidente: str
    cantidad: int
    
class IncidentConsolidatedPrioridadItem(BaseModel):
    prioridad: str
    cantidad: int
    
class IncidentConsolidatedTopPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str

class IncidentConsolidatedTopMesItem(BaseModel):
    periodo: str
    tickets: int

class IncidentConsolidatedTopProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    mensual: list[IncidentConsolidatedTopMesItem]

class IncidentConsolidatedTopProyectosOut(BaseModel):
    periodos: list[IncidentConsolidatedTopPeriodoItem]
    proyectos: list[IncidentConsolidatedTopProyectoItem]    
        
class IncidentConsolidatedPrioridadMesDetalleItem(BaseModel):
    prioridad: str
    cantidad: int
    porcentaje: float

class IncidentConsolidatedPrioridadMensualItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    total_tickets: int
    prioridades: list[IncidentConsolidatedPrioridadMesDetalleItem]
    
class IncidentConsolidatedRendimientoPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str

class IncidentConsolidatedRendimientoMesItem(BaseModel):
    periodo: str
    tickets: int

class IncidentConsolidatedRendimientoResolutorItem(BaseModel):
    nombre_resolutor: str
    total_tickets: int
    mensual: list[IncidentConsolidatedRendimientoMesItem]

class IncidentConsolidatedRendimientoOut(BaseModel):
    periodos: list[IncidentConsolidatedRendimientoPeriodoItem]
    resolutores: list[IncidentConsolidatedRendimientoResolutorItem]
    totales_mensuales: list[IncidentConsolidatedRendimientoMesItem]
    total_general: int
    total_resolutores: int
    pagina: int
    tamano: int
    total_paginas: int

class IncidentConsolidatedExploradorPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str

class IncidentConsolidatedExploradorMesItem(BaseModel):
    periodo: str
    tickets: int

class IncidentConsolidatedExploradorDescripcionItem(BaseModel):
    descripcion: str
    total_tickets: int
    mensual: list[IncidentConsolidatedExploradorMesItem]

class IncidentConsolidatedExploradorDescripcionesOut(BaseModel):
    periodos: list[IncidentConsolidatedExploradorPeriodoItem]
    descripciones: list[IncidentConsolidatedExploradorDescripcionItem]
    totales_mensuales: list[IncidentConsolidatedExploradorMesItem]
    total_general: int
    total_descripciones: int
    pagina: int
    tamano: int
    total_paginas: int
    
class IncidentConsolidatedDetalleEventoItem(BaseModel):
    detalle_id: str
    detalle: str
    total: int

class IncidentConsolidatedDetalleEventosOut(BaseModel):
    detalles: list[IncidentConsolidatedDetalleEventoItem]
    total_general: int
    total_detalles: int
    pagina: int
    tamano: int
    total_paginas: int
    
class IncidentConsolidatedIncidentesPorcentajeItem(BaseModel):
    descripcion: str
    cantidad: int
    porcentaje: float

class IncidentConsolidatedIncidentesPorcentajesOut(BaseModel):
    total_general: int
    limite: int
    descripciones: list[IncidentConsolidatedIncidentesPorcentajeItem]
    
class IncidentConsolidatedTopDescripcionProyectoItem(BaseModel):
    descripcion: str
    proyecto: str
    tickets: int

class IncidentConsolidatedTopDescripcionProyectoOut(BaseModel):
    total_general: int
    combinaciones: list[IncidentConsolidatedTopDescripcionProyectoItem]
    
class IncidentConsolidatedTopDetalleItem(BaseModel):
    detalle: str
    tickets: int

class IncidentConsolidatedTopDetallesOut(BaseModel):
    total_general: int
    detalles: list[IncidentConsolidatedTopDetalleItem]
    
class IncidentConsolidatedTicketsPorResolutorOut(BaseModel):
    total_general: int
    limite: int
    periodos: list[IncidentConsolidatedRendimientoPeriodoItem]
    resolutores: list[IncidentConsolidatedRendimientoResolutorItem]
    
class IncidentConsolidatedDashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    prioridad: str | None = None
    motivo_estado: str | None = None
    motivo_resolucion: str | None = None
    grupo_resolutor: str | None = None
    proyecto: str | None = None
    proyectos_excluidos: list[str] = Field(
        default_factory=list
    )
    nombre_resolutor: str | None = None
    descripcion: str | None = None
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    )
    tipo_incidente: list[str] = Field(
        default_factory=list
    )
    detalle_id: str | None = Field(
        default=None,
        max_length=20
    )
    ticket_id: str | None = Field(
        default=None,
        max_length=20
    )


class IncidentConsolidatedTicketItem(BaseModel):
    Ticket_ID: str
    Fecha_Apertura: datetime
    Fecha_Resolucion: datetime | None = None
    Fecha_Cierre: datetime | None = None
    Fecha_Ultima_Modificacion: datetime | None = None
    Proyecto: str | None = None
    ALP: str | None = None
    BU: str | None = None
    Grupo_Resolutor: str | None = None
    Nombre_Resolutor: str | None = None
    Categorizacion_Nivel_1: str | None = None
    Categorizacion_Nivel_2: str | None = None
    Categorizacion_Nivel_3: str | None = None
    Prioridad: str | None = None
    Urgencia: str | None = None
    Impacto: str | None = None
    Estado: str | None = None
    Motivo_Estado: str | None = None
    Descripcion: str | None = None
    Detalle: str | None = None
    Fuente_Reportada: str | None = None
    Solucion: str | None = None
    Causa: str | None = None
    Motivo_Resolucion: str | None = None

class IncidentConsolidatedTicketsOut(BaseModel):
    tickets: list[IncidentConsolidatedTicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int



# ANÁLISIS DE INCIDENTES - ATRIBUCIÓN ORIGINAL
class IncidentConsolidatedAtribucionItem(BaseModel):
    atribucion: str
    tickets: int
    porcentaje: float

class IncidentConsolidatedAtribucionOut(BaseModel):
    total_tickets: int
    total_atribuidos: int
    sin_atribucion: int
    distribucion: list[IncidentConsolidatedAtribucionItem]



# ANÁLISIS DE INCIDENTES - TOP DE SERVIDORES
class IncidentConsolidatedServidorItem(BaseModel):
    servidor: str
    incidentes: int
    porcentaje: float
    tickets_ejemplo: list[str]

class IncidentConsolidatedTopServidoresOut(BaseModel):
    total_incidentes: int
    incidentes_con_servidor: int
    incidentes_sin_servidor: int
    total_servidores_identificados: int
    total_asociaciones: int
    limite: int
    servidores: list[IncidentConsolidatedServidorItem]



# ANÁLISIS DE LAS CAUSAS DE LOS INCIDENTES

class IncidentConsolidatedCausaEvidenciaItem(BaseModel):
    ticket_id: str
    campo: str
    texto: str

class IncidentConsolidatedCausaAnalisisItem(BaseModel):
    categoria: str
    incidentes: int
    porcentaje: float
    es_causa_identificada: bool
    accion_recomendada: str
    evidencias: list[IncidentConsolidatedCausaEvidenciaItem]

class IncidentConsolidatedAnalisisCausasOut(BaseModel):
    total_incidentes: int
    con_factor_tecnico: int
    sin_causa_determinada: int
    casos_multifactor: int
    metodologia: str
    causas: list[IncidentConsolidatedCausaAnalisisItem]
    tickets_para_revision: list[str]



# ANALISIS DE INCIDENTES
# DISTRIBUCION AJUSTADA POR ANALISIS DE CAUSA

class IncidentConsolidatedComparacionAtribucionItem(BaseModel):
    atribucion: str
    tickets_originales: int
    tickets_ajustados: int
    variacion_tickets: int
    porcentaje_original: float
    porcentaje_ajustado: float


class IncidentConsolidatedDistribucionAjustadaOut(BaseModel):
    total_tickets: int

    total_atribuidos_original: int
    total_atribuidos_ajustado: int

    sin_atribucion_original: int
    sin_atribucion_ajustado: int

    reglas_aprobadas: int
    ajustes_aplicados: int
    ajustes_habilitados: bool

    estado_ajuste: str
    metodologia: str

    distribucion_original: list[IncidentConsolidatedAtribucionItem]
    distribucion_ajustada: list[IncidentConsolidatedAtribucionItem]

    comparacion: list[IncidentConsolidatedComparacionAtribucionItem]




# ANALISIS DE INCIDENTES - PRINCIPALES HALLAZGOS

class IncidentConsolidatedHallazgoItem(BaseModel):
    codigo: str
    tipo: str
    titulo: str
    descripcion: str
    valor: int
    porcentaje: float | None = None
    denominador: int | None = None
    requiere_validacion: bool = False


class IncidentConsolidatedPrincipalesHallazgosOut(BaseModel):
    total_incidentes: int
    total_hallazgos: int
    estado_ajuste: str
    metodologia: str
    hallazgos: list[IncidentConsolidatedHallazgoItem]



# ANALISIS DE INCIDENTES - CONCLUSIONES
class IncidentConsolidatedConclusionItem(BaseModel):
    codigo: str
    tipo: str
    titulo: str
    conclusion: str
    recomendacion: str
    hallazgos_referencia: list[str]
    requiere_validacion: bool = False


class IncidentConsolidatedConclusionesOut(BaseModel):
    total_incidentes: int
    total_conclusiones: int
    estado_ajuste: str
    metodologia: str
    conclusiones: list[IncidentConsolidatedConclusionItem]



#--------------------------------------------------------------------
# Requerimientos Consolidado
#--------------------------------------------------------------------

class RequirementConsolidatedFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    prioridades: list[str]
    motivos_estado: list[str]
    motivos_resolucion: list[str]
    grupos_resolutores: list[str]
    proyectos: list[str]
        
class RequirementConsolidatedKPIOut(BaseModel):
    total_tickets: int
    total_proyectos: int
    alta_criticidad: int
    porcentaje_alta_criticidad: float

    
class RequirementConsolidatedVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int
    
class RequirementConsolidatedProyectoItem(BaseModel):
    proyecto: str
    cantidad: int                

class RequirementConsolidatedTipoItem(BaseModel):
    tipo_requerimiento: str
    cantidad: int    

class RequirementConsolidatedPrioridadItem(BaseModel):
    prioridad: str
    cantidad: int
    
class RequirementConsolidatedTopPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str

class RequirementConsolidatedTopMesItem(BaseModel):
    periodo: str
    tickets: int

class RequirementConsolidatedTopProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    mensual: list[RequirementConsolidatedTopMesItem]

class RequirementConsolidatedTopProyectosOut(BaseModel):
    periodos: list[RequirementConsolidatedTopPeriodoItem]
    proyectos: list[RequirementConsolidatedTopProyectoItem]        
    
    
class RequirementConsolidatedPrioridadMesDetalleItem(BaseModel):
    prioridad: str
    cantidad: int
    porcentaje: float

class RequirementConsolidatedPrioridadMensualItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    total_tickets: int
    prioridades: list[RequirementConsolidatedPrioridadMesDetalleItem]    
    

class RequirementConsolidatedDashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    prioridad: str | None = None
    motivo_estado: str | None = None
    motivo_resolucion: str | None = None
    grupo_resolutor: str | None = None
    proyecto: str | None = None
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"
    )
    tipo_requerimiento: list[str] = Field(default_factory=list)
    proyectos_excluidos: list[str] = Field(default_factory=list)
    ticket_id: str | None = Field(
        default=None,
        max_length=20
    )


# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS CONSOLIDADOS

class RequirementConsolidatedTicketItem(BaseModel):
    Ticket_ID: str
    Fecha_Apertura: datetime
    Fecha_Resolucion: datetime | None = None
    Fecha_Cierre: datetime | None = None
    Fecha_Ultima_Modificacion: datetime | None = None
    Proyecto: str | None = None
    ALP: str | None = None
    BU: str | None = None
    Grupo_Resolutor: str | None = None
    Nombre_Resolutor: str | None = None
    Categorizacion_Nivel_1: str | None = None
    Categorizacion_Nivel_2: str | None = None
    Categorizacion_Nivel_3: str | None = None
    Prioridad: str | None = None
    Urgencia: str | None = None
    Impacto: str | None = None
    Estado: str | None = None
    Motivo_Estado: str | None = None
    Descripcion: str | None = None
    Detalle: str | None = None
    Fuente_Reportada: str | None = None
    Solucion: str | None = None
    Motivo_Resolucion: str | None = None


class RequirementConsolidatedTicketsOut(BaseModel):
    tickets: list[RequirementConsolidatedTicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


# ===============================================================
# INDICADORES PRODUCTIVIDAD - REQUERIMIENTOS CONSOLIDADOS
# ===============================================================
class RequirementProductividadProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    promedio_diario: float
    promedio_semanal: float
    promedio_mensual: float
    resolutores_distintos: int

class RequirementProductividadResumen(BaseModel):
    total_tickets: int
    total_proyectos: int
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    dias_calendario: int
    semanas_calendario: int
    meses_calendario: int

class RequirementProductividadPunto(BaseModel):
    periodo: str
    tickets: int

class RequirementProductividadSerie(BaseModel):
    proyecto: str
    total_tickets: int
    puntos: list[RequirementProductividadPunto]

class RequirementProductividadGrafico(BaseModel):
    granularidad: str
    periodos: list[str]
    proyectos: list[RequirementProductividadSerie]

class RequirementProductividadTabla(BaseModel):
    items: list[RequirementProductividadProyectoItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int

class RequirementProductividadOut(BaseModel):
    resumen: RequirementProductividadResumen
    grafico: RequirementProductividadGrafico
    tabla: RequirementProductividadTabla

class RequirementDotacionResolutorItem(BaseModel):
    nombre: str
    tickets: int

class RequirementDotacionFila(BaseModel):
    anio: int
    mes: int
    periodo: str
    proyecto: str
    total_tickets: int
    resolutores_distintos: int
    tickets_sin_resolutor: int
    resolutores: list[RequirementDotacionResolutorItem]

class RequirementDotacionResumen(BaseModel):
    total_tickets: int
    total_proyectos: int
    total_resolutores_distintos: int
    total_proyecto_meses: int

class RequirementDotacionPunto(BaseModel):
    periodo: str
    resolutores: int

class RequirementDotacionSerie(BaseModel):
    proyecto: str
    puntos: list[RequirementDotacionPunto]

class RequirementDotacionGrafico(BaseModel):
    periodos: list[str]
    proyectos: list[RequirementDotacionSerie]

class RequirementDotacionTabla(BaseModel):
    items: list[RequirementDotacionFila]
    total: int
    pagina: int
    tamano: int
    total_paginas: int

class RequirementDotacionOut(BaseModel):
    resumen: RequirementDotacionResumen
    grafico: RequirementDotacionGrafico
    tabla: RequirementDotacionTabla


# ===============================================================
# ALCANCE 3 - ATENCIÓN PARALELA DE REQUERIMIENTOS
# ===============================================================
class RequirementAtencionParalelaResumen(BaseModel):
    tickets_evaluados: int
    tickets_con_superposicion: int
    resolutores_con_superposicion: int
    total_eventos: int
    maximo_simultaneos: int
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    metodologia: str


class RequirementAtencionParalelaGraficoItem(BaseModel):
    resolutor: str
    eventos: int
    tickets_con_superposicion: int
    maximo_simultaneos: int


class RequirementAtencionParalelaDetalleItem(BaseModel):
    ticket_id: str
    proyecto: str
    resolutor: str
    fecha_apertura: datetime
    fecha_resolucion: datetime
    inicio_coincidencia: datetime
    fin_coincidencia: datetime
    tickets_simultaneos: int
    tickets_coincidentes: list[str]


class RequirementAtencionParalelaTabla(BaseModel):
    items: list[RequirementAtencionParalelaDetalleItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class RequirementAtencionParalelaOut(BaseModel):
    resumen: RequirementAtencionParalelaResumen
    grafico: list[RequirementAtencionParalelaGraficoItem]
    tabla: RequirementAtencionParalelaTabla




# ALCANCE 4 - TICKETS CON MODIFICACIONES MANUALES

class RequirementActualizacionManualResumen(BaseModel):
    total_tickets: int
    total_resolutores: int
    total_grupos: int
    total_proyectos: int
    tickets_sin_resolutor: int


class RequirementActualizacionManualItem(BaseModel):
    grupo_resolutor: str
    resolutor: str
    tickets: int
    proyectos: int
    porcentaje: float


class RequirementActualizacionManualTabla(BaseModel):
    items: list[RequirementActualizacionManualItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int

 
class RequirementActualizacionesManualesOut(BaseModel):
    resumen: RequirementActualizacionManualResumen
    grafico: list[RequirementActualizacionManualItem]
    tabla: RequirementActualizacionManualTabla
