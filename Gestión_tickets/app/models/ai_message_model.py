from sqlalchemy import (Column,Integer,Identity,ForeignKey,CheckConstraint,Index,text,)
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR
from sqlalchemy.orm import relationship
from app.database.database import Base

class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, Identity(start=1, increment=1), primary_key=True)
    conversation_id = Column(Integer, ForeignKey("dbo.ai_conversations.id", name="FK_ai_messages_conversations", ondelete="CASCADE" ),nullable=False)
    role = Column(NVARCHAR(20), nullable=False)
    content = Column(NVARCHAR(None),nullable=False)
    created_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"))
    response_type = Column(NVARCHAR(20),nullable=True)
    source = Column(NVARCHAR(100),nullable=True)
    filters_json = Column(NVARCHAR(None),nullable=True)
    metrics_json = Column(NVARCHAR(None),nullable=True)
    evidence_json = Column(NVARCHAR(None),nullable=True)
    
    # Relación: cada mensaje pertenece a una conversación.
    conversation = relationship("AIConversation", back_populates="messages")

    __table_args__ = (
        CheckConstraint("role IN (N'user', N'assistant')",name="CK_ai_messages_role"),
        CheckConstraint("response_type IS NULL OR ""response_type IN (N'text', N'chart', N'mixed')",name="CK_ai_messages_response_type"),
        CheckConstraint("filters_json IS NULL OR ISJSON(filters_json) = 1",name="CK_ai_messages_filters_json"),
        CheckConstraint("metrics_json IS NULL OR ISJSON(metrics_json) = 1",name="CK_ai_messages_metrics_json"),
        CheckConstraint("evidence_json IS NULL OR ISJSON(evidence_json) = 1",name="CK_ai_messages_evidence_json"),
        Index("IX_ai_messages_conversation_id_id","conversation_id","id"),{"schema": "dbo"},
    )