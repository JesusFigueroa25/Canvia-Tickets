from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from importlib import import_module
import re
from typing import Any, Mapping
from pydantic import ValidationError

from app.schemas.ai_chat_schema import AnalyticalQueryPlan, AIQueryFilter

# 1. LÍMITES DE SEGURIDAD
MAX_FILTERS = 12
MAX_METRICS = 8
MAX_GROUPS = 2
MAX_ORDERS = 3
MAX_IN_ITEMS = 50
MAX_TEXT_LENGTH = 200
MIN_CONTAINS_LENGTH = 3
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
MAX_OFFSET = 10000

# 2. OPERADORES AUTORIZADOS

CATEGORY_OPERATORS = frozenset({
    "eq",
    "ne",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
})

DATE_OPERATORS = frozenset({
    "eq",
    "gt",
    "gte",
    "lt",
    "lte",
    "date_range",
    "is_null",
    "is_not_null",
})

ID_OPERATORS = frozenset({
    "eq",
    "in",
})

DESCRIPTION_OPERATORS = frozenset({
    "eq",
    "contains",
    "is_null",
    "is_not_null",
})


# 3. COLUMNAS SLA / OLA
SLA_FIELDS = frozenset({
    "SLA_Respuesta_Condicion",
    "SLA_Solucion_Condicion",
    "OLA_Respuesta_Condicion",
    "OLA_Solucion_Condicion",
})

# 4. COLUMNAS DE CONSOLIDADOS
CONSOLIDATED_DATE_FIELDS = frozenset({
    "Fecha_Apertura",
    "Fecha_Resolucion",
    "Fecha_Cierre",
    "Fecha_Ultima_Modificacion",
})

CONSOLIDATED_CATEGORY_FIELDS = frozenset({
    "Proyecto",
    "ALP",
    "BU",
    "Grupo_Resolutor",
    "Nombre_Resolutor",
    "Categorizacion_Nivel_1",
    "Categorizacion_Nivel_2",
    "Categorizacion_Nivel_3",
    "Prioridad",
    "Urgencia",
    "Impacto",
    "Estado",
    "Motivo_Estado",
    "Motivo_Resolucion",
    "Fuente_Reportada",
})

# 5. COLUMNAS SLA
SLA_DATE_FIELDS = frozenset({
    "Fecha_Creacion",
    "Fecha_Resolucion",
})

SLA_CATEGORY_FIELDS = frozenset({
    "Proyecto",
    "Estado",
    "Codigo_Motivo",
    "Prioridad",
    "Usuario_Resolutor",
    "Grupo_Resolutor",
    "Categorizacion_Clase",
    "Categorizacion_Categoria",
    "Categorizacion_Tipo",
    "Condicion_dia",
}) | SLA_FIELDS

# 6. REGLAS DE COLUMNAS
@dataclass(frozen=True)
class ColumnRule:
    kind: str
    operators: frozenset[str]
    groupable: bool = False


def _catalogo(
    dates: frozenset[str],
    categories: frozenset[str]
) -> dict[str, ColumnRule]:

    result = {
        name: ColumnRule(
            "date",
            DATE_OPERATORS,
            True
        )
        for name in dates
    }

    result.update({
        name: ColumnRule(
            "category",
            CATEGORY_OPERATORS,
            True
        )
        for name in categories
    })

    result["Ticket_ID"] = ColumnRule(
        "identifier",
        ID_OPERATORS
    )

    result["Descripcion"] = ColumnRule(
        "description",
        DESCRIPTION_OPERATORS
    )

    return result

# 7. CATÁLOGO DE LAS CUATRO FUENTES
COLUMN_CATALOG: dict[str, dict[str, ColumnRule]] = {

    "incident_consolidated": _catalogo(
        CONSOLIDATED_DATE_FIELDS,
        CONSOLIDATED_CATEGORY_FIELDS
    ),

    "requirement_consolidated": _catalogo(
        CONSOLIDATED_DATE_FIELDS,
        CONSOLIDATED_CATEGORY_FIELDS
    ),

    "incident_sla": _catalogo(
        SLA_DATE_FIELDS,
        SLA_CATEGORY_FIELDS
    ),

    "requirement_sla": _catalogo(
        SLA_DATE_FIELDS,
        SLA_CATEGORY_FIELDS
    ),
}

