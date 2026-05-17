from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field, model_validator

from app.core.constants import AchievementStatus, Quarter
from app.schemas.common import BaseSchema


class AchievementCreate(BaseSchema):
	"""Submit a quarterly achievement for a single goal."""

	goal_id: UUID
	quarter: Quarter
	# Optional at the schema layer: ZERO / TIMELINE goals have different rules
	actual_value: Optional[Decimal] = Field(
		default=None, ge=Decimal("0"), max_digits=15, decimal_places=4
	)
	actual_date: Optional[date] = None
	status: AchievementStatus = AchievementStatus.NOT_STARTED

	@model_validator(mode="after")
	def validate_value_or_date(self) -> "AchievementCreate":
		# Cross-field rule for the boundary: must supply at least one signal
		# of progress unless explicitly NOT_STARTED.
		if self.status != AchievementStatus.NOT_STARTED:
			if self.actual_value is None and self.actual_date is None:
				raise ValueError(
					"actual_value or actual_date is required once status leaves not_started"
				)
		return self


class AchievementBulkCreate(BaseSchema):
	"""Submit multiple quarterly achievements in one request."""

	achievements: list[AchievementCreate] = Field(min_length=1, max_length=50)


class AchievementResubmit(BaseSchema):
	"""Edit an already-submitted achievement.

	`edit_reason` is mandatory — the service writes it to AchievementVersion.
	"""

	actual_value: Optional[Decimal] = Field(
		default=None, ge=Decimal("0"), max_digits=15, decimal_places=4
	)
	actual_date: Optional[date] = None
	status: Optional[AchievementStatus] = None
	edit_reason: str = Field(min_length=10, max_length=500)


class ScoreBreakdown(BaseSchema):
	"""Service-computed score breakdown attached to AchievementResponse."""

	formula_used: str
	target_value: Optional[Decimal] = None
	actual_value: Optional[Decimal] = None
	raw_ratio: Optional[Decimal] = None
	computed_score: Optional[Decimal] = None
	notes: Optional[str] = None


class AchievementResponse(BaseSchema):
	id: UUID
	goal_id: UUID
	quarter: Quarter
	actual_value: Optional[Decimal] = None
	actual_date: Optional[date] = None
	status: AchievementStatus
	computed_score: Optional[Decimal] = None
	score_formula_used: Optional[str] = None
	submitted_at: Optional[datetime] = None
	submitted_by: Optional[UUID] = None
	is_synced_from_shared: bool
	created_at: datetime
	updated_at: Optional[datetime] = None
	# Optional enrichment populated by the service
	goal_title: Optional[str] = None
	owner_name: Optional[str] = None
	score_breakdown: Optional[ScoreBreakdown] = None
