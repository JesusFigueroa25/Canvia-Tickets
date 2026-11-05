from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from importlib import import_module
import logging
from typing import Any, Mapping

from sqlalchemy import (
    Date,
    Float,
    case,
    cast,
    func,
    literal,
    literal_column,
    select,
)

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.ai.query_service import (
    COLUMN_CATALOG,
    MODEL_PATHS,
    SLA_FIELDS,
    validar_plan_analitico,
)


LOGGER = logging.getLogger(__name__)

SOURCE_NAMES = frozenset(MODEL_PATHS)


# ============================================================
# 1. ERRORES INTERNOS
# ============================================================

class QueryRepositoryError(RuntimeError):
    """
    Error de configuración o construcción del repositorio.
    """


def _reject(
    status: str,
    detail: str,
    *,
    source: str | None = None,
) -> dict[str, Any]:

    return {
        "status": status,
        "source": source,
        "execution_mode": "dynamic_query",
        "detail": detail,
        "metrics": {},
        "data": [],
        "coverage": "unknown",
        "has_more": False,
        "evidence": {
            "validated": False,
            "executed": False,
        },
    }


# ============================================================
# 2. RESOLVER EL MODELO SQLALCHEMY AUTORIZADO
# ============================================================

def _model(source: str):

    if source not in SOURCE_NAMES:
        raise QueryRepositoryError(
            "Fuente no autorizada"
        )

    module_name, class_name = MODEL_PATHS[source]

    model = getattr(
        import_module(module_name),
        class_name,
    )

    table = model.__table__

    if (
        table.name != source
        or table.schema not in (None, "dbo")
    ):
        raise QueryRepositoryError(
            "Modelo o esquema fuera del catálogo"
        )

    missing = (
        set(COLUMN_CATALOG[source])
        - set(table.columns.keys())
    )

    if missing:
        raise QueryRepositoryError(
            "Columnas del catálogo no coinciden con el modelo"
        )

    return model


def _column(
    model,
    source: str,
    name: str,
):

    if name not in COLUMN_CATALOG[source]:
        raise QueryRepositoryError(
            "Columna no autorizada"
        )

    return model.__table__.c[name]


# ============================================================
# 3. NORMALIZACIÓN DE CAMPOS CATEGÓRICOS
# ============================================================

def _categorical(col):
    return func.coalesce(
        func.nullif(
            func.trim(col),
            literal_column("N''")
        ),
        literal_column("N'Sin especificar'")
    )

# ============================================================
# 4. OPERACIONES CON FECHAS
# ============================================================

def _next_day(value: str) -> date | None:

    day = date.fromisoformat(value)

    if day == date.max:
        return None

    return day + timedelta(days=1)


def _through_day(col, value: str):
    """
    Hasta el final del día indicado, inclusive.
    """

    nxt = _next_day(value)

    if nxt is not None:
        return col < nxt

    return cast(col, Date) <= date.max


def _after_day(col, value: str):
    """
    Mayor que el día completo indicado.
    """

    nxt = _next_day(value)

    if nxt is not None:
        return col >= nxt

    return literal(False)


# ============================================================
# 5. CONSTRUCCIÓN DE FILTROS
# ============================================================

def _predicate(
    model,
    source: str,
    item: Mapping[str, Any],
):

    field = item["field"]
    op = item["operator"]
    value = item["value"]

    rule = COLUMN_CATALOG[source][field]

    raw = _column(
        model,
        source,
        field,
    )

    # --------------------------------------------------------
    # Valores nulos
    # --------------------------------------------------------

    if op == "is_null":
        return raw.is_(None)

    if op == "is_not_null":
        return raw.is_not(None)

    # --------------------------------------------------------
    # Fechas
    # --------------------------------------------------------

    if rule.kind == "date":

        if op == "date_range":

            return (
                (
                    raw >= date.fromisoformat(
                        value["from"]
                    )
                )
                & _through_day(
                    raw,
                    value["to"],
                )
            )

        day = date.fromisoformat(value)

        if op == "eq":

            return (
                (raw >= day)
                & _through_day(
                    raw,
                    value,
                )
            )

        if op == "gt":
            return _after_day(raw, value)

        if op == "gte":
            return raw >= day

        if op == "lt":
            return raw < day

        if op == "lte":
            return _through_day(raw, value)

        raise QueryRepositoryError(
            "Operador de fecha no soportado"
        )

    # --------------------------------------------------------
    # Campos categóricos
    # --------------------------------------------------------

    if rule.kind == "category":
        col = _categorical(raw)
    else:
        col = raw

    if op == "eq":
        return col == value

    if op == "ne":
        return col != value

    if op == "in":
        return col.in_(value)

    if op == "not_in":
        return col.not_in(value)

    # --------------------------------------------------------
    # Búsqueda literal por descripción
    # --------------------------------------------------------

    if op == "contains":

        escaped = (
            value
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )

        return col.like(
            "%" + escaped + "%",
            escape="\\",
        )

    raise QueryRepositoryError(
        "Operador no soportado"
    )


