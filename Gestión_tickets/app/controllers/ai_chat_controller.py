
import json
import logging
from fastapi import (APIRouter,Depends,HTTPException,Query,Path,Response,)
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.ai_chat_schema import (ChatMessageRequest,ChatMessageResponse,ChatConversationOut,ChatConversationListOut,ChatMessageOut,ChatHistoryOut,)
from app.services.ai.chat_service import (procesar_mensaje_chat,)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-chat",tags=["Chat Analítico IA"],)

# FUNCIONES AUXILIARES
def _parse_context(value) -> dict:

    try:
        data = (
            value
            if isinstance(value, dict)
            else json.loads(value or "{}")
        )

        if not isinstance(data, dict):
            raise ValueError("Contexto inválido")

        return data

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=500,
            detail="No se pudo recuperar el contexto",
        )

def _raise_chat_error(result: dict):

    code = result.get(
        "status",
        "backend_error",
    )

    status_codes = {
        "not_found": 404,
        "stale_context": 409,
        "invalid_request": 422,
        "invalid_patch": 422,
        "invalid_plan": 422,
        "unsupported_operation": 422,
        "llm_error": 503,
        "backend_error": 503,
        "persistence_error": 500,
        "redaction_error": 502,
    }

    raise HTTPException(
        status_code=status_codes.get(code, 500),
        detail={
            "status": code,
            "message": (
                "No fue posible completar "
                "la solicitud del chatbot"
            ),
        },
    )


# 1. ENVIAR MENSAJE AL CHATBOT
@router.post("/messages",response_model=ChatMessageResponse,)
def enviar_mensaje(body: ChatMessageRequest,response: Response, db: Session = Depends(get_sqlserver_db),):

    result = procesar_mensaje_chat(
        db=db,
        pregunta=body.pregunta,
        conversation_id=body.conversation_id,
    )

    if not result.get("persisted"):

        logger.warning(
            "[CHAT IA] Solicitud rechazada | "
            "status=%s | detail=%s | conversation_id=%s",
            result.get("status"),
            result.get("detail"),
            body.conversation_id,
        )

        _raise_chat_error(result)

    if result.get("status") not in {
        "success",
        "needs_clarification",
        "unsupported",
    }:
        _raise_chat_error(result)

    response.status_code = (
        201
        if body.conversation_id is None
        else 200
    )

    return ChatMessageResponse(
        status=result["status"],
        conversation_id=result["conversation_id"],
        response_type="text",
        answer=result["answer"],
        context_state=result["context_state"],
        source=result.get("source"),
        route=result.get("route"),
        generation_mode=result.get(
            "generation_mode"
        ),
        metrics=result.get("metrics", {}),
        executed=result["executed"],
        persisted=result["persisted"],
    )


# 2. LISTAR CONVERSACIONES
@router.get("/conversations",response_model=ChatConversationListOut,)
def listar_conversaciones(
    limit: int = Query(
        default=30,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_sqlserver_db),
):

    rows = db.execute(
        text("""
            SELECT
                id,
                title,
                context_state
            FROM dbo.ai_conversations
            ORDER BY id DESC
            OFFSET :offset ROWS
            FETCH NEXT :limit ROWS ONLY
        """),
        {
            "offset": offset,
            "limit": limit,
        },
    ).mappings().all()

    return ChatConversationListOut(
        conversations=[
            ChatConversationOut(
                id=row["id"],
                title=row["title"],
                context_state=_parse_context(
                    row["context_state"]
                ),
            )
            for row in rows
        ],
        limit=limit,
        offset=offset,
    )


# 3. OBTENER CONVERSACIÓN POR ID
@router.get("/conversations/{conversation_id}",response_model=ChatConversationOut,)
def obtener_conversacion(
    conversation_id: int = Path(gt=0),
    db: Session = Depends(get_sqlserver_db),
):

    row = db.execute(
        text("""
            SELECT
                id,
                title,
                context_state
            FROM dbo.ai_conversations
            WHERE id = :cid
        """),
        {
            "cid": conversation_id,
        },
    ).mappings().one_or_none()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Conversación no encontrada",
        )

    return ChatConversationOut(
        id=row["id"],
        title=row["title"],
        context_state=_parse_context(
            row["context_state"]
        ),
    )


# 4. OBTENER HISTORIAL DE MENSAJES
@router.get("/conversations/{conversation_id}/messages",response_model=ChatHistoryOut,)
def obtener_historial(
    conversation_id: int = Path(gt=0),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_sqlserver_db),
):

    exists = db.execute(
        text("""
            SELECT id
            FROM dbo.ai_conversations
            WHERE id = :cid
        """),
        {
            "cid": conversation_id,
        },
    ).scalar_one_or_none()

    if exists is None:
        raise HTTPException(
            status_code=404,
            detail="Conversación no encontrada",
        )

    rows = db.execute(
        text("""
            SELECT
                id,
                role,
                content,
                response_type,
                source
            FROM dbo.ai_messages
            WHERE conversation_id = :cid
            ORDER BY id ASC
            OFFSET :offset ROWS
            FETCH NEXT :limit ROWS ONLY
        """),
        {
            "cid": conversation_id,
            "offset": offset,
            "limit": limit,
        },
    ).mappings().all()

    return ChatHistoryOut(
        conversation_id=conversation_id,
        messages=[
            ChatMessageOut(
                id=row["id"],
                role=row["role"],
                content=row["content"],
                response_type=row["response_type"],
                source=row["source"],
            )
            for row in rows
        ],
        limit=limit,
        offset=offset,
    )
