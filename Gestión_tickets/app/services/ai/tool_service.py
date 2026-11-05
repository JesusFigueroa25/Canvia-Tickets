from __future__ import annotations
import inspect
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from importlib import import_module
from math import isfinite
from typing import Any, Mapping
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SOURCE_MODULES = {
    "incident_consolidated": "app.services.incident_consolidated_service",
    "incident_sla": "app.services.incident_sla_service",
    "requirement_consolidated": "app.services.requirement_consolidated_service",
    "requirement_sla": "app.services.requirement_sla_service",
}

FILTERS = {
    "incident_consolidated": frozenset({
        "desde", "hasta", "prioridad", "motivo_estado", "motivo_resolucion",
        "grupo_resolutor", "proyecto", "nombre_resolutor", "descripcion",
        "periodo", "tipo_incidente", "detalle_id",
    }),
    "incident_sla": frozenset({
        "desde", "hasta", "grupo_resolutor", "prioridad", "proyecto", "tipo_incidente",
    }),
    "requirement_consolidated": frozenset({
        "desde", "hasta", "prioridad", "motivo_estado", "motivo_resolucion",
        "grupo_resolutor", "proyecto",
    }),
    "requirement_sla": frozenset({
        "desde", "hasta", "grupo_resolutor", "prioridad", "categoria", "proyecto",
        "tipo_requerimiento", "condicion_dia", "sla_solucion_condicion",
    }),
}

DATE_FIELD = {
    "incident_consolidated": "Fecha_Apertura",
    "incident_sla": "Fecha_Creacion",
    "requirement_consolidated": "Fecha_Apertura",
    "requirement_sla": "Fecha_Creacion",
}

# No representa un límite de SQL Server. Controla el volumen enviado al LLM.
MAX_ROWS = 500
MAX_TEXT_CHARS = 2000
MAX_LIST_FILTER = 30
OPTIONS_KEYS = frozenset({
    "mode", "metric", "order", "limit", "buscar", "pagina", "tamano",
    "ranking_desde", "ranking_hasta", "require_complete",
})


@dataclass(frozen=True)
class ToolSpec:
    tool_id: str
    source: str
    service: str
    output_fields: tuple[str, ...]
    capabilities: tuple[str, ...]
    category: str = "primary"
    coverage: str = "complete"       # complete, limited, paginated, conditional
    fixed_top: int | None = None       # Top N impuesto por service
    rows_key: str | None = None        # Campo que contiene lista de resultados
    rank_metric: str | None = None     # Métrica del ranking SQL/service
    effective_filters: frozenset[str] = frozenset()
    limitations: tuple[str, ...] = ()
    post_processing: tuple[str, ...] = ("sort", "limit")

    @property
    def date_field(self) -> str:
        return DATE_FIELD[self.source]

    @property
    def allowed_filters(self) -> frozenset[str]:
        return FILTERS[self.source]


TOOL_REGISTRY: dict[str, dict[str, ToolSpec]] = {}


def _add(
    tool_id: str, source: str, service: str, fields: str,
    capabilities: str, *, mode: str = "default", category: str = "primary",
    coverage: str = "complete", fixed_top: int | None = None,
    rows_key: str | None = None, rank_metric: str | None = None,
    exclude_filters: tuple[str, ...] = (), limitations: tuple[str, ...] = (),
) -> None:
    spec = ToolSpec(
        tool_id=tool_id, source=source, service=service,
        output_fields=tuple(fields.split()), capabilities=tuple(capabilities.split()),
        category=category, coverage=coverage, fixed_top=fixed_top,
        rows_key=rows_key, rank_metric=rank_metric,
        effective_filters=FILTERS[source] - frozenset(exclude_filters),
        limitations=limitations,
        post_processing=("sort", "limit") if (rank_metric or rows_key) else (),
    )
    TOOL_REGISTRY.setdefault(tool_id, {})[mode] = spec


