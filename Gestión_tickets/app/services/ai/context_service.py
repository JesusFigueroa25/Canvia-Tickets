from __future__ import annotations

import json
from typing import Any, Literal, Mapping

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
)
from sqlalchemy.orm import Session

from app.repositories import (
    ai_conversation_repository,
    ai_message_repository,
)

from app.schemas.ai_chat_schema import AIQueryFilter

from app.services.ai.query_service import (
    COLUMN_CATALOG,
    DATE_DEFAULT,
    MAX_FILTERS,
    validar_plan_analitico,
)


# 1. CONFIGURACIÓN

SOURCES = frozenset(DATE_DEFAULT)

MAX_HISTORY = 20
DEFAULT_HISTORY = 10
MAX_MESSAGE_CHARS = 3000
MAX_CONTEXT_CHARS = 16000

CROSS_SOURCE_FIELDS = frozenset({
    "Proyecto",
    "Grupo_Resolutor",
    "Fecha_Resolucion",
})


# 2. CONTRATO ESTRUCTURADO DE CAMBIOS

class ContextPatchBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )


class PeriodPatch(ContextPatchBase):
    desde: str | None = None
    hasta: str | None = None
    date_field: str | None = None


class ContextPatch(ContextPatchBase):

    source: Literal[
        "incident_consolidated",
        "incident_sla",
        "requirement_consolidated",
        "requirement_sla",
    ] | None = None

    filters: list[AIQueryFilter] = Field(
        default_factory=list
    )

    period: PeriodPatch | None = None

    remove_fields: list[str] = Field(
        default_factory=list
    )

    clear_filters: bool = False
    clear_period: bool = False
    reset_context: bool = False


# 3. RESPUESTAS Y ESTADO INICIAL

def _error(
    status: str,
    detail: str,
    **extra: Any,
) -> dict[str, Any]:

    return {
        "status": status,
        "detail": detail,
        "context_state": None,
        **extra,
    }


def _initial_state() -> dict[str, Any]:

    return {
        "version": 1,
        "source": None,
        "date_field": None,
        "filters": [],
    }


# 4. REUTILIZAR VALIDACIÓN DE QUERY SERVICE

def _validate_filters(
    source: str,
    filters: list[dict[str, Any]],
) -> tuple[str, Any]:

    """
    Valida los filtros mediante el motor autorizado.

    Se utiliza una métrica COUNT ficticia únicamente
    para validar el plan, sin ejecutar SQL.
    """

    result = validar_plan_analitico({
        "version": 1,
        "source": source,
        "operation": "aggregate",
        "filters": filters,
        "metrics": [
            {
                "alias": "conteo",
                "function": "count",
            }
        ],
    })

    if result["status"] != "valid":

        return (
            result["status"],
            result.get(
                "detail",
                "Filtros no válidos",
            ),
        )

    return (
        "valid",
        result["normalized_plan"]["filters"],
    )


# 5. LEER Y VALIDAR ESTADO PERSISTIDO

def _normalize_state(
    raw: Any,
) -> dict[str, Any]:

    if raw is None or raw == {} or raw == "":
        return _initial_state()

    if isinstance(raw, str):

        try:
            raw = json.loads(raw)

        except (ValueError, TypeError) as exc:
            raise ValueError(
                "context_state contiene JSON inválido"
            ) from exc

    if not isinstance(raw, dict):
        raise ValueError(
            "context_state debe ser un objeto JSON"
        )

    if not raw:
        return _initial_state()

    allowed_keys = {
        "version",
        "source",
        "date_field",
        "filters",
    }

    if set(raw) - allowed_keys:
        raise ValueError(
            "context_state contiene campos no admitidos"
        )

    if (
        type(raw.get("version")) is not int
        or raw["version"] != 1
    ):
        raise ValueError(
            "Versión de contexto no compatible"
        )

    source = raw.get("source")
    field = raw.get("date_field")
    filters = raw.get("filters", [])

    if not isinstance(filters, list):
        raise ValueError(
            "Los filtros persistidos deben ser una lista"
        )

    if source is None:

        if field is not None or filters:
            raise ValueError(
                "Contexto sin fuente contiene filtros"
            )

        return _initial_state()

    if (
        not isinstance(source, str)
        or source not in SOURCES
    ):
        raise ValueError(
            "Fuente del contexto no autorizada"
        )

    if field is not None and not isinstance(
        field, str
    ):
        raise ValueError(
            "Campo temporal del contexto inválido"
        )

    if field is None:
        field = DATE_DEFAULT[source]

    if (
        field not in COLUMN_CATALOG[source]
        or COLUMN_CATALOG[source][field].kind != "date"
    ):
        raise ValueError(
            "Campo temporal del contexto no autorizado"
        )

    status, validated = _validate_filters(
        source,
        filters,
    )

    if status != "valid":
        raise ValueError(
            f"Filtros persistidos inválidos: {validated}"
        )

    return {
        "version": 1,
        "source": source,
        "date_field": field,
        "filters": validated,
    }


