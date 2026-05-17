from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.core.constants import AchievementStatus, Quarter
from app.schemas.common import BaseSchema


class GoalReportRow(BaseSchema):
	employee_name: str
	employee_code: str
	department: str
	manager_name: str
	goal_title: str
	thrust_area: str
	uom_type: str
	target_value: Optional[Decimal] = None
	weightage: Decimal
	sheet_status: str


class OrgCompletionSummary(BaseSchema):
	department_name: str
	total_employees: int
	sheets_submitted: int
	sheets_approved: int
	sheets_pending: int
	completion_percentage: Decimal


class OrgStatsResponse(BaseSchema):
	total_employees: int
	total_sheets: int
	submitted_count: int
	approved_count: int
	pending_count: int
	completion_percentage: Decimal
	department_summaries: list[OrgCompletionSummary]


# Phase 2 report rows --------------------------------------------------------


class AchievementReportRow(BaseSchema):
	"""One row in the Phase 2 achievement CSV export."""

	employee_name: str
	employee_code: Optional[str] = None
	department: Optional[str] = None
	manager_name: Optional[str] = None
	goal_title: str
	thrust_area: str
	uom_type: str
	target_value: Optional[Decimal] = None
	target_date: Optional[date] = None
	quarter: Quarter
	actual_value: Optional[Decimal] = None
	actual_date: Optional[date] = None
	status: AchievementStatus
	computed_score: Optional[Decimal] = None
	weighted_score: Optional[Decimal] = None
	submitted_at: Optional[datetime] = None


class OverdueUser(BaseSchema):
	"""User flagged as overdue: no achievement / no check-in past the window."""

	user_id: UUID
	user_name: str
	employee_code: Optional[str] = None
	department: Optional[str] = None
	manager_name: Optional[str] = None
	quarter: Quarter
	missing_achievement: bool
	missing_checkin: bool


class CompletionSummary(BaseSchema):
	"""Org-wide Phase 2 completion roll-up for a single quarter."""

	quarter: Quarter
	cycle_id: UUID
	total_users: int
	achievements_submitted: int
	checkins_completed: int
	checkins_acknowledged: int
	achievement_completion_percentage: Decimal
	checkin_completion_percentage: Decimal