# ============================================================
# 6. FUNCIONES DE AGREGACIÓN
# ============================================================

def _sum_condition(condition):
    """
    COUNT condicional mediante SUM(CASE WHEN ...).
    """

    return func.coalesce(
        func.sum(
            case(
                (condition, 1),
                else_=0,
            )
        ),
        0,
    )


def _ratio(
    numerator,
    denominator,
):
    """
    Porcentaje con denominador protegido.
    Sin medibles devuelve NULL.
    """

    return case(
        (
            denominator > 0,
            numerator
            * literal(100.0)
            / denominator,
        ),
        else_=None,
    )


# ============================================================
# 7. HORAS DE RESOLUCIÓN
# ============================================================

def _duration_components(
    model,
    source: str,
):

    if source.endswith("_consolidated"):
        initial = "Fecha_Apertura"
    else:
        initial = "Fecha_Creacion"

    start = _column(
        model,
        source,
        initial,
    )

    end = _column(
        model,
        source,
        "Fecha_Resolucion",
    )

    valid = (
        start.is_not(None)
        & end.is_not(None)
        & (end >= start)
    )

    # La palabra second es una constante del desarrollador,
    # no un valor que pueda suministrar GPT.

    seconds = func.datediff_big(
        literal_column("second"),
        start,
        end,
    )

    valid_seconds = case(
        (
            valid,
            cast(seconds, Float),
        ),
        else_=None,
    )

    average_hours = (
        func.avg(valid_seconds)
        / literal(3600.0)
    )

    valid_count = _sum_condition(
        valid
    )

    return average_hours, valid_count


# ============================================================
# 8. CONSTRUCCIÓN DE MÉTRICAS
# ============================================================

def _metric_expressions(
    model,
    source: str,
    spec: Mapping[str, Any],
):

    alias = spec["alias"]
    fn = spec["function"]
    field = spec["field"]

    side = []

    # --------------------------------------------------------
    # COUNT
    # --------------------------------------------------------

    if fn == "count":

        expr = func.count()

    # --------------------------------------------------------
    # COUNT DISTINCT
    # --------------------------------------------------------

    elif fn == "count_distinct":

        col = _column(
            model,
            source,
            field,
        )

        expr = func.count(
            func.distinct(
                func.nullif(
                    func.trim(col),
                    "",
                )
            )
        )

    # --------------------------------------------------------
    # COUNT IF
    # --------------------------------------------------------

    elif fn == "count_if":

        condition = _predicate(
            model,
            source,
            spec["condition"],
        )

        expr = _sum_condition(
            condition
        )

    # --------------------------------------------------------
    # FECHA MÍNIMA / MÁXIMA
    # --------------------------------------------------------

    elif fn in {
        "min_date",
        "max_date",
    }:

        col = cast(
            _column(
                model,
                source,
                field,
            ),
            Date,
        )

        if fn == "min_date":
            expr = func.min(col)
        else:
            expr = func.max(col)

    # --------------------------------------------------------
    # PROMEDIO DE HORAS DE RESOLUCIÓN
    # --------------------------------------------------------

    elif fn == "avg_resolution_hours":

        expr, valid_count = _duration_components(
            model,
            source,
        )

        side.extend([
            (
                alias + "_validos",
                valid_count,
            ),
            (
                alias + "_excluidos",
                func.count() - valid_count,
            ),
        ])

    # --------------------------------------------------------
    # CUMPLIMIENTO SLA / OLA
    # --------------------------------------------------------

    elif fn == "sla_compliance":

        if field not in SLA_FIELDS:
            raise QueryRepositoryError(
                "Columna SLA/OLA inválida"
            )

        col = _column(
            model,
            source,
            field,
        )

        passed = _sum_condition(
            col == "Cumplido"
        )

        failed = _sum_condition(
            col == "No cumplido"
        )

        measurable = passed + failed

        expr = _ratio(
            passed,
            measurable,
        )

        side.extend([
            (
                alias + "_cumplidos",
                passed,
            ),
            (
                alias + "_incumplidos",
                failed,
            ),
            (
                alias + "_medibles",
                measurable,
            ),
        ])

    # --------------------------------------------------------
    # PORCENTAJE SOBRE EL TOTAL
    # --------------------------------------------------------

    elif fn == "percent_of_total":

        condition = _predicate(
            model,
            source,
            spec["condition"],
        )

        numerator = _sum_condition(
            condition
        )

        denominator = func.count()

        expr = _ratio(
            numerator,
            denominator,
        )

        side.extend([
            (
                alias + "_numerador",
                numerator,
            ),
            (
                alias + "_denominador",
                denominator,
            ),
        ])

    else:

        raise QueryRepositoryError(
            "Métrica inválida"
        )

    return [
        (alias, expr)
    ] + side


