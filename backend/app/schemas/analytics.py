from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.core.constants import Quarter
from app.schemas.common import BaseSchema


class SnapshotResponse(BaseSchema):
	"""Read projection from `analytics_snapshots`."""

	id: UUID
	user_id: UUID
	quarter: Quarter
	cycle_id: UUID
	department_id: Optional[UUID] = None
	manager_id: Optional[UUID] = None
	weighted_score: Optional[Decimal] = None
	goals_total: int
	goals_submitted: int
	goals_completed: int
	checkin_done: bool
	achievement_submitted: bool
	snapshot_generated_at: datetime
	# Optional enrichment populated by the service
	user_name: Optional[str] = None
	department_name: Optional[str] = None
	manager_name: Optional[str] = None


class CompletionHeatmapCell(BaseSchema):
	"""One cell of the (department × quarter) completion heatmap."""

	department_id: UUID
	department_name: str
	quarter: Quarter
	total_users: int
	users_with_achievement: int
	users_with_checkin: int
	completion_percentage: Decimal


class DepartmentSummary(BaseSchema):
	"""Aggregate stats for an entire department in one cycle."""

	department_id: UUID
	department_name: str
	cycle_id: UUID
	total_users: int
	goals_total: int
	goals_submitted: int
	goals_completed: int
	avg_weighted_score: Optional[Decimal] = None
	checkins_completed: int
	achievements_submitted: int