# 8. MODELOS SQLALCHEMY EXISTENTES
MODEL_PATHS = {

    "incident_consolidated": (
        "app.models.incident_consolidated_model",
        "IncidentConsolidated"
    ),

    "incident_sla": (
        "app.models.incident_sla_model",
        "IncidentSLA"
    ),

    "requirement_consolidated": (
        "app.models.requirement_consolidated_model",
        "RequirementConsolidated"
    ),

    "requirement_sla": (
        "app.models.requirement_sla_model",
        "RequirementSLA"
    ),
}

# 9. FECHAS PREDETERMINADAS
DATE_DEFAULT = {
    "incident_consolidated": "Fecha_Apertura",
    "incident_sla": "Fecha_Creacion",
    "requirement_consolidated": "Fecha_Apertura",
    "requirement_sla": "Fecha_Creacion",
}

# 10. EXPRESIONES DE VALIDACIÓN
ALIAS_RE = re.compile(
    r"[a-z][a-z0-9_]{0,49}\Z",
    flags=re.ASCII
)

DATE_RE = re.compile(
    r"\d{4}-\d{2}-\d{2}\Z",
    flags=re.ASCII
)

# 11. ERRORES CONTROLADOS
class PlanError(ValueError):

    def __init__(
        self,
        status: str,
        code: str,
        detail: str
    ):
        super().__init__(detail)

        self.status = status
        self.code = code
        self.detail = detail


def _reject(
    code: str,
    detail: str,
    status: str = "invalid_plan"
) -> None:

    raise PlanError(
        status,
        code,
        detail
    )

# 12. VALIDACIÓN DE FECHAS
def _fecha(
    valor: Any,
    *,
    campo: str
) -> str:

    if (
        not isinstance(valor, str)
        or DATE_RE.fullmatch(valor) is None
    ):
        _reject(
            "DQ-06",
            f"{campo}: fecha requerida en formato YYYY-MM-DD"
        )

    try:
        return date.fromisoformat(valor).isoformat()

    except ValueError:
        _reject(
            "DQ-06",
            f"{campo}: fecha calendario inválida"
        )

    raise AssertionError("inaccesible")

# 13. VALIDACIÓN DE TEXTO
def _texto(
    valor: Any,
    *,
    campo: str,
    contains: bool = False
) -> str:

    if not isinstance(valor, str):
        _reject(
            "DQ-05",
            f"{campo}: se requiere texto"
        )

    clean = valor.strip()

    if not clean:
        _reject(
            "DQ-05",
            f"{campo}: el texto no puede estar vacío"
        )

    if len(clean) > MAX_TEXT_LENGTH:
        _reject(
            "DQ-11",
            f"{campo}: supera {MAX_TEXT_LENGTH} caracteres",
            "limit_exceeded"
        )

    if contains and len(clean) < MIN_CONTAINS_LENGTH:
        _reject(
            "DQ-05",
            f"{campo}: contains requiere al menos "
            f"{MIN_CONTAINS_LENGTH} caracteres"
        )

    return clean