# ============================================================
# 9. AGRUPACIONES
# ============================================================

def _group_expression(
    model,
    source: str,
    spec: Mapping[str, str],
):

    col = _column(
        model,
        source,
        spec["field"],
    )

    bucket = spec["bucket"]

    if bucket == "value":
        return _categorical(
            col
        )

    if bucket == "year":
        return func.year(
            col
        )

    if bucket == "month":
        return func.datefromparts(
            func.year(col),
            func.month(col),
            literal_column("1"),
        )

    if bucket == "day":
        return cast(
            col,
            Date,
        )

    raise QueryRepositoryError(
        "Agrupación temporal inválida"
    )


# ============================================================
# 10. SERIALIZACIÓN DE VALORES
# ============================================================

def _json_value(
    value: Any,
    *,
    bucket: str | None = None,
) -> Any:

    if value is None:
        return None

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, datetime):

        if bucket == "month":
            return value.strftime("%Y-%m")

        if bucket == "day":
            return value.date().isoformat()

        return value.isoformat()

    if isinstance(value, date):

        if bucket == "month":
            return value.strftime("%Y-%m")

        return value.isoformat()

    if isinstance(value, str) and bucket == "month":
        return value[:7]

    return value


def _serialize_row(
    row: Mapping[str, Any],
    group_buckets: Mapping[str, str],
    rounded_metrics: set[str],
):

    values = {}

    for key, value in row.items():

        if key == "__matching_rows":
            continue

        v = _json_value(
            value,
            bucket=group_buckets.get(key),
        )

        if (
            key in rounded_metrics
            and isinstance(v, (int, float))
        ):
            v = round(
                float(v),
                2,
            )

        values[key] = v

    return values


# ============================================================
# 11. EJECUCIÓN PRINCIPAL
# ============================================================

