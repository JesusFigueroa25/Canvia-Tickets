"""Contratos HTTP del dashboard de Tareas Consolidadas."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class TaskConsolidatedDashboardFilters(BaseModel):
    # Filtros globales (Fecha_Apertura)
    desde: date | None = None
    hasta: date | None = None
    prioridad: str | None = None
    motivo_estado: str | None = None
    grupo_resolutor: str | None = None

    # Filtros interactivos entre componentes
    proyecto: str | None = None
    proyectos_excluidos: list[str] = Field(default_factory=list)
    periodo: str | None = Field(
        default=None,
        pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$",
    )
    tipo_tarea: list[str] = Field(default_factory=list)
    ticket_id: str | None = Field(default=None, max_length=20)


class TaskConsolidatedFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    prioridades: list[str] = Field(default_factory=list)
    motivos_estado: list[str] = Field(default_factory=list)
    grupos_resolutores: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)
    tipos_tarea: list[str] = Field(default_factory=list)


class TaskConsolidatedKPIOut(BaseModel):
    total_tickets: int
    total_proyectos: int
    alta_criticidad: int
    porcentaje_alta_criticidad: float


class TaskConsolidatedVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int


class TaskConsolidatedProyectoItem(BaseModel):
    proyecto: str
    cantidad: int


class TaskConsolidatedTipoItem(BaseModel):
    tipo_tarea: str
    cantidad: int


class TaskConsolidatedPrioridadItem(BaseModel):
    prioridad: str
    cantidad: int


class TaskConsolidatedTopPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str


class TaskConsolidatedTopMesItem(BaseModel):
    periodo: str
    tickets: int


class TaskConsolidatedTopProyectoItem(BaseModel):
    proyecto: str
    total_tickets: int
    mensual: list[TaskConsolidatedTopMesItem]


class TaskConsolidatedTopProyectosOut(BaseModel):
    periodos: list[TaskConsolidatedTopPeriodoItem]
    proyectos: list[TaskConsolidatedTopProyectoItem]


class TaskConsolidatedPrioridadMesDetalleItem(BaseModel):
    prioridad: str
    cantidad: int
    porcentaje: float


class TaskConsolidatedPrioridadMensualItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    total_tickets: int
    prioridades: list[TaskConsolidatedPrioridadMesDetalleItem]


class TaskConsolidatedTicketItem(BaseModel):
    Ticket_ID: str
    Ticket_Padre: str | None = None
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


class TaskConsolidatedTicketsOut(BaseModel):
    tickets: list[TaskConsolidatedTicketItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int