# ========================= INC. CONSOLIDADOS (9) =========================
S = "incident_consolidated"
_add("ic_consultar_kpis", S, "obtener_kpis", "total_tickets total_proyectos alta_criticidad porcentaje_alta_criticidad", "count kpi")
_add("ic_consultar_volumen", S, "obtener_volumen_mensual", "tickets", "trend comparison", rank_metric="tickets")
_add("ic_consultar_proyectos", S, "obtener_proyectos", "proyecto cantidad", "ranking distribution comparison", rank_metric="cantidad")
_add("ic_consultar_tipos", S, "obtener_tipos", "tipo_incidente cantidad", "ranking distribution", coverage="conditional", rank_metric="cantidad", limitations=("Limite maximo de 100 tipos",))
_add("ic_consultar_prioridades", S, "obtener_prioridades", "prioridad cantidad", "distribution", rank_metric="cantidad")
_add("ic_consultar_prioridades_mensuales", S, "obtener_prioridad_mensual", "total_tickets prioridades", "trend distribution")
_add("ic_consultar_resolutores", S, "obtener_rendimiento_resolutores", "total_tickets nombre_resolutor", "ranking trend", coverage="paginated", rows_key="resolutores", rank_metric="total_tickets")
_add("ic_consultar_descripciones", S, "obtener_incidentes_porcentajes", "cantidad porcentaje", "ranking distribution", mode="porcentajes", coverage="conditional", rows_key="descripciones", rank_metric="cantidad")
_add("ic_consultar_descripciones", S, "obtener_explorador_descripciones", "total_tickets", "trend distribution", mode="explorador", coverage="limited", fixed_top=10, rows_key="descripciones", rank_metric="total_tickets")
_add("ic_consultar_descripciones", S, "obtener_top_descripciones_proyectos", "tickets", "ranking distribution", mode="por_proyecto", coverage="limited", fixed_top=10, rows_key="combinaciones", rank_metric="tickets")
_add("ic_consultar_detalles", S, "obtener_detalle_eventos_tecnicos", "total", "ranking detail", mode="eventos", coverage="limited", fixed_top=10, rows_key="detalles", rank_metric="total")
_add("ic_consultar_detalles", S, "obtener_top_detalles", "tickets", "ranking detail", mode="top", coverage="limited", fixed_top=10, rows_key="detalles", rank_metric="tickets")

# =============================== INC. SLA (7+1) ===========================
S = "incident_sla"
_add("is_consultar_kpis", S, "obtener_kpis", "total_tickets sla_respuesta sla_solucion ola_respuesta ola_solucion", "count kpi")
_add("is_consultar_proyectos", S, "obtener_explorador_proyectos", "proyecto tickets medibles sin_medicion cumple incumple sla_solucion sla_respuesta porcentaje_volumen", "ranking distribution kpi", rank_metric="tickets")
_add("is_consultar_tendencia_sla", S, "obtener_sla_solucion_tendencia", "mes cumplimiento objetivo medibles", "trend kpi")
_add("is_consultar_volumen", S, "obtener_volumen_incidentes", "mes tickets media_movil_3m", "trend", rank_metric="tickets")
_add("is_consultar_pareto_tipos", S, "obtener_pareto_tipos", "tipo_incidente tickets porcentaje porcentaje_acumulado", "ranking pareto", rank_metric="tickets", exclude_filters=("tipo_incidente",))
_add("is_consultar_tendencia_tipos", S, "obtener_tendencia_incidentes", "grupo series", "trend", coverage="conditional")
_add("is_consultar_resolutores", S, "obtener_desempeno_resolutores", "resolutor tickets sla", "ranking kpi", rank_metric="tickets")
_add("is_consultar_insights", S, "obtener_insights", "estado_sla principal_foco prioridad_vigilar", "insight", category="auxiliary", limitations=("Objetivo de SLA de solucion 95 % del dashboard",))

# ========================= REQ. CONSOLIDADOS (6+1) ========================
S = "requirement_consolidated"
_add("rc_consultar_kpis", S, "obtener_kpis", "total_tickets total_proyectos alta_criticidad porcentaje_alta_criticidad", "count kpi")
_add("rc_consultar_volumen", S, "obtener_volumen_mensual", "tickets", "trend comparison", rank_metric="tickets")
_add("rc_consultar_proyectos", S, "obtener_proyectos", "proyecto cantidad", "ranking distribution comparison", rank_metric="cantidad")
_add("rc_consultar_tipos", S, "obtener_tipos", "tipo_requerimiento cantidad", "ranking distribution", coverage="conditional", rank_metric="cantidad", limitations=("Limite maximo de 100 tipos",))
_add("rc_consultar_prioridades", S, "obtener_prioridades", "prioridad cantidad", "distribution", rank_metric="cantidad")
_add("rc_consultar_prioridades_mensuales", S, "obtener_prioridad_mensual", "total_tickets prioridades", "trend distribution")
_add("rc_consultar_top_proyectos", S, "obtener_top_proyectos", "total_tickets", "ranking trend", category="auxiliary", coverage="limited", fixed_top=10, rows_key="proyectos", rank_metric="total_tickets")

