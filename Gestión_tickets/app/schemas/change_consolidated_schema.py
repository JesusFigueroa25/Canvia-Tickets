"""Contratos HTTP del módulo Cambios Consolidados."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class ChangeConsolidatedDashboardFilters(BaseModel):
    nombre_resolutor: str | None = Field(default=None, max_length=150)
    # Todos los filtros temporales operan sobre Fecha_Creacion.
    desde: date | None = None
    hasta: date | None = None
    prioridad: str | None = None
    motivo: str | None = None
    grupo_resolutor: str | None = None
    estado: str | None = None

    # Filtros interactivos, disponibles para los endpoints posteriores.
    proyecto: str | None = None
    proyectos_excluidos: list[str] = Field(default_factory=list)
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$",
    )
    tipo_cambio: list[str] = Field(default_factory=list)
    ticket_id: str | None = Field(default=None, max_length=20)


class ChangeConsolidatedFiltersOut(BaseModel):
    nombres_resolutores: list[str] = Field(default_factory=list)
    fecha_min: date | None = None
    fecha_max: date | None = None
    prioridades: list[str] = Field(default_factory=list)
    motivos: list[str] = Field(default_factory=list)
    grupos_resolutores: list[str] = Field(default_factory=list)
    estados: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)
    tipos_cambio: list[str] = Field(default_factory=list)


class ChangeConsolidatedKPIOut(BaseModel):
    total_tickets: int
    total_proyectos: int
    alta_criticidad: int
    porcentaje_alta_criticidad: float


# Respuestas de los siete endpoints de análisis.
class ChangeConsolidatedVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int


class ChangeConsolidatedProyectoItem(BaseModel):
    proyecto: str
    cantidad: int


class ChangeConsolidatedTipoItem(BaseModel):
    tipo_cambio: str
    cantidad: int
    
class ChangeConsolidatedCategoriaItem(BaseModel):
    categoria: str
    cantidad: int


class ChangeConsolidatedPrioridadItem(BaseModel):
    prioridad: str
    cantidad: int


class ChangeConsolidatedTopPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str


class ChangeConsolidatedTopMesItem(BaseModel):
    periodo: str
    tickets: int


class ChangeConsolidatedTopProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    mensual: list[ChangeConsolidatedTopMesItem]


class ChangeConsolidatedTopProyectosOut(BaseModel):
    periodos: list[ChangeConsolidatedTopPeriodoItem]
    proyectos: list[ChangeConsolidatedTopProyectoItem]


class ChangeConsolidatedPrioridadMesDetalleItem(BaseModel):
    prioridad: str
    cantidad: int
    porcentaje: float


class ChangeConsolidatedPrioridadMensualItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    total_tickets: int
    prioridades: list[ChangeConsolidatedPrioridadMesDetalleItem]


class ChangeConsolidatedTicketItem(BaseModel):
    Ticket_ID: str
    Fecha_Creacion: datetime
    Fecha_Inicio_Propuesta: datetime | None = None
    Fecha_Fin_Propuesta: datetime | None = None
    Fecha_Inicio_Planificada: datetime | None = None
    Fecha_Fin_Planificada: datetime | None = None
    Fecha_Inicio_Real: datetime | None = None
    Fecha_Fin_Real: datetime | None = None
    Fecha_Ultimo_Worklog: datetime | None = None
    ALP: str | None = None
    Proyecto: str | None = None
    BU: str | None = None
    Grupo_Resolutor: str | None = None
    Nombre_Resolutor: str | None = None
    Categorizacion_Nivel_1: str | None = None
    Categorizacion_Nivel_2: str | None = None
    Categorizacion_Nivel_3: str | None = None
    Prioridad: str | None = None
    Urgencia: str | None = None
    Impacto: str | None = None
    Phase: str | None = None
    Estado: str | None = None
    Motivo: str | None = None
    Tipo_Cambio: str | None = None
    Descripcion: str | None = None
    Detalle: str | None = None
    Fuente: str | None = None
    Valor_Riesgo: int | None = None
    Autor_Creacion: str | None = None
    Codigo_Cierre_Cambio: str | None = None
    Motivo_Cancelacion_Cambio: str | None = None


class ChangeConsolidatedTicketsOut(BaseModel):
    tickets: list[ChangeConsolidatedTicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int

# ================================================================
# PRD 05 - CONTRATOS DE ACTIVIDADES Y HORAS DE CAMBIOS
# ================================================================

class ChangeConsolidatedActividadBDItem(ChangeConsolidatedTicketItem):
    Total_Tareas_BD: int
    Total_Tareas_Wintel: int
    Tipo_Participacion: str
    Clasificacion_Evidencia: str
    Tipo_Actividad: str
    Es_Subida_Bajada: int
    Es_Baja_Instancia: int
    Es_Validacion: int
    Ticket_Evidencia: str | None = None


class ChangeConsolidatedActividadesBDOut(BaseModel):
    cambios: list[ChangeConsolidatedActividadBDItem] = Field(default_factory=list)
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class ChangeConsolidatedHorasCambioItem(BaseModel):
    Ticket_ID: str
    Fecha_Creacion: datetime
    ALP: str | None = None
    Proyecto: str | None = None
    Descripcion: str | None = None
    Grupo_Resolutor: str | None = None
    Nombre_Resolutor: str | None = None
    Estado: str | None = None
    Tipo_Participacion: str
    Tipo_Actividad: str
    Clasificacion_Evidencia: str
    Total_Tareas_BD: int
    Total_Tareas_Wintel: int
    Registros_Tiempo_BD: int
    Total_Resolutores_BD: int
    Horas_Totales: float


class ChangeConsolidatedHorasCambioOut(BaseModel):
    cambios: list[ChangeConsolidatedHorasCambioItem] = Field(default_factory=list)
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class ChangeConsolidatedHorasResolutorItem(BaseModel):
    Resolutor: str
    Total_Registros: int
    Total_Tareas: int
    # GROUPING SETS devuelve NULL en el total general cuando no hay filas.
    Horas_Totales: float | None = None


class ChangeConsolidatedHorasMensualesItem(BaseModel):
    Anio: int
    Mes: int
    Periodo: str
    Total_Cambios: int
    Total_Tareas: int
    Total_Resolutores: int
    Horas_Totales: float
    Promedio_Horas_Por_Cambio: float