# 14. NORMALIZACIÓN DE FILTROS
def _normalizar_filtro(
    filtro: AIQueryFilter,
    catalog: Mapping[str, ColumnRule]
) -> dict[str, Any]:

    field = filtro.field
    op = filtro.operator

    if field not in catalog:
        _reject(
            "DQ-04",
            f"Columna no autorizada: {field}",
            "unsupported_operation"
        )

    rule = catalog[field]

    if op not in rule.operators:
        _reject(
            "DQ-05",
            f"Operador {op} no permitido para {field}",
            "unsupported_operation"
        )

    # Operadores sin valor
    if op in {"is_null", "is_not_null"}:

        if filtro.value is not None:
            _reject(
                "DQ-05",
                f"{op} no admite value"
            )

        value: Any = None

    # Rango de fechas
    elif op == "date_range":

        v = filtro.value

        if (
            not isinstance(v, dict)
            or set(v) != {"from", "to"}
        ):
            _reject(
                "DQ-06",
                "date_range requiere exclusivamente from y to"
            )

        start = _fecha(
            v["from"],
            campo=f"{field}.from"
        )

        end = _fecha(
            v["to"],
            campo=f"{field}.to"
        )

        if start > end:
            _reject(
                "DQ-06",
                "date_range.from no puede superar date_range.to"
            )

        value = {
            "from": start,
            "to": end
        }

    # Listas
    elif op in {"in", "not_in"}:

        if (
            not isinstance(filtro.value, list)
            or not filtro.value
        ):
            _reject(
                "DQ-05",
                f"{op} requiere una lista de textos no vacía"
            )

        if len(filtro.value) > MAX_IN_ITEMS:
            _reject(
                "DQ-11",
                f"Máximo {MAX_IN_ITEMS} valores por lista",
                "limit_exceeded"
            )

        value = [
            _texto(x, campo=field)
            for x in filtro.value
        ]

        if len(set(value)) != len(value):
            _reject(
                "DQ-05",
                f"{field}: valores duplicados en la lista"
            )

    # Fechas individuales
    elif rule.kind == "date":

        value = _fecha(
            filtro.value,
            campo=field
        )

    # Textos y categorías
    else:

        value = _texto(
            filtro.value,
            campo=field,
            contains=(op == "contains")
        )

    return {
        "field": field,
        "operator": op,
        "value": value
    }


# 15. DETECCIÓN DE FILTROS CONTRADICTORIOS
def _validar_contradicciones(
    filtros: list[dict[str, Any]],
    catalog: Mapping[str, ColumnRule]
) -> None:

    by_field: dict[str, list[dict[str, Any]]] = {}

    for filtro in filtros:
        by_field.setdefault(
            filtro["field"],
            []
        ).append(filtro)

    for field, items in by_field.items():

        ops = {
            item["operator"]
            for item in items
        }

        if "is_null" in ops and len(items) > 1:
            _reject(
                "DQ-13",
                f"Filtros contradictorios: {field} "
                "IS NULL y otras condiciones"
            )

        # Columnas categóricas
        if catalog[field].kind != "date":

            equals = [
                f["value"]
                for f in items
                if f["operator"] == "eq"
            ]

            if len(set(equals)) > 1:
                _reject(
                    "DQ-13",
                    f"Varias igualdades incompatibles sobre {field}"
                )

            continue

        # Columnas de fecha
        lower = 1
        upper = date.max.toordinal()

        for item in items:

            op = item["operator"]
            val = item["value"]

            if op in {"is_null", "is_not_null"}:
                continue

            if op == "date_range":

                lower = max(
                    lower,
                    date.fromisoformat(
                        val["from"]
                    ).toordinal()
                )

                upper = min(
                    upper,
                    date.fromisoformat(
                        val["to"]
                    ).toordinal()
                )

            else:

                day = date.fromisoformat(
                    val
                ).toordinal()

                if op == "eq":
                    lower = max(lower, day)
                    upper = min(upper, day)

                elif op == "gt":
                    lower = max(lower, day + 1)

                elif op == "gte":
                    lower = max(lower, day)

                elif op == "lt":
                    upper = min(upper, day - 1)

                elif op == "lte":
                    upper = min(upper, day)

        if lower > upper:
            _reject(
                "DQ-06",
                f"Rango temporal contradictorio para {field}"
            )


