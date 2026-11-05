
import json
from sqlalchemy.orm import Session
from app.models.ai_conversation_model import AIConversation
from app.models.ai_message_model import AIMessage  # Registra la relación ORM

def create(db: Session, title: str = "Nueva conversación", context_state: dict | None = None) -> AIConversation:
    conversation = AIConversation(
        title=title,
        context_state=json.dumps(
            context_state if context_state is not None else {},
            ensure_ascii=False
        )
    )
    db.add(conversation)
    db.flush()
    return conversation


def get_by_id( db: Session, conversation_id: int) -> AIConversation | None:
    return db.get(AIConversation, conversation_id)

def get_all( db: Session, limit: int = 50, offset: int = 0) -> list[AIConversation]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return (
        db.query(AIConversation)
        .order_by(AIConversation.created_at.desc(),AIConversation.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def update_title(db: Session, conversation_id: int, title: str) -> AIConversation | None:
    conversation = get_by_id(db, conversation_id)
    
    if conversation is None:
        return None
    
    conversation.title = title
    db.flush()
    return conversation


def update_context(db: Session, conversation_id: int, context_state: dict) -> AIConversation | None:
    conversation = get_by_id(db, conversation_id)

    if conversation is None:
        return None

    conversation.context_state = json.dumps(context_state, ensure_ascii=False)
    db.flush()
    return conversation


def delete(db: Session, conversation_id: int) -> bool:
    conversation = get_by_id(db, conversation_id)
    
    if conversation is None:
        return False
    
    db.delete(conversation)
    db.flush()
    return True