# 6. VERIFICAR FORMATOS DE PRIORIDAD

def _priority_style_ok(
    source: str,
    filters: list[dict[str, Any]],
) -> bool:

    """
    Evita aplicar códigos de Consolidados a SLA
    o viceversa.

    No traduce automáticamente:
        1-Critical -> P1
    """

    for item in filters:

        if item["field"] != "Prioridad":
            continue

        value = item["value"]

        candidates = (
            value
            if isinstance(value, list)
            else [value]
        )

        for candidate in candidates:

            if not isinstance(candidate, str):
                continue

            text = candidate.strip()

            if (
                source.endswith("_sla")
                and len(text) >= 2
                and text[0].isdigit()
                and "-" in text
            ):
                return False

            if (
                source.endswith("_consolidated")
                and text.upper().startswith("P")
                and text[1:].isdigit()
            ):
                return False

    return True


# 7. CAMBIAR ENTRE FUENTES

def _switch_source(
    state: dict[str, Any],
    target: str,
) -> tuple[
    list[dict[str, Any]],
    list[str],
    str,
]:

    old = state["source"]

    old_default = DATE_DEFAULT[old]
    new_default = DATE_DEFAULT[target]

    kept = []
    dropped = []

    for original in state["filters"]:

        item = dict(original)
        field = item["field"]

        # Fecha predeterminada:
        # Apertura en Consolidados,
        # Creación en SLA.

        if field == old_default:

            item["field"] = new_default

        # Se conserva Prioridad solamente dentro
        # de la misma familia de códigos.

        elif field == "Prioridad":

            if (
                old.endswith("_sla")
                != target.endswith("_sla")
            ):
                dropped.append(field)
                continue

        # Conservamos únicamente campos compartidos
        # cuya interpretación es compatible.

        elif field not in CROSS_SOURCE_FIELDS:

            dropped.append(field)
            continue

        if item["field"] not in COLUMN_CATALOG[target]:

            dropped.append(field)
            continue

        kept.append(item)

    target_date = (
        "Fecha_Resolucion"
        if state["date_field"] == "Fecha_Resolucion"
        else new_default
    )

    return (
        kept,
        sorted(set(dropped)),
        target_date,
    )


# 8. COMBINAR CONTEXTO Y CAMBIOS

