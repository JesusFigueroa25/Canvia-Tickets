from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

class AIPlanBase(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

class AIQueryFilter(AIPlanBase):
    field: str = Field(min_length=1, max_length=100)
    operator: Literal[
        "eq", "ne", "in", "not_in", "gt", "gte", "lt", "lte",
        "date_range", "is_null", "is_not_null", "contains",
    ]
    value: Any = None

class AIQueryGroup(AIPlanBase):
    field: str = Field(min_length=1, max_length=100)
    bucket: Literal["value", "day", "month", "year"] = "value"

class AIQueryMetric(AIPlanBase):
    alias: str = Field(min_length=1, max_length=50)
    function: Literal[
        "count", "count_distinct", "count_if", "min_date", "max_date",
        "avg_resolution_hours", "sla_compliance", "percent_of_total",
    ]
    field: str | None = None
    condition: AIQueryFilter | None = None


class AIQueryOrder(AIPlanBase):
    field: str = Field(min_length=1, max_length=100)
    direction: Literal["asc", "desc"] = "desc"


class AnalyticalQueryPlan(AIPlanBase):
    version: Literal[1] = 1
    source: Literal[
        "incident_consolidated",
        "incident_sla",
        "requirement_consolidated",
        "requirement_sla",
    ]
    operation: Literal["aggregate", "grouped_aggregate"]
    filters: list[AIQueryFilter] = Field(default_factory=list)
    group_by: list[AIQueryGroup] = Field(default_factory=list)
    metrics: list[AIQueryMetric] = Field(min_length=1)
    order_by: list[AIQueryOrder] = Field(default_factory=list)
    limit: int | None = None
    offset: int = 0
    
    

class ChatBaseSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatMessageRequest(ChatBaseSchema):
    pregunta: str = Field(
        min_length=1,
        max_length=2000,
    )
    conversation_id: int | None = Field(
        default=None,
        gt=0,
    )


class ChatMessageResponse(ChatBaseSchema):
    status: Literal[
        "success",
        "needs_clarification",
        "unsupported",
    ]
    conversation_id: int
    response_type: Literal["text"]
    answer: str
    context_state: dict[str, Any]
    source: str | None = None
    route: str | None = None
    generation_mode: str | None = None
    metrics: dict[str, Any] = Field(
        default_factory=dict
    )
    executed: bool
    persisted: bool


class ChatConversationOut(ChatBaseSchema):
    id: int
    title: str
    context_state: dict[str, Any]


class ChatConversationListOut(ChatBaseSchema):
    conversations: list[ChatConversationOut]
    limit: int
    offset: int


class ChatMessageOut(ChatBaseSchema):
    id: int
    role: Literal["user", "assistant"]
    content: str
    response_type: str | None = None
    source: str | None = None


class ChatHistoryOut(ChatBaseSchema):
    conversation_id: int
    messages: list[ChatMessageOut]
    limit: int
    offset: int