# 16. VALIDACIÓN DE MÉTRICAS
def _validar_metrica(
    metric: Any,
    source: str,
    catalog: Mapping[str, ColumnRule]
) -> dict[str, Any]:

    alias = metric.alias
    func = metric.function
    field = metric.field
    condition = metric.condition

    if ALIAS_RE.fullmatch(alias) is None:
        _reject(
            "DQ-07",
            f"Alias inválido: {alias}. "
            "Usar minúsculas, números y guion bajo"
        )

    cond = None

    if condition is not None:
        cond = _normalizar_filtro(
            condition,
            catalog
        )

    # COUNT
    if func == "count":

        if field is not None or cond is not None:
            _reject(
                "DQ-07",
                "count no admite field ni condition"
            )

    # Métricas que requieren columna
    elif func in {
        "count_distinct",
        "min_date",
        "max_date",
        "sla_compliance"
    }:

        if field is None or cond is not None:
            _reject(
                "DQ-07",
                f"{func} requiere field y prohíbe condition"
            )

        if field not in catalog:
            _reject(
                "DQ-04",
                f"Columna no autorizada: {field}",
                "unsupported_operation"
            )

        rule = catalog[field]

        if (
            func == "count_distinct"
            and rule.kind != "category"
        ):
            _reject(
                "DQ-07",
                "count_distinct solo admite columnas categóricas",
                "unsupported_operation"
            )

        if (
            func in {"min_date", "max_date"}
            and rule.kind != "date"
        ):
            _reject(
                "DQ-07",
                f"{func} requiere campo de fecha",
                "unsupported_operation"
            )

        if (
            func == "sla_compliance"
            and (
                source not in {
                    "incident_sla",
                    "requirement_sla"
                }
                or field not in SLA_FIELDS
            )
        ):
            _reject(
                "DQ-08",
                "sla_compliance exige fuente SLA "
                "y columna SLA/OLA",
                "unsupported_operation"
            )

    # ---------------------------------------------
    # Promedio de horas de resolución
    # ---------------------------------------------
    elif func == "avg_resolution_hours":

        if field is not None or cond is not None:
            _reject(
                "DQ-07",
                "avg_resolution_hours no admite "
                "field ni condition"
            )

    # ---------------------------------------------
    # Métricas condicionales
    # ---------------------------------------------
    elif func in {
        "count_if",
        "percent_of_total"
    }:

        if field is not None or cond is None:
            _reject(
                "DQ-07",
                f"{func} requiere condition "
                "y no admite field"
            )

    else:
        _reject(
            "DQ-07",
            f"Métrica no soportada: {func}",
            "unsupported_operation"
        )

    return {
        "alias": alias,
        "function": func,
        "field": field,
        "condition": cond
    }


# ============================================================
# 17. FUNCIÓN PRINCIPAL: VALIDAR PLAN
# ============================================================