def combinar_contexto(
    context_state: Mapping[str, Any] | str | None,
    patch: Mapping[str, Any] | ContextPatch,
) -> dict[str, Any]:

    """
    Combina el estado anterior con un parche estructurado.

    NO interpreta lenguaje natural.
    NO realiza consultas SQL.
    NO modifica el estado original.
    """

    
    # 1. Recuperar el estado actual

    try:

        previous = _normalize_state(
            context_state
        )

    except ValueError as exc:

        return _error(
            "corrupt_context",
            str(exc),
        )

    
    # 2. Validar el parche recibido
    
    try:

        if isinstance(patch, ContextPatch):
            p = patch

        else:

            p = ContextPatch.model_validate(
                patch
            )

    except (
        ValidationError,
        TypeError,
        ValueError,
    ) as exc:

        return _error(
            "invalid_patch",
            f"Parche inválido: {str(exc)[:500]}",
        )

    
    # 3. Validar límites
    

    if (
        len(p.filters) > MAX_FILTERS
        or len(p.remove_fields) > MAX_FILTERS
    ):

        return _error(
            "limit_exceeded",
            "Demasiados filtros en el parche",
        )

    if p.clear_period and p.period is not None:

        return _error(
            "invalid_patch",
            "clear_period y period no pueden combinarse",
        )

    if p.clear_filters and p.remove_fields:

        return _error(
            "invalid_patch",
            "clear_filters y remove_fields son incompatibles",
        )

    if len(set(p.remove_fields)) != len(p.remove_fields):

        return _error(
            "invalid_patch",
            "remove_fields contiene duplicados",
        )

    
    # 4. Determinar la fuente
    

    state = (
        _initial_state()
        if p.reset_context
        else dict(previous)
    )

    source = (
        p.source or state["source"]
    )

    if source is None:

        return _error(
            "needs_clarification",
            "La primera consulta requiere una fuente",
        )

    dropped = []

    switching = bool(
        state["source"]
        and state["source"] != source
    )

    
    # 5. Conservar filtros compatibles
    

    if switching:

        filters, dropped, date_field = _switch_source(
            state,
            source,
        )

    else:

        filters = [
            dict(item)
            for item in state["filters"]
        ]

        date_field = (
            state["date_field"]
            or DATE_DEFAULT[source]
        )

    
    # 6. Limpiar filtros solicitados
    

    if p.clear_filters:

        filters = []
        date_field = DATE_DEFAULT[source]

    if p.clear_period:

        filters = [
            f
            for f in filters
            if (
                COLUMN_CATALOG[source][f["field"]].kind
                != "date"
            )
        ]

        date_field = DATE_DEFAULT[source]

    
    # 7. Eliminar campos específicos
    

    removed = set(
        p.remove_fields
    )

    unknown_removed = (
        removed - set(COLUMN_CATALOG[source])
    )

    if unknown_removed:

        return _error(
            "unsupported_operation",
            "Campos no autorizados en remove_fields: "
            + ", ".join(sorted(unknown_removed)),
        )

    filters = [
        f
        for f in filters
        if f["field"] not in removed
    ]

    if date_field in removed:
        date_field = DATE_DEFAULT[source]

    
    # 8. Recibir filtros nuevos
    

    additions = [
        f.model_dump()
        for f in p.filters
    ]

    new_fields = [
        f["field"]
        for f in additions
    ]

    if len(set(new_fields)) != len(new_fields):

        return _error(
            "invalid_patch",
            "El parche repite campos de filtro",
        )

    
    # 9. Actualizar período
    

    if p.period is not None:

        period = p.period

        if (
            period.desde is None
            and period.hasta is None
        ):

            return _error(
                "invalid_patch",
                "period necesita desde o hasta",
            )

        if period.date_field is not None:

            date_field = period.date_field

        else:

            active_dates = {
                f["field"]
                for f in filters
                if (
                    COLUMN_CATALOG[source][
                        f["field"]
                    ].kind == "date"
                )
            }

            if len(active_dates) > 1:

                return _error(
                    "needs_clarification",
                    "Hay varios campos de fecha activos: "
                    "indicar period.date_field",
                )

            if active_dates:
                date_field = next(iter(active_dates))

        if (
            date_field not in COLUMN_CATALOG[source]
            or COLUMN_CATALOG[source][
                date_field
            ].kind != "date"
        ):

            return _error(
                "unsupported_operation",
                "Campo temporal no autorizado",
            )
            

        if period.date_field is not None:

            filters = [
                item
                for item in filters
                if (
                    COLUMN_CATALOG[source][
                        item["field"]
                    ].kind != "date"
                )
            ]

        if date_field in new_fields:

            return _error(
                "invalid_patch",
                "El mismo campo temporal aparece "
                "en period y filters",
            )
            


        # Rango completo

        if (
            period.desde is not None
            and period.hasta is not None
        ):

            addition = {
                "field": date_field,
                "operator": "date_range",
                "value": {
                    "from": period.desde,
                    "to": period.hasta,
                },
            }

        # Solo desde

        elif period.desde is not None:

            addition = {
                "field": date_field,
                "operator": "gte",
                "value": period.desde,
            }

        # Solo hasta

        else:

            addition = {
                "field": date_field,
                "operator": "lte",
                "value": period.hasta,
            }

        additions.append(addition)

    if p.period is None:

        explicit_date_fields = {
            item["field"]
            for item in additions
            if (
                item["field"] in COLUMN_CATALOG[source]
                and COLUMN_CATALOG[source][
                    item["field"]
                ].kind == "date"
            )
        }

        if explicit_date_fields:

            filters = [
                item
                for item in filters
                if (
                    COLUMN_CATALOG[source][
                        item["field"]
                    ].kind != "date"
                    or item["field"] in explicit_date_fields
                )
            ]

    
    # 10. Reemplazar filtros del mismo campo
    

    replacing = {
        item["field"]
        for item in additions
    }

    filters = [
        item
        for item in filters
        if item["field"] not in replacing
    ]

    filters.extend(additions)

    
    # 11. Validar códigos de prioridad
    

    if not _priority_style_ok(source, filters):

        return _error(
            "invalid_patch",
            "El formato de Prioridad no corresponde "
            "a la fuente. No traducimos "
            "automáticamente P1 y 1-Critical.",
        )

    
    # 12. Validar filtros completos
    

    status, normalized = _validate_filters(
        source,
        filters,
    )

    if status != "valid":

        return _error(
            status,
            str(normalized),
        )

    
    # 13. Actualizar fecha activa, cuando corresponda
    

    if p.period is None:

        explicit_dates = [
            f["field"]
            for f in additions
            if (
                COLUMN_CATALOG[source][
                    f["field"]
                ].kind == "date"
            )
        ]

        if len(explicit_dates) == 1:
            date_field = explicit_dates[0]

    
    # 14. Construir estado final
    

    state = {
        "version": 1,
        "source": source,
        "date_field": date_field,
        "filters": normalized,
    }

    if (
        len(json.dumps(
            state,
            ensure_ascii=False,
        )) > MAX_CONTEXT_CHARS
    ):

        return _error(
            "limit_exceeded",
            "El contexto supera el tamaño autorizado",
        )

    warnings = []

    if dropped:

        warnings.append(
            "Se descartaron filtros incompatibles "
            "al cambiar de fuente: "
            + ", ".join(dropped)
        )

    return {
        "status": "success",
        "context_state": state,
        "source_changed": switching,
        "dropped_filters": dropped,
        "warnings": warnings,
    }


