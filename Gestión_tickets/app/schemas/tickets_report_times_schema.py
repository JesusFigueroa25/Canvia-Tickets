from typing import Literal
from pydantic import BaseModel, Field
from datetime import date


class TicketsReportTimesImportOut(BaseModel):
    tipo: Literal["tickets_report_times"] = "tickets_report_times"
    tabla_staging: Literal["stg_tickets_report_times"] = "stg_tickets_report_times"
    tabla_destino: Literal["tickets_report_times"] = "tickets_report_times"
    lote_id: str
    filas_excel: int = Field(ge=0)
    filas_procesadas: int = Field(ge=0)
    filas_staging: int = Field(ge=0)
    filas_rechazadas: int = Field(default=0, ge=0)
    nuevos: int = Field(ge=0, description="Acciones nuevas")
    modificados: int = Field(ge=0, description="Acciones modificadas")
    sin_cambios: int = Field(ge=0, description="Acciones sin cambios")
    tickets_distintos: int = Field(ge=0)
    total_acciones: int = Field(ge=0, description="Acciones acumuladas en tabla oficial")
    mensaje: str



class TicketsReportTimesDashboardFilters(BaseModel):
    desde: date | None = None
    hasta: date | None = None
    grupo_resolutor: str | None = "BASE DE DATOS Y EBS"
    periodo: str | None = Field(default=None, pattern=r"^(19|20)\d{2}-(0[1-9]|1[0-2])$")
    # None o []: ocho proyectos predeterminados en tablas y gráficos.
    # Con todos_proyectos=True: sin filtro por proyecto.
    proyectos: list[str] = Field(default_factory=list)
    todos_proyectos: bool = False


class TicketsReportTimesFiltersOut(BaseModel):
    fecha_min: date | None = None
    fecha_max: date | None = None
    grupos_resolutores: list[str]
    proyectos: list[str]
    proyectos_predeterminados: list[str]


class TicketsReportTimesKPIOut(BaseModel):
    total_tickets: int
    total_proyectos: int
    alta_criticidad: int
    porcentaje_alta_criticidad: float


class TicketsReportTimesVolumenItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    tickets: int
    acciones: int
    horas_totales: float


class TicketsReportTimesResumen(BaseModel):
    tickets_distintos: int
    acciones: int
    horas_totales: float
    proyectos_distintos: int
    resolutores_distintos: int


class TicketsReportTimesResolverItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    resolutor: str
    tickets: int
    acciones: int
    horas_totales: float


class TicketsReportTimesProjectItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    proyecto: str
    tickets: int
    acciones: int
    resolutores_distintos: int
    horas_totales: float


class TicketsReportTimesResolverTablaOut(BaseModel):
    resumen: TicketsReportTimesResumen
    items: list[TicketsReportTimesResolverItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class TicketsReportTimesProjectTablaOut(BaseModel):
    resumen: TicketsReportTimesResumen
    items: list[TicketsReportTimesProjectItem]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class TicketsReportTimesGraficoPunto(BaseModel):
    periodo: str
    horas: float


class TicketsReportTimesGraficoSerie(BaseModel):
    nombre: str  # Nombre del resolutor o proyecto, según el endpoint
    horas_totales: float
    mensual: list[TicketsReportTimesGraficoPunto]


class TicketsReportTimesGraficoOut(BaseModel):
    periodos: list[str]
    series: list[TicketsReportTimesGraficoSerie]
    limite: int
