from __future__ import annotations
import json
from datetime import date, datetime
from typing import Any, Literal
from pydantic import (BaseModel,ConfigDict,Field,field_validator,model_validator,)

CategorizationStatus = Literal["CORRECT","INCORRECT"]
RunStatus = Literal["PENDING","RUNNING","COMPLETED","PARTIAL","FAILED",]
TicketLifecycle = Literal["RESOLVED","CANCELLED","OPEN","UNCERTAIN",]
SolutionCheckStatus = Literal["PRESENT","MISSING_REQUIRED","OPTIONAL_MISSING","REVIEW_STATUS",]
CatalogSource = Literal["SQL_SERVER","SERVICE_AIDE","MANUAL",]
CatalogValidation = Literal["OBSERVED","VALIDATED",]

class AuditBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True,extra="forbid",)


class AuditRunCreate(AuditBaseSchema):
    grupo_resolutor: str = Field(...,min_length=1,max_length=150,)
    group_id: int | None = Field(default=None,gt=0,)
    period_from: date | None = None
    period_to: date | None = None

    @model_validator(mode="after")
    def validar_periodo(self):

        # El rango es opcional, pero debe estar completo.
        if (self.period_from is None) != (self.period_to is None):
            raise ValueError(
                "Debes indicar ambas fechas o dejar el rango vacío."
            )
        if (self.period_from is not None and self.period_to is not None and self.period_from > self.period_to):
            raise ValueError(
                "period_from no puede ser posterior a period_to"
            )
        # Una auditoría agrupada debe tener un período definido.
        if self.group_id is not None and self.period_from is None:
            raise ValueError(
                "Para asociar una auditoría a una agrupación "
                "es obligatorio indicar el rango de fechas."
            )

        return self



class AuditDashboardFilters(AuditBaseSchema):
    grupo_resolutor: str | None = Field(
        default=None, min_length=1, max_length=150
    )
    proyecto: str | None = Field(
        default=None, min_length=1, max_length=200
    )
    desde: date | None = None
    hasta: date | None = None

    resultado: CategorizationStatus | None = None
    motivo_resolucion: Literal[
        "Atribuible a Cliente",
        "Atribuible a Canvia",
    ] | None = None

    mes: str | None = Field(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    )
    nombre_resolutor: str | None = Field(
        default=None, min_length=1, max_length=150
    )
    ticket_id: str | None = Field(
        default=None, min_length=1, max_length=20
    )

    @model_validator(mode="after")
    def validar_fechas(self):
        if (
            self.desde is not None
            and self.hasta is not None
            and self.desde > self.hasta
        ):
            raise ValueError(
                "La fecha inicial no puede superar la fecha final."
            )
        return self


class AuditTicketFilters(AuditDashboardFilters):
    run_id: int | None = Field(default=None, gt=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)



class AuditCategoryOut(AuditBaseSchema):
    catalog_id: int
    level_1: str
    level_2: str
    level_3: str
    description: str | None = None
    examples: str | None = None
    catalog_source: CatalogSource
    validation_status: CatalogValidation
    first_observed_at: datetime | None = None
    last_observed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AuditCategoryListOut(AuditBaseSchema):
    total: int = Field(ge=0)
    items: list[AuditCategoryOut] = Field(default_factory=list,)
    

# AGRUPACIONES DE AUDITORÍAS

class AuditGroupCreate(AuditBaseSchema):
    group_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )
    grupo_resolutor: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )
    audit_year: int = Field(
        ...,
        ge=2000,
        le=2100,
    )
    description: str | None = Field(
        default=None,
        max_length=500,
    )

class AuditGroupOut(AuditBaseSchema):

    group_id: int
    group_name: str
    grupo_resolutor: str
    audit_year: int
    description: str | None = None
    created_at: datetime



class AuditRunOut(AuditBaseSchema):

    run_id: int
    group_id: int | None = None

    grupo_resolutor: str
    period_from: date | None = None
    period_to: date | None = None

    status: RunStatus

    model_name: str | None = None
    model_version: str | None = None
    engine_version: str | None = None
    catalog_snapshot_hash: str | None = None

    total_tickets: int = Field(ge=0)
    processed_tickets: int = Field(ge=0)

    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    error_count: int = Field(ge=0)

    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None




class AuditSummaryOut(AuditBaseSchema):
    run_id: int
    grupo_resolutor: str
    run_status: RunStatus
    total_tickets: int = Field(ge=0)
    processed_tickets: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    error_count: int = Field(ge=0)
    correct_percentage: float = Field(ge=0,le=100)
    incorrect_percentage: float = Field(ge=0,le=100)
    missing_required_solution_count: int = Field(ge=0)
    optional_missing_solution_count: int = Field(ge=0)
    review_solution_status_count: int = Field(ge=0)

    @model_validator(mode="before")
    @classmethod
    def adaptar_resumen_anterior(cls,valor: Any) -> Any:
        if isinstance(valor,dict):
            return {
                clave:contenido
                for clave,contenido in valor.items()
                if clave not in {"review_count","review_percentage"}
            }

        return valor



