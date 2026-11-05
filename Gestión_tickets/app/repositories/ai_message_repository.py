
import json
from typing import Literal
from sqlalchemy.orm import Session
from app.models.ai_conversation_model import AIConversation
from app.models.ai_message_model import AIMessage

def _to_json(value):
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)

def create(
    db: Session,
    conversation_id: int,
    role: Literal["user", "assistant"],
    content: str,
    response_type: str | None = None,
    source: str | None = None,
    filters_json: dict | list | None = None,
    metrics_json: dict | list | None = None,
    evidence_json: dict | list | None = None
) -> AIMessage:

    if role not in ("user", "assistant"):
        raise ValueError("El rol debe ser user o assistant")

    message = AIMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        response_type=response_type,
        source=source,
        filters_json=_to_json(filters_json),
        metrics_json=_to_json(metrics_json),
        evidence_json=_to_json(evidence_json)
    )

    db.add(message)
    db.flush()
    return message


def get_by_id( db: Session, message_id: int) -> AIMessage | None:
    return db.get(AIMessage, message_id)


def get_by_conversation(
    db: Session,
    conversation_id: int,
    limit: int = 100,
    offset: int = 0
) -> list[AIMessage]:

    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_last_messages(
    db: Session,
    conversation_id: int,
    limit: int = 10
) -> list[AIMessage]:

    limit = max(1, min(limit, 100))
    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.id.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(messages))


def count_by_conversation(db: Session, conversation_id: int) -> int:
    return (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .count()
    )