# =============================== REQ. SLA (12+4) ==========================
S = "requirement_sla"
_add("rs_consultar_kpis", S, "obtener_kpis", "total_tickets sla_respuesta sla_solucion ola_respuesta ola_solucion cant_req_cumplidos cant_req_no_cumplidos porcentaje_cumpl_req", "count kpi", limitations=("porcentaje_cumpl_req usa todos los tickets; sla_solucion solo medibles",))
_add("rs_consultar_condiciones_sla", S, "obtener_porcentaje_cumplimiento_sla", "total_tickets cumplidos incumplidos cancelados otros porcentaje_cumpl_req", "kpi distribution", rows_key="distribucion")
_add("rs_consultar_proyectos", S, "obtener_proyectos", "proyecto tickets medibles sin_medicion cumple incumple sla_solucion sla_respuesta porcentaje_volumen", "ranking kpi", rank_metric="tickets")
_add("rs_consultar_volumen", S, "obtener_volumen_requerimientos", "tickets tendencia", "trend", rank_metric="tickets")
_add("rs_consultar_tendencia_sla", S, "obtener_sla_solucion_tendencia", "cumplidos incumplidos", "trend kpi")
_add("rs_consultar_tipos", S, "obtener_pareto_requerimientos", "tipo_requerimiento cantidad porcentaje porcentaje_acumulado", "ranking pareto", mode="volumen", coverage="limited", fixed_top=10, rank_metric="cantidad", exclude_filters=("tipo_requerimiento",))
_add("rs_consultar_tipos", S, "obtener_cumplimiento_sla_tipo", "tipo_requerimiento total_tickets cumplidos incumplidos cancelados", "ranking kpi", mode="cumplimiento", rows_key="distribucion")
_add("rs_consultar_tendencia_tipos", S, "obtener_tendencia_requerimientos", "tickets ranking tipo_requerimiento", "trend", coverage="conditional")
_add("rs_consultar_explorador_tipos", S, "obtener_explorador_tipos", "tot c i porcentaje_inc", "trend kpi", coverage="limited", fixed_top=10)
_add("rs_consultar_horarios", S, "obtener_cumplimiento_sla_horario", "condicion_dia total_tickets cumplidos incumplidos cancelados total_cumplidos total_incumplidos total_cancelados", "ranking distribution", rows_key="distribucion", coverage="conditional", limitations=("Agrupa solo tres condiciones del dia",))
_add("rs_consultar_prioridades", S, "obtener_cumplimiento_sla_prioridad", "prioridad total_tickets cumplidos incumplidos cancelados total_cumplidos total_incumplidos total_cancelados", "ranking kpi", rows_key="distribucion", coverage="conditional", limitations=("Agrupa solo prioridades P1-P4",))
_add("rs_consultar_categorias", S, "obtener_pareto_sla_categorias", "total_categorias total_general incumplidos porcentaje_req porcentaje_acumulado", "ranking pareto", rows_key="filas", rank_metric="incumplidos")
_add("rs_consultar_resolutores", S, "obtener_resolutores", "resolutor cantidad", "ranking", coverage="limited", fixed_top=10, rank_metric="cantidad")
_add("rs_consultar_participacion_proyectos", S, "obtener_participacion_proyectos", "proyecto tickets participacion", "distribution", category="auxiliary", coverage="limited", fixed_top=10, rank_metric="tickets", limitations=("Participacion calculada solo dentro del Top10",))
_add("rs_consultar_distribucion_dia", S, "obtener_distribucion_condicion_dia", "condicion_dia tickets porcentaje", "distribution", category="auxiliary", coverage="conditional", rows_key="distribucion", rank_metric="tickets")
_add("rs_consultar_top_categorias", S, "obtener_top10_cumplimiento_sla_categoria", "categoria total_tickets cumplidos incumplidos cancelados", "ranking", category="auxiliary", coverage="limited", fixed_top=10, rows_key="distribucion", rank_metric="total_tickets")
_add("rs_consultar_pareto_grafico", S, "obtener_pareto_sla_categorias_grafico", "total_categorias total_incumplimientos serie", "pareto", category="auxiliary", coverage="limited", fixed_top=10)

assert len(TOOL_REGISTRY) == 40, "El catálogo debe tener 34 principales y 6 auxiliares"
assert sum(next(iter(v.values())).category == "primary" for v in TOOL_REGISTRY.values()) == 34


def listar_tools(*, include_auxiliary: bool = False) -> list[dict[str, Any]]:
    """Metadatos seguros para el planificador; no expone objetos Python."""
    result = []
    for tool_id, modes in TOOL_REGISTRY.items():
        spec = next(iter(modes.values()))
        if not include_auxiliary and spec.category == "auxiliary":
            continue
        result.append({
            "tool_id": tool_id, "source": spec.source,
            "category": spec.category, "date_field": spec.date_field,
            "modes": list(modes), "capabilities": list(spec.capabilities),
            "allowed_filters": sorted(spec.allowed_filters),
            "effective_filters_by_mode": {
                mode: sorted(part.effective_filters) for mode, part in modes.items()
            },
            "metrics_by_mode": {
                mode: list(part.output_fields) for mode, part in modes.items()
            },
            "coverage_by_mode": {
                mode: part.coverage for mode, part in modes.items()
            },
        })
    return result


