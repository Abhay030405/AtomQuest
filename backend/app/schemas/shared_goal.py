from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.core.constants import ThrustArea, UoMType
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
	# Enriched source-goal fields so the admin push-history UI can render
	# the KPI without an extra round-trip to fetch each source goal.
	source_goal_title: Optional[str] = None
	source_goal_description: Optional[str] = None
	source_goal_thrust_area: Optional[ThrustArea] = None
	source_goal_uom_type: Optional[UoMType] = None
	source_goal_target_value: Optional[Decimal] = None
	source_goal_target_date: Optional[date] = None
	source_goal_weightage: Optional[Decimal] = None
