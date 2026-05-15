from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.core.constants import GoalStatus, ThrustArea, UoMType
from app.schemas.common import BaseSchema


class GoalVersionResponse(BaseSchema):
	id: UUID
	goal_id: UUID
	version_number: int
	title: str
	description: Optional[str] = None
	thrust_area: ThrustArea
	uom_type: UoMType
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	weightage: Decimal
	status: GoalStatus
	changed_by: UUID
	changed_by_name: str
	change_reason: Optional[str] = None
	snapshot_at: datetime
