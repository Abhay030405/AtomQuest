from __future__ import annotations

from decimal import Decimal
from typing import Optional

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