def validar_plan_analitico(
    plan: Mapping[str, Any] | AnalyticalQueryPlan
) -> dict[str, Any]:

    """
    Valida y normaliza un plan sin acceder a SQL Server.

    Devuelve:
      - status='valid' y normalized_plan, si es correcto.
      - status de rechazo y detail, si es incorrecto.

    No devuelve status='success', ya que todavía
    no se ha ejecutado ninguna consulta SQL.
    """

    try:

        # -----------------------------------------
        # 1. Validar estructura Pydantic
        # -----------------------------------------
        if isinstance(plan, AnalyticalQueryPlan):
            parsed = plan

        else:

            if not isinstance(plan, dict):
                _reject(
                    "DQ-01",
                    "El plan debe ser un objeto JSON"
                )

            parsed = AnalyticalQueryPlan.model_validate(
                plan
            )

        catalog = COLUMN_CATALOG[
            parsed.source
        ]

        # -----------------------------------------
        # 2. Validar límites
        # -----------------------------------------
        if len(parsed.filters) > MAX_FILTERS:
            _reject(
                "DQ-11",
                f"Máximo {MAX_FILTERS} filtros",
                "limit_exceeded"
            )

        if len(parsed.metrics) > MAX_METRICS:
            _reject(
                "DQ-11",
                f"Máximo {MAX_METRICS} métricas",
                "limit_exceeded"
            )

        if len(parsed.group_by) > MAX_GROUPS:
            _reject(
                "DQ-11",
                f"Máximo {MAX_GROUPS} dimensiones",
                "limit_exceeded"
            )

        if len(parsed.order_by) > MAX_ORDERS:
            _reject(
                "DQ-11",
                f"Máximo {MAX_ORDERS} criterios de orden",
                "limit_exceeded"
            )

        # -----------------------------------------
        # 3. Normalizar filtros
        # -----------------------------------------
        filters = [
            _normalizar_filtro(
                item,
                catalog
            )
            for item in parsed.filters
        ]

        _validar_contradicciones(
            filters,
            catalog
        )

        # -----------------------------------------
        # 4. Validar agrupaciones
        # -----------------------------------------
        group_by: list[dict[str, str]] = []

        seen_groups: set[str] = set()

        for group in parsed.group_by:

            rule = catalog.get(
                group.field
            )

            if rule is None or not rule.groupable:
                _reject(
                    "DQ-09",
                    f"Agrupación no autorizada: {group.field}",
                    "unsupported_operation"
                )

            if group.field in seen_groups:
                _reject(
                    "DQ-09",
                    f"Agrupación repetida: {group.field}"
                )

            seen_groups.add(
                group.field
            )

            if (
                rule.kind == "date"
                and group.bucket == "value"
            ):
                _reject(
                    "DQ-09",
                    f"{group.field} requiere bucket "
                    "day, month o year"
                )

            if (
                rule.kind != "date"
                and group.bucket != "value"
            ):
                _reject(
                    "DQ-09",
                    f"{group.field} solo permite bucket value"
                )

            group_by.append({
                "field": group.field,
                "bucket": group.bucket
            })

        # -----------------------------------------
        # 5. Compatibilidad de operación
        # -----------------------------------------
        if (
            parsed.operation == "aggregate"
            and group_by
        ):
            _reject(
                "DQ-09",
                "aggregate no admite group_by"
            )

        if (
            parsed.operation == "grouped_aggregate"
            and not group_by
        ):
            _reject(
                "DQ-09",
                "grouped_aggregate requiere group_by"
            )

        # -----------------------------------------
        # 6. Normalizar métricas
        # -----------------------------------------
        metrics = [
            _validar_metrica(
                item,
                parsed.source,
                catalog
            )
            for item in parsed.metrics
        ]

        # -----------------------------------------
        # 7. Evitar porcentajes engañosos
        # -----------------------------------------
        filtered_fields = {
            item["field"]
            for item in filters
        }

        for metric in metrics:

            if (
                metric["function"] == "sla_compliance"
                and metric["field"] in filtered_fields
            ):
                _reject(
                    "DQ-13",
                    "No filtrar por la misma condición "
                    "usada para calcular cumplimiento SLA"
                )

            if (
                metric["function"] == "percent_of_total"
                and metric["condition"]["field"] in filtered_fields
            ):
                _reject(
                    "DQ-13",
                    "Porcentaje sobre el total: el filtro "
                    "no puede restringir previamente su numerador"
                )

        # -----------------------------------------
        # 8. Validar alias
        # -----------------------------------------
        aliases = [
            metric["alias"]
            for metric in metrics
        ]

        if len(set(aliases)) != len(aliases):
            _reject(
                "DQ-07",
                "Los alias de métricas deben ser únicos"
            )

        if (
            {alias.lower() for alias in aliases}
            &
            {g.lower() for g in seen_groups}
        ):
            _reject(
                "DQ-07",
                "Un alias de métrica no puede "
                "coincidir con una dimensión"
            )

        # -----------------------------------------
        # 9. Validar ordenamientos
        # -----------------------------------------
        allowed_order = (
            set(aliases)
            | seen_groups
        )

        orders: list[dict[str, str]] = []

        order_fields: set[str] = set()

        for order in parsed.order_by:

            if order.field not in allowed_order:
                _reject(
                    "DQ-10",
                    "No se puede ordenar por campo "
                    f"no seleccionado: {order.field}"
                )

            if order.field in order_fields:
                _reject(
                    "DQ-10",
                    f"Ordenamiento repetido: {order.field}"
                )

            order_fields.add(
                order.field
            )

            orders.append({
                "field": order.field,
                "direction": order.direction
            })

        # -----------------------------------------
        # 10. Validar paginación
        # -----------------------------------------
        if parsed.operation == "aggregate":

            if (
                orders
                or parsed.limit is not None
                or parsed.offset != 0
            ):
                _reject(
                    "DQ-09",
                    "aggregate no admite order_by, "
                    "limit ni offset"
                )

            limit = None

        else:

            limit = (
                DEFAULT_PAGE_SIZE
                if parsed.limit is None
                else parsed.limit
            )

            if (
                type(limit) is not int
                or not (1 <= limit <= MAX_PAGE_SIZE)
            ):
                _reject(
                    "DQ-11",
                    f"limit debe estar entre 1 y {MAX_PAGE_SIZE}",
                    "limit_exceeded"
                )

            if (
                type(parsed.offset) is not int
                or not (0 <= parsed.offset <= MAX_OFFSET)
            ):
                _reject(
                    "DQ-11",
                    f"offset debe estar entre 0 y {MAX_OFFSET}",
                    "limit_exceeded"
                )

        # -----------------------------------------
        # 11. Construir plan normalizado
        # -----------------------------------------
        normalized = {
            "version": 1,
            "source": parsed.source,
            "operation": parsed.operation,
            "filters": filters,
            "group_by": group_by,
            "metrics": metrics,
            "order_by": orders,
            "limit": limit,
            "offset": parsed.offset,
        }

        # -----------------------------------------
        # 12. Respuesta de validación
        # -----------------------------------------
        return {
            "status": "valid",
            "normalized_plan": normalized,
            "evidence": {
                "validated": True,
                "executed": False,
                "date_field_default": DATE_DEFAULT[
                    parsed.source
                ],
                "source": parsed.source,
                "plan_version": 1,
            },
        }

    # ---------------------------------------------
    # Error semántico controlado
    # ---------------------------------------------
    except PlanError as exc:

        return {
            "status": exc.status,
            "code": exc.code,
            "detail": exc.detail,
            "normalized_plan": None,
        }

    # ---------------------------------------------
    # Error de estructura Pydantic
    # ---------------------------------------------
    except ValidationError as exc:

        error = exc.errors()[0]

        loc = ".".join(
            map(
                str,
                error.get("loc", ())
            )
        ) or "plan"

        return {
            "status": "invalid_plan",
            "code": "DQ-01",
            "detail": (
                f"Estructura inválida en {loc}: "
                f"{error['msg']}"
            ),
            "normalized_plan": None,
        }