def validar_firmas_services() -> list[str]:
    """Comprueba nombres y argumentos sin ejecutar consultas SQL."""
    errors: list[str] = []
    for tool_id, modes in TOOL_REGISTRY.items():
        for mode, spec in modes.items():
            try:
                service = _get_service(spec)
                params = set(inspect.signature(service).parameters)
                if "db" not in params:
                    errors.append(f"{tool_id}/{mode}: falta db")
                for key in spec.effective_filters - params:
                    errors.append(f"{tool_id}/{mode}: falta parámetro {key}")
            except (ImportError, AttributeError) as exc:
                errors.append(f"{tool_id}/{mode}: {exc}")
    return errors


def _fail(status: str, detail: str, *, source: str | None = None,
          tool_id: str | None = None) -> dict[str, Any]:
    return {
        "status": status, "source": source, "tool_id": tool_id,
        "detail": detail, "applied_filters": {}, "metrics": {}, "data": None,
        "coverage": "unknown", "complete": False,
        "limitations": [], "evidence": {},
    }


def _normalize_filters(source: str, filters: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(filters, dict):
        raise ValueError("filters debe ser un objeto JSON")
    unknown = set(filters) - FILTERS[source]
    if unknown:
        raise ValueError("Filtros no admitidos: " + ", ".join(sorted(unknown)))
    normalized: dict[str, Any] = {}
    for key, value in filters.items():
        if value is None:
            continue  # Un valor ausente no debe convertirse en filtro SQL.
        if key in ("desde", "hasta"):
            if isinstance(value, datetime):
                raise ValueError(f"{key} debe ser fecha YYYY-MM-DD, sin hora")
            if isinstance(value, date):
                normalized[key] = value
            elif isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                normalized[key] = date.fromisoformat(value)
            else:
                raise ValueError(f"{key}: fecha inválida (YYYY-MM-DD)")
        elif key == "periodo":
            if not isinstance(value, str) or not re.fullmatch(r"(?:19|20)\d{2}-(?:0[1-9]|1[0-2])", value):
                raise ValueError("periodo debe tener formato YYYY-MM")
            normalized[key] = value
        elif key in ("tipo_incidente", "tipo_requerimiento"):
            if not isinstance(value, list) or not (1 <= len(value) <= MAX_LIST_FILTER):
                raise ValueError(f"{key} debe ser lista de 1 a {MAX_LIST_FILTER} textos")
            if not all(isinstance(v, str) and 0 < len(v.strip()) <= 200 for v in value):
                raise ValueError(f"{key}: contiene elementos inválidos")
            normalized[key] = [v.strip() for v in value]
        else:
            if not isinstance(value, str) or not (1 <= len(value.strip()) <= 500):
                raise ValueError(f"{key}: texto inválido")
            normalized[key] = value.strip()
    if normalized.get("desde") and normalized.get("hasta") and normalized["desde"] > normalized["hasta"]:
        raise ValueError("desde no puede ser posterior a hasta")
    if normalized.get("detalle_id") and len(normalized["detalle_id"]) > 20:
        raise ValueError("detalle_id supera 20 caracteres")
    if normalized.get("condicion_dia") not in (None, "Lun-Vie", "Fuera Horario", "Fin Sem."):
        raise ValueError("condicion_dia inválida")
    if normalized.get("sla_solucion_condicion") not in (None, "Cumplido", "No cumplido"):
        raise ValueError("sla_solucion_condicion inválida")
    if source.endswith("_sla") and "prioridad" in normalized:
        if normalized["prioridad"] not in ("P1", "P2", "P3", "P4"):
            raise ValueError("Prioridad SLA debe ser P1, P2, P3 o P4")
    if source.endswith("_consolidated") and "prioridad" in normalized:
        if normalized["prioridad"] not in ("1-Critical", "2-High", "3-Medium", "4-Low"):
            # Códigos atípicos requieren validación frente a opciones reales.
            raise ValueError("Prioridad consolidada no estándar: verificar con /filters")
    return normalized


def _normalize_options(options: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(options, dict):
        raise ValueError("options debe ser un objeto JSON")
    unknown = set(options) - OPTIONS_KEYS
    if unknown:
        raise ValueError("Opciones no admitidas: " + ", ".join(sorted(unknown)))
    o = dict(options)
    for key in ("limit", "pagina", "tamano", "ranking_desde", "ranking_hasta"):
        if key in o and (type(o[key]) is not int or o[key] < 1 or o[key] > 500):
            raise ValueError(f"{key}: entero fuera del rango 1..500")
    if "order" in o and o["order"] not in ("asc", "desc"):
        raise ValueError("order debe ser asc o desc")
    if "require_complete" in o and type(o["require_complete"]) is not bool:
        raise ValueError("require_complete debe ser booleano")
    for key in ("mode", "metric", "buscar"):
        if key in o and (not isinstance(o[key], str) or not o[key].strip() or len(o[key]) > 200):
            raise ValueError(f"{key}: texto inválido")
    if o.get("ranking_desde", 1) > o.get("ranking_hasta", 5):
        raise ValueError("ranking_desde no puede superar ranking_hasta")
    return o


def _jsonable(value: Any, *, depth: int = 0) -> Any:
    if depth > 12:
        raise ValueError("Resultado anidado demasiado profundo")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        if isinstance(value, float) and not isfinite(value):
            raise ValueError("Resultado numérico no finito")
        return value
    if isinstance(value, Mapping):
        return {str(k): _jsonable(v, depth=depth + 1) for k, v in value.items()}
    if hasattr(value, "_mapping"):
        return _jsonable(value._mapping, depth=depth + 1)
    if isinstance(value, (list, tuple)):
        if len(value) > MAX_ROWS:
            raise OverflowError("Demasiadas filas para una respuesta de IA")
        return [_jsonable(v, depth=depth + 1) for v in value]
    if hasattr(value, "model_dump"):
        return _jsonable(value.model_dump(), depth=depth + 1)
    raise ValueError(f"Tipo de respuesta no permitido: {type(value).__name__}")


def _rows(data: Any, spec: ToolSpec) -> list[dict[str, Any]] | None:
    obj = data.get(spec.rows_key) if spec.rows_key and isinstance(data, dict) else data
    if isinstance(obj, list) and all(isinstance(row, dict) for row in obj):
        return obj
    return None


def _apply_post_processing(data: Any, spec: ToolSpec, options: dict[str, Any]) -> tuple[Any, str, list[str]]:
    warnings = list(spec.limitations)
    coverage = spec.coverage
    requested_metric = options.get("metric")
    metric = requested_metric or spec.rank_metric
    order = options.get("order", "desc")
    limit = options.get("limit")
    rows = _rows(data, spec)
    if (limit is not None or "order" in options) and rows is None:
        raise ValueError("limit/order solo se admiten para Tools con lista de resultados")
    if ("order" in options or limit is not None) and rows is not None:
        if metric not in spec.output_fields:
            raise ValueError("Esta Tool no permite ordenar por la métrica solicitada")
        # Excluye "no calculable" exclusivamente de rankings de tasas SLA.
        eligible = rows
        if metric in {"sla", "sla_solucion", "sla_respuesta"}:
            eligible = [row for row in rows if isinstance(row.get(metric), (int, float))]
            if len(eligible) != len(rows):
                warnings.append(
                    f"Excluidos {len(rows) - len(eligible)} grupos sin medición válida de {metric}"
                )
        if not all(metric in x and isinstance(x[metric], (int, float)) for x in eligible):
            raise ValueError(f"La métrica {metric} no está disponible en todas las filas")
        ordered = sorted(eligible, key=lambda r: (r[metric], str(r)), reverse=order == "desc")
        if limit is not None:
            ordered = ordered[:limit]
        if spec.rows_key and isinstance(data, dict):
            data = {**data, spec.rows_key: ordered}
        else:
            data = ordered
    if spec.fixed_top is not None:
        if limit is not None and limit > spec.fixed_top:
            raise ValueError(f"Esta Tool solo obtiene un Top {spec.fixed_top}")
        if limit is not None and spec.rank_metric == metric and order == "desc" and options.get("pagina", 1) == 1:
            coverage = "top_n_exact"  # Ranking por la misma métrica aplicada en SQL.
        else:
            coverage = "limited"
        warnings.append(f"El service original limita los resultados a Top {spec.fixed_top}")
    elif spec.coverage == "conditional":
        if (spec.tool_id in {"ic_consultar_tipos", "rc_consultar_tipos"}
                and limit is not None and metric == spec.rank_metric and order == "desc"):
            coverage = "top_n_exact"
        else:
            coverage = "conditional"
            warnings.append("La cobertura requiere revisar los filtros y la modalidad")
    elif spec.coverage == "paginated":
        if (limit is not None and options.get("pagina", 1) == 1
                and metric == spec.rank_metric and order == "desc"
                and limit <= options.get("tamano", 100)):
            coverage = "top_n_exact"
        else:
            coverage = "paginated"
            warnings.append("La respuesta procede de un conjunto paginado")
    return data, coverage, warnings


def _check_sla_kpis(db: Session, source: str, filters: dict[str, Any],
                    data: dict[str, Any]) -> None:
    """Contrasta denominadores reales de SLA/OLA, sin cambiar los repositories."""
    repository_name = (
        "incident_sla_repository" if source == "incident_sla"
        else "requirement_sla_repository"
    )
    repo = import_module(f"app.repositories.{repository_name}")
    row = repo.obtener_kpis(db=db, **filters)
    if hasattr(row, "_mapping"):
        row = row._mapping
    if not isinstance(row, Mapping):
        row = {k: getattr(row, k) for k in (
            "total_tickets", "sla_respuesta_cumple", "sla_solucion_cumple",
            "ola_respuesta_cumple", "ola_solucion_cumple",
            "sla_respuesta_incumple", "sla_solucion_incumple",
            "ola_respuesta_incumple", "ola_solucion_incumple",
        ) if hasattr(row, k)}
    if int(data.get("total_tickets") or 0) != int(row.get("total_tickets") or 0):
        raise RuntimeError("El total de KPI no coincide con el repository")
    for kind in ("sla_respuesta", "sla_solucion", "ola_respuesta", "ola_solucion"):
        if source == "incident_sla":
            measured = int(row.get(kind + "_medibles") or 0)
        else:
            measured = int(row.get(kind + "_cumple") or 0) + int(row.get(kind + "_incumple") or 0)
        if measured == 0:
            data[kind] = None
        else:
            expected = round(100 * int(row.get(kind + "_cumple") or 0) / measured, 2)
            if data.get(kind) is None or abs(float(data[kind]) - expected) > 0.06:
                raise RuntimeError(f"Porcentaje incompatible con denominador de {kind}")


def _check_sla_projects(db: Session, source: str, filters: dict[str, Any],
                        data: list[dict[str, Any]]) -> None:
    """Corrige 0% sin medibles de solución y verifica medibles de respuesta."""
    repo_name = ("incident_sla_repository" if source == "incident_sla"
                 else "requirement_sla_repository")
    repo = import_module(f"app.repositories.{repo_name}")
    method = ("obtener_explorador_proyectos" if source == "incident_sla"
              else "obtener_proyectos")
    raw = getattr(repo, method)(db=db, **filters)
    rows = [_jsonable(row) for row in raw]
    name_key = "Proyecto" if source == "incident_sla" else "proyecto"
    # Coincidencias uno a uno con la lista agregada del service.
    original = {row[name_key]: row for row in rows}
    if len(original) != len(data):
        raise RuntimeError("Número de proyectos inconsistente")
    for item in data:
        measured_solution = int(item.get("medibles") or 0)
        if measured_solution > int(item.get("tickets") or 0):
            raise RuntimeError("Medibles exceden el total de tickets del proyecto")
        if measured_solution == 0:
            item["sla_solucion"] = None
        else:
            expected = round(100 * int(item.get("cumple") or 0) / measured_solution, 2)
            if item.get("sla_solucion") is None or abs(float(item["sla_solucion"]) - expected) > 0.06:
                raise RuntimeError("SLA de solución por proyecto inconsistente")
        detail = original.get(item.get("proyecto"))
        if detail is None:
            raise RuntimeError("No es posible validar el denominador de respuesta por proyecto")
        if source == "incident_sla":
            measured = int(detail.get("sla_respuesta_medibles") or 0)
        else:
            measured = int(detail.get("respuesta_cumple") or 0) + int(detail.get("respuesta_incumple") or 0)
        if measured == 0:
            item["sla_respuesta"] = None
        else:
            count = (int(detail.get("sla_respuesta_cumple") or 0) if source == "incident_sla"
                     else int(detail.get("respuesta_cumple") or 0))
            expected = round(100 * count / measured, 2)
            if item.get("sla_respuesta") is None or abs(float(item["sla_respuesta"]) - expected) > 0.06:
                raise RuntimeError("SLA de respuesta por proyecto inconsistente")


def _get_service(spec: ToolSpec):
    module = import_module(SOURCE_MODULES[spec.source])
    return getattr(module, spec.service)


def ejecutar_tool_analitica(db: Session, solicitud: Mapping[str, Any]) -> dict[str, Any]:
    """Ejecuta una capacidad registrada, sin SQL generado por GPT ni commits."""
    if not isinstance(solicitud, dict) or set(solicitud) - {"source", "tool_id", "filters", "options"}:
        return _fail("invalid_request", "La solicitud tiene una estructura no permitida")
    source = solicitud.get("source")
    tool_id = solicitud.get("tool_id")
    if not isinstance(source, str) or source not in SOURCE_MODULES or not isinstance(tool_id, str) or tool_id not in TOOL_REGISTRY:
        return _fail("invalid_request", "Fuente o Tool desconocida", source=source, tool_id=tool_id)
    modes = TOOL_REGISTRY[tool_id]
    if next(iter(modes.values())).source != source:
        return _fail("invalid_request", "La Tool no pertenece a esa fuente", source=source, tool_id=tool_id)
    supplied_filters = solicitud.get("filters", {})
    if isinstance(supplied_filters, dict):
        unknown = set(supplied_filters) - FILTERS[source]
        if unknown:
            return _fail("unsupported_by_tool", "Filtros fuera del contrato de Tools: " + ", ".join(sorted(unknown)), source=source, tool_id=tool_id)
    try:
        filters = _normalize_filters(source, supplied_filters)
        options = _normalize_options(solicitud.get("options", {}))
    except (ValueError, TypeError) as exc:
        return _fail("invalid_request", str(exc), source=source, tool_id=tool_id)
    mode = options.get("mode")
    if mode is None:
        if len(modes) != 1:
            return _fail("needs_clarification", "Indica options.mode: " + ", ".join(modes), source=source, tool_id=tool_id)
        mode = next(iter(modes))
    if mode not in modes:
        return _fail("invalid_request", "Modalidad no permitida", source=source, tool_id=tool_id)
    spec = modes[mode]
    unsupported = set(filters) - spec.effective_filters
    if unsupported:
        return _fail("unsupported_by_tool", "Filtros no aplicados por el service: " + ", ".join(sorted(unsupported)), source=source, tool_id=tool_id)
    if options.get("metric") and options["metric"] not in spec.output_fields:
        return _fail("unsupported_by_tool", "Métrica no soportada por esta Tool", source=source, tool_id=tool_id)
    safe_top = (
        options.get("limit") is not None
        and options.get("metric", spec.rank_metric) == spec.rank_metric
        and options.get("order", "desc") == "desc"
        and (
            spec.fixed_top is not None
            or (spec.coverage == "paginated" and options.get("pagina", 1) == 1
                and options["limit"] <= options.get("tamano", 100))
            or (spec.tool_id in {"ic_consultar_tipos", "rc_consultar_tipos"}
                and options["limit"] <= 100)
        )
    )
    if options.get("require_complete") and spec.coverage in ("limited", "paginated", "conditional") and not safe_top:
        return _fail("unsupported_by_tool", "La Tool no garantiza cobertura completa", source=source, tool_id=tool_id)
    if source == "requirement_consolidated" and tool_id == "rc_consultar_top_proyectos" and not filters.get("desde") and not filters.get("hasta"):
        return _fail("unsupported_by_tool", "Esta Tool aplica una ventana automática de cuatro meses", source=source, tool_id=tool_id)
    if spec.fixed_top is not None:
        if options.get("limit", spec.fixed_top) > spec.fixed_top:
            return _fail("unsupported_by_tool", f"La Tool no cubre un Top superior a {spec.fixed_top}", source=source, tool_id=tool_id)
        if "limit" in options or "order" in options:
            if (not spec.rank_metric or options.get("metric", spec.rank_metric) != spec.rank_metric
                    or options.get("order", "desc") != "desc"):
                return _fail("unsupported_by_tool", "El Top limitado no permite ese ranking; se necesita el universo completo", source=source, tool_id=tool_id)
    if ("ranking_desde" in options or "ranking_hasta" in options) and tool_id != "rs_consultar_tendencia_tipos":
        return _fail("invalid_request", "El ranking de posiciones solo corresponde a rs_consultar_tendencia_tipos", source=source, tool_id=tool_id)
    if ("pagina" in options or "tamano" in options) and tool_id not in {"ic_consultar_resolutores", "ic_consultar_descripciones", "ic_consultar_detalles"}:
        return _fail("invalid_request", "Esta Tool no admite pagina/tamano", source=source, tool_id=tool_id)
    if "limit" in options and not spec.rank_metric and tool_id not in {"rs_consultar_tipos"}:
        return _fail("unsupported_by_tool", "La Tool no permite un Top ordenado con esta métrica", source=source, tool_id=tool_id)
    if tool_id == "ic_consultar_resolutores" and "limit" in options and options["limit"] > options.get("tamano", 100):
        return _fail("unsupported_by_tool", "El límite excede la página de resolutores seleccionada", source=source, tool_id=tool_id)
    if tool_id in {"ic_consultar_tipos", "rc_consultar_tipos"} and options.get("limit", 10) > 100:
        return _fail("unsupported_by_tool", "El máximo de tipos disponible en el service es 100", source=source, tool_id=tool_id)
    if tool_id == "ic_consultar_descripciones" and mode == "porcentajes" and options.get("limit", 20) > 100:
        return _fail("unsupported_by_tool", "El máximo de descripciones del service es 100", source=source, tool_id=tool_id)
    if options.get("tamano", 1) > 100:
        return _fail("unsupported_by_tool", "tamano supera el máximo del service (100)", source=source, tool_id=tool_id)
    if tool_id == "rs_consultar_tendencia_tipos" and not options.get("ranking_hasta") and options.get("require_complete"):
        return _fail("unsupported_by_tool", "El service selecciona solo los cinco tipos de mayor volumen", source=source, tool_id=tool_id)
    try:
        service = _get_service(spec)
        params = set(inspect.signature(service).parameters)
        if "db" not in params:
            raise RuntimeError("Firma de service sin parámetro db")
        variadic = any(p.kind is inspect.Parameter.VAR_KEYWORD for p in inspect.signature(service).parameters.values())
        extra = set(filters) - params if not variadic else set()
        if extra:
            return _fail("unsupported_by_tool", "El service no recibe: " + ", ".join(sorted(extra)), source=source, tool_id=tool_id)
        kwargs = dict(filters)
        # Parámetros de los endpoints, validados aquí porque no pasamos por FastAPI.
        if spec.service == "obtener_tipos" and "limite" in params:
            kwargs["limite"] = min(options.get("limit", 100), 100)
        if tool_id == "ic_consultar_descripciones":
            if "limite" in params:
                kwargs["limite"] = min(options.get("limit", 100), 100)
            if "tamano" in params:
                kwargs["tamano"] = min(options.get("tamano", 10), 100)
                kwargs["pagina"] = options.get("pagina", 1)
        if tool_id == "ic_consultar_detalles" and "tamano" in params:
            kwargs["tamano"] = min(options.get("tamano", 10), 100)
            kwargs["pagina"] = options.get("pagina", 1)
        if tool_id == "ic_consultar_resolutores":
            kwargs["pagina"] = options.get("pagina", 1)
            kwargs["tamano"] = min(options.get("tamano", 100), 100)
        if "buscar" in options:
            if "buscar" not in params:
                return _fail("unsupported_by_tool", "Esta modalidad no admite buscar", source=source, tool_id=tool_id)
            kwargs["buscar"] = options["buscar"]
        if tool_id == "rs_consultar_tendencia_tipos":
            kwargs["ranking_desde"] = options.get("ranking_desde", 1)
            kwargs["ranking_hasta"] = options.get("ranking_hasta", 5)
        # Para obtener todos los tipos de cumplimiento no aplicar el límite de un Top 10.
        if tool_id == "rs_consultar_tipos" and mode == "cumplimiento":
            kwargs["limite"] = None
        if tool_id == "is_consultar_insights":
            repo = import_module("app.repositories.incident_sla_repository")
            ref = repo.obtener_kpis(db=db, **filters)
            if int(ref.get("sla_solucion_medibles") or 0) == 0:
                return _fail("unsupported_by_tool", "Insights no verificables sin SLA de solución medible", source=source, tool_id=tool_id)
        raw = service(db=db, **kwargs)
        data = _jsonable(raw)
        if tool_id in {"is_consultar_kpis", "rs_consultar_kpis"}:
            _check_sla_kpis(db, source, filters, data)
        if tool_id in {"is_consultar_proyectos", "rs_consultar_proyectos"}:
            _check_sla_projects(db, source, filters, data)
        if tool_id == "rs_consultar_condiciones_sla":
            total_conditions = sum(int(data.get(k) or 0) for k in (
                "cumplidos", "incumplidos", "cancelados", "otros"
            ))
            if total_conditions != int(data.get("total_tickets") or 0):
                raise RuntimeError("Las condiciones SLA no suman el total de tickets")
        if tool_id == "is_consultar_tendencia_sla":
            for item in data:
                if int(item.get("medibles") or 0) == 0:
                    item["cumplimiento"] = None
        if tool_id == "is_consultar_resolutores":
            repo = import_module("app.repositories.incident_sla_repository")
            lookup = {row["resolutor"]: row for row in repo.obtener_desempeno_resolutores(db=db, **filters)}
            for item in data:
                original = lookup.get(item["resolutor"])
                if original is None:
                    raise RuntimeError("No se encontró el denominador por resolutor")
                if int(original.get("medibles") or 0) == 0:
                    item["sla"] = None
        data, coverage, limitations = _apply_post_processing(data, spec, options)
        if len(str(data)) > 150_000:
            raise OverflowError("El resultado supera el tamaño máximo de respuesta")
        # No modificar métricas del service; almacenar únicamente números de primer nivel.
        metrics = {
            key: value for key, value in data.items()
            if key in spec.output_fields and (isinstance(value, (int, float)) or (key in {
                "sla_respuesta", "sla_solucion", "ola_respuesta", "ola_solucion"
            } and value is None))
        } if isinstance(data, dict) else {}
        rows = _rows(data, spec)
        empty = (rows is not None and not rows) or data is None
        complete = coverage == "complete" or coverage == "top_n_exact"
        if options.get("require_complete") and not complete:
            return _fail("unsupported_by_tool", "No se pudo verificar la cobertura completa", source=source, tool_id=tool_id)
        return {
            "status": "empty" if empty else "success",
            "source": source,
            "tool_id": tool_id,
            "date_field": spec.date_field,
            "applied_filters": {
                k: (v.isoformat() if isinstance(v, date) else v)
                for k, v in filters.items()
            },
            "metrics": metrics,
            "data": data,
            "coverage": coverage,
            "complete": complete,
            "limitations": limitations,
            "evidence": {
                "service": f"{SOURCE_MODULES[source]}.{spec.service}",
                "mode": mode,
                "metric": options.get("metric"),
                "validated": True,
            },
        }
    except (ValueError, OverflowError) as exc:
        return _fail("unsupported_by_tool", str(exc), source=source, tool_id=tool_id)
    except Exception:
        logger.exception("Error al ejecutar Tool autorizada %s", tool_id)
        return _fail("backend_error", "La consulta no pudo completarse", source=source, tool_id=tool_id)
