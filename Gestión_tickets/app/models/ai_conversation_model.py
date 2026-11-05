
from sqlalchemy import Column, Integer, Identity, CheckConstraint, text
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR
from sqlalchemy.orm import relationship
from app.database.database import Base

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer,Identity(start=1, increment=1),primary_key=True)
    title = Column(NVARCHAR(200),nullable=False,server_default=text("N'Nueva conversación'"))
    created_at = Column(DATETIME2(precision=0), nullable=False, server_default=text("SYSUTCDATETIME()"))
    context_state = Column(NVARCHAR(None), nullable=False, server_default=text("N'{}'"))
    
    # Relación: una conversación tiene muchos mensajes.
    messages = relationship("AIMessage",back_populates="conversation",cascade="all, delete-orphan",passive_deletes=True)

    __table_args__ = (
        CheckConstraint(
            "ISJSON(context_state) = 1",
            name="CK_ai_conversations_context_state"
        ),
        {"schema": "dbo"},
    )