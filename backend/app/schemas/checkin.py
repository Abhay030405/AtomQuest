from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.core.constants import CheckinCommentType, CheckinRatingSentiment, Quarter
from app.schemas.common import BaseSchema


class CheckinCreate(BaseSchema):
	"""Manager creates a new quarterly check-in for an employee."""

	employee_id: UUID
	cycle_id: UUID
	quarter: Quarter
	# Comment must be a real conversation, not a single word
	comment: str = Field(min_length=20, max_length=4000)
	comment_type: CheckinCommentType = CheckinCommentType.FREEFORM
	goals_discussed: Optional[list[UUID]] = Field(default=None, max_length=50)
	overall_rating_sentiment: Optional[CheckinRatingSentiment] = None


class CheckinUpdate(BaseSchema):
	"""Manager edits a previously-created check-in (before acknowledgement)."""

	comment: Optional[str] = Field(default=None, min_length=20, max_length=4000)
	comment_type: Optional[CheckinCommentType] = None
	goals_discussed: Optional[list[UUID]] = Field(default=None, max_length=50)
	overall_rating_sentiment: Optional[CheckinRatingSentiment] = None
	# Required justification — service writes it into the CheckinEvent payload
	edit_reason: str = Field(min_length=10, max_length=500)


class CheckinAcknowledge(BaseSchema):
	"""Employee acknowledges receipt of a check-in."""

	checkin_id: UUID


class CheckinResponse(BaseSchema):
	id: UUID
	manager_id: UUID
	employee_id: UUID
	quarter: Quarter
	cycle_id: UUID
	comment: str
	comment_type: CheckinCommentType
	goals_discussed: Optional[list[UUID]] = None
	overall_rating_sentiment: Optional[CheckinRatingSentiment] = None
	completed_at: Optional[datetime] = None
	is_acknowledged_by_employee: bool
	acknowledged_at: Optional[datetime] = None
	created_at: datetime
	updated_at: Optional[datetime] = None
	# Optional enrichment populated by the service
	manager_name: Optional[str] = None
	employee_name: Optional[str] = None


class TeamCheckinSummary(BaseSchema):
	"""One row in the manager's "team check-in status" dashboard view."""

	employee_id: UUID
	employee_name: str
	employee_code: Optional[str] = None
	quarter: Quarter
	cycle_id: UUID
	checkin_id: Optional[UUID] = None
	is_completed: bool
	is_acknowledged_by_employee: bool
	completed_at: Optional[datetime] = None
	acknowledged_at: Optional[datetime] = None
	weighted_score: Optional[Decimal] = None