class AuditGroupSummaryOut(AuditBaseSchema):

    group_id: int
    group_name: str
    grupo_resolutor: str
    audit_year: int

    # Cantidad de ejecuciones asociadas.
    total_runs: int = Field(ge=0)
    completed_runs: int = Field(ge=0)

    # Indicadores acumulados de ejecuciones completadas.
    total_tickets: int = Field(ge=0)
    processed_tickets: int = Field(ge=0)

    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    error_count: int = Field(ge=0)

    correct_percentage: float = Field(ge=0, le=100)
    incorrect_percentage: float = Field(ge=0, le=100)

    missing_required_solution_count: int = Field(ge=0)
    optional_missing_solution_count: int = Field(ge=0)
    review_solution_status_count: int = Field(ge=0)


class AuditTicketOut(AuditBaseSchema):

    result_id: int
    run_id: int
    ticket_id: str
    grupo_resolutor: str
    resolver_name: str | None = None
    project_name: str | None = None
    source_opened_at: datetime
    source_status: str | None = None
    source_status_reason: str | None = None
    source_resolved_at: datetime | None = None
    source_last_modified_at: datetime | None = None
    original_level_1: str | None = None
    original_level_2: str | None = None
    original_level_3: str | None = None
    original_catalog_id: int | None = None
    suggested_catalog_id: int | None = None
    suggested_level_1: str | None = None
    suggested_level_2: str | None = None
    suggested_level_3: str | None = None
    descripcion: str | None = None
    detalle: str | None = None
    solucion: str | None = None
    result_status: CategorizationStatus
    reason_code: str
    reason_text: str
    evidence_json: dict[str, Any] | None = None
    semantic_score: float | None = None
    source_hash: str = Field(min_length=64,max_length=64)
    evaluated_at: datetime
    ticket_lifecycle_status: TicketLifecycle | None = None
    has_solution: bool | None = None
    solution_check_status: SolutionCheckStatus | None = None
    solution_check_reason: str | None = None

    @field_validator("evidence_json", mode="before")
    @classmethod
    def convertir_evidencia_json(cls, value: Any) -> Any:
        if isinstance(value, str):
            return json.loads(value)
        return value


class AuditTicketListOut(AuditBaseSchema):
    run_id: int
    grupo_resolutor: str
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    items: list[AuditTicketOut] = Field(default_factory=list,)
    
class AuditGroupTicketListOut(AuditBaseSchema):

    group_id: int
    grupo_resolutor: str

    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)

    items: list[AuditTicketOut] = Field(
        default_factory=list,
    )
    
    
class AuditGroupResolverListOut(AuditBaseSchema):

    group_id: int
    grupo_resolutor: str

    total: int = Field(ge=0)

    items: list[AuditResolverOut] = Field(
        default_factory=list,
    )



class AuditResolverOut(AuditBaseSchema):
    resolver_name: str | None = None
    total_tickets: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    correct_percentage: float = Field(ge=0,le=100)
    incorrect_percentage: float = Field(ge=0,le=100)
    missing_required_solution_count: int = Field(default=0,ge=0)

    @model_validator(mode="before")
    @classmethod
    def adaptar_resolutor_anterior(cls,valor: Any) -> Any:
        if isinstance(valor,dict):
            return {
                clave:contenido
                for clave,contenido in valor.items()
                if clave not in {"review_count","review_percentage"}
            }

        return valor



class AuditResolverListOut(AuditBaseSchema):
    run_id: int
    grupo_resolutor: str
    total: int = Field(ge=0)
    items: list[AuditResolverOut] = Field(default_factory=list,)



class AuditMonthlyStatOut(AuditBaseSchema):
    month: str
    total_tickets: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    correct_percentage: float = Field(ge=0, le=100)
    incorrect_percentage: float = Field(ge=0, le=100)


class AuditGroupMonthlyStatsOut(AuditBaseSchema):
    group_id: int
    grupo_resolutor: str
    audit_year: int
    total: int = Field(ge=0)
    items: list[AuditMonthlyStatOut] = Field(default_factory=list)

#Grafico Dona Prioridad
class AuditResolutionReasonOut(AuditBaseSchema):
    reason: str
    total_tickets: int = Field(ge=0)
    percentage: float = Field(ge=0, le=100)


class AuditGroupResolutionReasonListOut(AuditBaseSchema):
    group_id: int
    grupo_resolutor: str
    audit_year: int
    total: int = Field(ge=0)  # total de tickets evaluados (suma de items)
    items: list[AuditResolutionReasonOut] = Field(default_factory=list)
    

class AuditGroupFilterOptionsOut(AuditBaseSchema):
    group_id: int
    audit_year: int

    fecha_min: date | None = None
    fecha_max: date | None = None

    grupos_resolutores: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)
    nombres_resolutores: list[str] = Field(default_factory=list)
    meses: list[str] = Field(default_factory=list)
    ticket_ids: list[str] = Field(default_factory=list)
