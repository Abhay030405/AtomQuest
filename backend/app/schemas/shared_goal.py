from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.schemas.goal import GoalCreate


class SharedGoalPush(BaseSchema):
	goal_data: GoalCreate
	recipient_user_ids: list[UUID] = Field(min_length=1, max_length=50)
	suggested_weightage: Decimal = Field(ge=Decimal("10.00"), le=Decimal("90.00"), max_digits=5, decimal_places=2)


class SharedGoalResponse(BaseSchema):
	id: UUID
	source_goal_id: UUID
	recipient_user_id: UUID
	recipient_name: str
	custom_weightage: Optional[Decimal] = None
	pushed_at: datetime
	pushed_by_name: str