def ejecutar_consulta_dinamica(
    db: Session,
    plan: Mapping[str, Any],
) -> dict[str, Any]:

    """
    Revalida un plan y ejecuta una consulta SELECT.

    No realiza commit ni rollback.
    La transacción es responsabilidad del orquestador.
    """

    # --------------------------------------------------------
    # 1. Revalidar siempre
    # --------------------------------------------------------

    result = validar_plan_analitico(
        plan
    )

    if result["status"] != "valid":

        return _reject(
            result["status"],
            result.get(
                "detail",
                "Plan no válido",
            ),
            source=(
                plan.get("source")
                if isinstance(plan, dict)
                else None
            ),
        )

    p = result["normalized_plan"]

    source = p["source"]

    # --------------------------------------------------------
    # 2. Validar sesión SQLAlchemy
    # --------------------------------------------------------

    if not isinstance(db, Session):

        return _reject(
            "invalid_plan",
            "Se requiere una sesión SQLAlchemy",
            source=source,
        )

    # Evitar consultas si la sesión contiene
    # INSERT, UPDATE o DELETE pendientes.

    if db.new or db.dirty or db.deleted:

        return _reject(
            "invalid_plan",
            (
                "La sesión contiene cambios pendientes; "
                "utilice una sesión de lectura limpia"
            ),
            source=source,
        )

    try:

        # ----------------------------------------------------
        # 3. Resolver modelo
        # ----------------------------------------------------

        model = _model(
            source
        )

        selected = []

        labels = {}

        buckets = {}

        group_exprs = []

        # ----------------------------------------------------
        # 4. Dimensiones
        # ----------------------------------------------------

        for group in p["group_by"]:

            name = group["field"]

            expr = _group_expression(
                model,
                source,
                group,
            )

            labels[name] = expr.label(
                name
            )

            selected.append(
                labels[name]
            )

            group_exprs.append(
                expr
            )

            buckets[name] = group["bucket"]

        # ----------------------------------------------------
        # 5. Métricas y campos derivados
        # ----------------------------------------------------

        requested_aliases = {
            m["alias"]
            for m in p["metrics"]
        }

        emitted_names = (
            set(labels)
            | {"__matching_rows"}
        )

        rounded_metrics = set()

        for metric in p["metrics"]:

            expressions = _metric_expressions(
                model,
                source,
                metric,
            )

            for name, expr in expressions:

                if name in emitted_names:

                    raise QueryRepositoryError(
                        "Alias de salida repetido o reservado"
                    )

                if (
                    name != metric["alias"]
                    and name in requested_aliases
                ):

                    raise QueryRepositoryError(
                        "Campo derivado coincide con otra métrica"
                    )

                emitted_names.add(
                    name
                )

                labels[name] = expr.label(
                    name
                )

                selected.append(
                    labels[name]
                )

            if metric["function"] in {
                "sla_compliance",
                "percent_of_total",
                "avg_resolution_hours",
            }:

                rounded_metrics.add(
                    metric["alias"]
                )

        # Conteo interno para detectar un conjunto vacío.
        # Se utiliza únicamente en agregaciones globales.

        if not group_exprs:

            selected.insert(
                0,
                func.count().label(
                    "__matching_rows"
                ),
            )

        # ----------------------------------------------------
        # 6. Construir SELECT
        # ----------------------------------------------------

        stmt = select(
            *selected
        ).select_from(
            model
        )

        # ----------------------------------------------------
        # 7. Aplicar filtros
        # ----------------------------------------------------

        filters = [
            _predicate(
                model,
                source,
                item,
            )
            for item in p["filters"]
        ]

        if filters:

            stmt = stmt.where(
                *filters
            )

        # ----------------------------------------------------
        # 8. Evitar grupos temporales NULL
        # ----------------------------------------------------

        for group in p["group_by"]:

            if group["bucket"] != "value":

                stmt = stmt.where(
                    _column(
                        model,
                        source,
                        group["field"],
                    ).is_not(None)
                )

        # ----------------------------------------------------
        # 9. Agrupación, ordenamiento y paginación
        # ----------------------------------------------------

        if group_exprs:

            stmt = stmt.group_by(
                *group_exprs
            )

            ordered = set()

            for ordering in p["order_by"]:

                name = ordering["field"]

                expr = labels[name]

                if ordering["direction"] == "asc":

                    stmt = stmt.order_by(
                        expr.asc()
                    )

                else:

                    stmt = stmt.order_by(
                        expr.desc()
                    )

                ordered.add(
                    name
                )

            # Desempate estable para paginación.
            # SQL Server requiere ORDER BY para OFFSET.

            for name in buckets:

                if name not in ordered:

                    stmt = stmt.order_by(
                        labels[name].asc()
                    )

            stmt = (
                stmt
                .offset(p["offset"])
                .limit(p["limit"] + 1)
            )

        # ----------------------------------------------------
        # 10. Ejecutar SELECT
        # ----------------------------------------------------

        with db.no_autoflush:

            rows = (
                db.execute(stmt)
                .mappings()
                .all()
            )

        # ----------------------------------------------------
        # 11. Resultado agregado
        # ----------------------------------------------------

        if p["operation"] == "aggregate":

            record = (
                rows[0]
                if rows
                else {}
            )

            matching = int(
                record.get("__matching_rows") or 0
            )

            metrics = _serialize_row(
                record,
                {},
                rounded_metrics,
            )

            data = []

            has_more = False

            coverage = "complete"

            status = (
                "success"
                if matching
                else "empty"
            )

        # ----------------------------------------------------
        # 12. Resultado agrupado
        # ----------------------------------------------------

        else:

            has_more = (
                len(rows) > p["limit"]
            )

            data = [
                _serialize_row(
                    row,
                    buckets,
                    rounded_metrics,
                )
                for row in rows[:p["limit"]]
            ]

            metrics = {}

            matching = None

            coverage = (
                "partial"
                if has_more or p["offset"] > 0
                else "complete"
            )

            status = (
                "success"
                if data
                else "empty"
            )

        # ----------------------------------------------------
        # 13. Normalizar respuesta
        # ----------------------------------------------------

        limitations = []

        if coverage == "partial":

            limitations.append(
                "Resultado paginado: no representa todos los grupos"
            )

        if source.endswith("_consolidated"):

            default_date = "Fecha_Apertura"

        else:

            default_date = "Fecha_Creacion"

        return {
            "status": status,
            "source": source,
            "execution_mode": "dynamic_query",
            "operation": p["operation"],
            "applied_filters": p["filters"],
            "group_by": p["group_by"],
            "metrics": metrics,
            "data": data,
            "coverage": coverage,
            "has_more": has_more,
            "limit": p["limit"],
            "offset": p["offset"],
            "limitations": limitations,
            "evidence": {
                "repository": "ai_query_repository",
                "plan_version": 1,
                "validated": True,
                "executed": True,
                "date_field_default": default_date,
                "matching_rows": matching,
            },
        }

    # --------------------------------------------------------
    # 14. Manejo de errores
    # --------------------------------------------------------

    except (
        SQLAlchemyError,
        QueryRepositoryError,
        ImportError,
        AttributeError,
    ):

        LOGGER.exception(
            "Error al ejecutar consulta dinámica "
            "autorizada sobre %s",
            source,
        )

        return _reject(
            "backend_error",
            "No se pudo ejecutar la consulta dinámica validada",
            source=source,
        )
