from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import BaseSchema


# ---------------------------------------------------------------------------
# Escalation chain step
# ---------------------------------------------------------------------------

class ChainStep(BaseSchema):
    target: str = Field(
        description="'self' | 'manager' | 'hr'",
        pattern=r"^(self|manager|hr)$",
    )
    delay_days: int = Field(ge=0)


# ---------------------------------------------------------------------------
# Escalation Rule schemas
# ---------------------------------------------------------------------------

class EscalationRuleCreate(BaseSchema):
    name: str = Field(min_length=3, max_length=200)
    trigger_condition: str = Field(
        description=(
            "'goals_not_submitted' | 'manager_approval_overdue' | 'checkin_not_completed'"
        ),
        pattern=r"^(goals_not_submitted|manager_approval_overdue|checkin_not_completed)$",
    )
    threshold_days: int = Field(ge=1)
    escalation_chain: list[ChainStep] = Field(min_length=1, max_length=10)
    notification_title_template: str = Field(min_length=5, max_length=500)
    notification_body_template: str = Field(min_length=5, max_length=2000)
    is_active: bool = True

    @field_validator("escalation_chain")
    @classmethod
    def chain_delay_days_ascending(cls, chain: list[ChainStep]) -> list[ChainStep]:
        for i in range(1, len(chain)):
            if chain[i].delay_days <= chain[i - 1].delay_days:
                raise ValueError("escalation_chain delay_days must be strictly ascending")
        return chain


class EscalationRuleUpdate(BaseSchema):
    name: Optional[str] = Field(default=None, min_length=3, max_length=200)
    threshold_days: Optional[int] = Field(default=None, ge=1)
    escalation_chain: Optional[list[ChainStep]] = None
    notification_title_template: Optional[str] = Field(default=None, min_length=5, max_length=500)
    notification_body_template: Optional[str] = Field(default=None, min_length=5, max_length=2000)
    is_active: Optional[bool] = None


class EscalationRuleResponse(BaseSchema):
    id: UUID
    name: str
    trigger_condition: str
    threshold_days: int
    escalation_chain: list[dict[str, Any]]
    notification_title_template: str
    notification_body_template: str
    is_active: bool
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Escalation Log schemas
# ---------------------------------------------------------------------------

class EscalationLogResponse(BaseSchema):
    id: UUID
    rule_id: UUID
    subject_user_id: UUID
    notified_user_id: UUID
    chain_level: int
    trigger_fired_at: datetime
    notified_at: datetime
    status: str
    resolved_at: Optional[datetime] = None
    cycle_id: Optional[UUID] = None
    context_data: Optional[dict[str, Any]] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Engine run result
# ---------------------------------------------------------------------------

class EscalationRunResult(BaseSchema):
    rules_evaluated: int
    notifications_sent: int
    errors: list[str] = []
