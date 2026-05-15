from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field, model_validator

from app.core.constants import GoalSheetStatus, GoalStatus, ThrustArea, UoMType
from app.schemas.common import BaseSchema
from app.schemas.goal_version import GoalVersionResponse


class GoalCreate(BaseSchema):
	title: str = Field(min_length=3, max_length=500)
	description: Optional[str] = Field(default=None, max_length=1000)
	thrust_area: ThrustArea
	uom_type: UoMType
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	weightage: Decimal = Field(ge=Decimal("10.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2)

	@model_validator(mode="after")
	def validate_targets(self) -> "GoalCreate":
		if self.uom_type == UoMType.TIMELINE:
			if self.target_date is None or self.target_value is not None:
				raise ValueError("TIMELINE goals require target_date and no target_value")
		else:
			if self.target_value is None or self.target_date is not None:
				raise ValueError("Non-TIMELINE goals require target_value and no target_date")
		if self.uom_type == UoMType.ZERO and self.target_value not in (None, Decimal("0"), Decimal("0.0")):
			raise ValueError("ZERO goals must have target_value of 0")
		return self


class GoalUpdate(BaseSchema):
	id: UUID
	title: Optional[str] = Field(default=None, min_length=3, max_length=500)
	description: Optional[str] = Field(default=None, max_length=1000)
	thrust_area: Optional[ThrustArea] = None
	uom_type: Optional[UoMType] = None
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	weightage: Optional[Decimal] = Field(
		default=None, ge=Decimal("10.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2
	)

	@model_validator(mode="after")
	def validate_targets(self) -> "GoalUpdate":
		if self.uom_type is None:
			return self
		if self.uom_type == UoMType.TIMELINE:
			if self.target_date is None or self.target_value is not None:
				raise ValueError("TIMELINE goals require target_date and no target_value")
		else:
			if self.target_value is None or self.target_date is not None:
				raise ValueError("Non-TIMELINE goals require target_value and no target_date")
		if self.uom_type == UoMType.ZERO and self.target_value not in (None, Decimal("0"), Decimal("0.0")):
			raise ValueError("ZERO goals must have target_value of 0")
		return self


class ManagerGoalEdit(BaseSchema):
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	weightage: Optional[Decimal] = Field(
		default=None, ge=Decimal("10.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2
	)
	change_reason: str = Field(min_length=20, max_length=500)


class GoalResponse(BaseSchema):
	id: UUID
	user_id: UUID
	goal_sheet_id: UUID
	cycle_id: UUID
	title: str
	description: Optional[str] = None
	thrust_area: ThrustArea
	uom_type: UoMType
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	weightage: Decimal
	status: GoalStatus
	is_shared: bool
	source_shared_goal_id: Optional[UUID] = None
	version: int
	locked_at: Optional[datetime] = None
	locked_by: Optional[UUID] = None
	locked_by_name: Optional[str] = None
	created_at: datetime
	updated_at: Optional[datetime] = None
	owner_name: Optional[str] = None
	sheet_status: Optional[GoalSheetStatus] = None


class GoalWithVersions(GoalResponse):
	versions: list[GoalVersionResponse]


class GoalSheetResponse(BaseSchema):
	id: UUID
	user_id: UUID
	cycle_id: UUID
	status: GoalSheetStatus
	goals: list[GoalResponse]
	total_weightage: Decimal
	submitted_at: Optional[datetime] = None
	approved_at: Optional[datetime] = None
	approved_by_name: Optional[str] = None
	returned_count: int
	cycle_name: Optional[str] = None
	owner_name: Optional[str] = None


class SheetSubmitResponse(BaseSchema):
	message: str
	sheet: GoalSheetResponse
	locked_at: datetime