# ============================================================
# 18. EXPONER CATÁLOGO PARA EL FUTURO PLANIFICADOR
# ============================================================

def listar_capacidades_dinamicas() -> dict[str, Any]:

    """
    Devuelve los metadatos autorizados de las cuatro fuentes.
    No expone clases SQLAlchemy ni ejecuta SQL.
    """

    return {
        "version": 1,

        "sources": {
            name: {
                "date_field_default": DATE_DEFAULT[name],

                "columns": {
                    col: {
                        "type": rule.kind,
                        "groupable": rule.groupable,
                        "operators": sorted(
                            rule.operators
                        ),
                    }

                    for col, rule in sorted(
                        fields.items()
                    )
                },
            }

            for name, fields in COLUMN_CATALOG.items()
        },

        "operations": [
            "aggregate",
            "grouped_aggregate"
        ],

        "metrics": [
            "count",
            "count_distinct",
            "count_if",
            "min_date",
            "max_date",
            "avg_resolution_hours",
            "sla_compliance",
            "percent_of_total",
        ],

        "limits": {
            "filters": MAX_FILTERS,
            "metrics": MAX_METRICS,
            "group_by": MAX_GROUPS,
            "in_values": MAX_IN_ITEMS,
            "default_page_size": DEFAULT_PAGE_SIZE,
            "max_page_size": MAX_PAGE_SIZE,
            "max_offset": MAX_OFFSET,
        },
    }


# ============================================================
# 19. COMPROBAR EL CATÁLOGO CONTRA MODELOS EXISTENTES
# ============================================================

def validar_catalogo_modelos() -> list[str]:

    """
    Comprueba que las columnas autorizadas existan
    realmente en los cuatro modelos SQLAlchemy.

    NO necesita conexión SQL Server.
    NO realiza escrituras.
    """

    errors = []

    for source, (
        module_name,
        class_name
    ) in MODEL_PATHS.items():

        try:

            model = getattr(
                import_module(module_name),
                class_name
            )

            if model.__tablename__ != source:
                errors.append(
                    f"{source}: __tablename__ no coincide"
                )

            actual = {
                column.name
                for column in model.__table__.columns
            }

            missing = (
                set(COLUMN_CATALOG[source])
                - actual
            )

            if missing:
                errors.append(
                    f"{source}: faltan columnas "
                    f"{sorted(missing)}"
                )

        except (ImportError, AttributeError) as exc:
            errors.append(
                f"{source}: {exc}"
            )

    return errors