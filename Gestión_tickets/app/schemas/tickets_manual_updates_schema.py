from pydantic import BaseModel, Field


class TicketsManualUpdatesImportOut(BaseModel):

    tipo: str = "tickets_manual_updates"

    tabla_staging: str = "stg_tickets_manual_updates"

    tabla_destino: str = "tickets_manual_updates"

    lote_id: str

    filas_excel: int = Field(ge=0)

    # Registros de trabajo conservados por el ETL.
    filas_procesadas: int = Field(ge=0)

    filas_staging: int = Field(ge=0)

    # Eventos sin cambios al reimportar. No son filas rechazadas.
    duplicados: int = Field(ge=0)

    nuevos: int = Field(ge=0)

    modificados: int = Field(default=0, ge=0)

    # Eventos de staging ya existentes con el mismo contenido.
    sin_cambios: int = Field(ge=0)

    tickets_distintos: int = Field(ge=0)

    # Filas adicionales por Ticket_ID, conservadas en el ETL.
    filas_ticket_repetido: int = Field(ge=0)

    mensaje: str


# PASO 3: contratos de análisis de atención paralela
from datetime import date, datetime
from typing import Literal

TipoTicketParalelo = Literal["Incident", "Service Request"]


class TicketsParallelFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    grupo_resolutor: str | None = "BASE DE DATOS Y EBS"
    prioridad: str | None = None
    motivo: str | None = None
    proyectos: list[str] = Field(default_factory=list)
    todos_proyectos: bool = False
    ticket_type: TipoTicketParalelo | None = None


class TicketsParallelFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    grupos_resolutores: list[str]
    prioridades: list[str]
    motivos: list[str]
    proyectos: list[str]
    tipos_ticket: list[TipoTicketParalelo]


class TicketsParallelKPIOut(BaseModel):
    total_tickets_paralelos: int
    total_resolutores: int
    total_proyectos: int


class TicketsParallelMonthlyItem(BaseModel):
    periodo: str
    incidentes_evaluados: int
    incidentes_paralelos: int
    requerimientos_evaluados: int
    requerimientos_paralelos: int


class TicketsParallelCountItem(BaseModel):
    periodo: str
    incidentes_paralelos: int
    requerimientos_paralelos: int
    total_paralelos: int


class TicketsParallelResolverItem(TicketsParallelCountItem):
    resolutor: str


class TicketsParallelProjectItem(TicketsParallelCountItem):
    proyecto: str
    alp: str | None = None


class TicketsParallelTicketItem(BaseModel):
    ticket_id: str
    ticket_type: TipoTicketParalelo
    resolutor: str
    proyecto: str | None = None
    alp: str | None = None
    prioridad: str | None = None
    motivo: str | None = None
    descripcion: str | None = None
    fuente_metadatos: str
    otros_tickets_paralelos: int
    maximo_tickets_simultaneos: int
    coincidencias: int
    primera_coincidencia: datetime
    ultima_coincidencia: datetime


class TicketsParallelTicketsOut(BaseModel):
    items: list[TicketsParallelTicketItem]
    total: int
    pagina: int
    tamano: int


class TicketsParallelEvidenceItem(BaseModel):
    rol: Literal["Seleccionado", "Relacionado"]
    ticket_padre: str
    ticket_origen: str
    tipo_origen: str
    report_time_id: int
    resolutor_original: str
    grupo_resolutor: str | None = None
    inicio_original: datetime
    fin_original: datetime
    estado_origen: str | None = None
    motivo_origen: str | None = None
    descripcion_origen: str | None = None


class TicketsParallelDetailItem(BaseModel):
    ticket_relacionado: str
    tipo_relacionado: TipoTicketParalelo
    proyecto_relacionado: str | None = None
    alp_relacionado: str | None = None
    prioridad_relacionada: str | None = None
    motivo_relacionado: str | None = None
    descripcion_relacionada: str | None = None
    fuente_metadatos: str
    resolutor: str
    inicio_paralelo: datetime
    fin_paralelo: datetime
    segundos_paralelo: int
    minutos_paralelo: float
    evidencia: list[TicketsParallelEvidenceItem]


class TicketsParallelDetailOut(BaseModel):
    ticket: TicketsParallelTicketItem
    coincidencias: list[TicketsParallelDetailItem]


class TicketsParallelResolverPage(BaseModel):
    items: list[TicketsParallelResolverItem]
    total: int = Field(ge=0, description="Número de resolutores distintos")
    pagina: int = Field(ge=1)
    tamano: int = Field(ge=1)


class TicketsParallelProjectPage(BaseModel):
    items: list[TicketsParallelProjectItem]
    total: int = Field(ge=0, description="Número de proyectos distintos")
    pagina: int = Field(ge=1)
    tamano: int = Field(ge=1)