# 9. CARGAR CONTEXTO DE SQL SERVER

def cargar_contexto(
    db: Session,
    conversation_id: int,
    *,
    limit: int = DEFAULT_HISTORY,
) -> dict[str, Any]:

    """
    Recupera el contexto y los últimos mensajes.

    Reutiliza repositorios de la Fase 4.1.
    No modifica la conversación.
    """

    if (
        type(conversation_id) is not int
        or conversation_id <= 0
    ):

        return _error(
            "invalid_request",
            "conversation_id debe ser un entero positivo",
        )

    if (
        type(limit) is not int
        or not (1 <= limit <= MAX_HISTORY)
    ):

        return _error(
            "invalid_request",
            f"limit debe estar entre 1 y {MAX_HISTORY}",
        )

    conversation = (
        ai_conversation_repository.get_by_id(
            db,
            conversation_id,
        )
    )

    if conversation is None:

        return _error(
            "not_found",
            "Conversación inexistente",
        )

    try:

        state = _normalize_state(
            conversation.context_state
        )

    except ValueError as exc:

        return _error(
            "corrupt_context",
            str(exc),
        )

    messages = (
        ai_message_repository.get_last_messages(
            db,
            conversation_id,
            limit=limit,
        )
    )

    history = []

    for msg in messages:

        if msg.role not in (
            "user",
            "assistant",
        ):
            continue

        history.append({
            "id": msg.id,
            "role": msg.role,
            "content": str(
                msg.content or ""
            )[:MAX_MESSAGE_CHARS],
        })

    history.sort(
        key=lambda item: item["id"]
    )
    

    ultimo_plan = None

    mensajes_ordenados = sorted(
        messages,
        key=lambda item: item.id,
        reverse=True,
    )

    for msg in mensajes_ordenados:

        if msg.role != "assistant":
            continue

        raw_evidence = getattr(
            msg,
            "evidence_json",
            None,
        )

        if not raw_evidence:
            continue

        try:

            evidence = (
                json.loads(raw_evidence)
                if isinstance(raw_evidence, str)
                else raw_evidence
            )

            if not isinstance(evidence, dict):
                continue

            if evidence.get("validated") is not True:
                continue

            candidate = evidence.get("plan")

            if not isinstance(candidate, dict):
                continue

            checked = validar_plan_analitico(
                candidate
            )

            if checked.get("status") != "valid":
                continue

            candidate = checked["normalized_plan"]

            # No reutilizar un plan de otra fuente
            # o de un contexto diferente.
            if candidate["source"] != state["source"]:
                continue

            if candidate["filters"] != state["filters"]:
                continue

            ultimo_plan = candidate
            break

        except (
            ValueError,
            TypeError,
            KeyError,
            AttributeError,
        ):
            continue

    return {
        "status": "success",
        "conversation_id": conversation_id,
        "context_state": state,
        "messages": history,
        "history_count": len(history),
        "last_plan": ultimo_plan,
    }


# 10. GUARDAR CONTEXTO EN SQL SERVER

def guardar_contexto(
    db: Session,
    conversation_id: int,
    context_state: Mapping[str, Any],
) -> dict[str, Any]:

    """
    Actualiza ai_conversations.context_state.

    El repositorio realiza flush, pero aquí NO
    realizamos commit ni rollback.

    La futura capa chat_service controlará
    la transacción junto con los mensajes.
    """

    if (
        type(conversation_id) is not int
        or conversation_id <= 0
    ):

        return _error(
            "invalid_request",
            "conversation_id debe ser un entero positivo",
        )

    try:

        state = _normalize_state(
            dict(context_state)
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        return _error(
            "invalid_plan",
            str(exc),
        )

    if (
        len(json.dumps(
            state,
            ensure_ascii=False,
        )) > MAX_CONTEXT_CHARS
    ):

        return _error(
            "limit_exceeded",
            "El contexto supera el tamaño autorizado",
        )

    result = (
        ai_conversation_repository.update_context(
            db,
            conversation_id,
            state,
        )
    )

    if result is None:

        return _error(
            "not_found",
            "Conversación inexistente",
        )

    return {
        "status": "success",
        "conversation_id": conversation_id,
        "context_state": state,
        "committed": False,
    }
