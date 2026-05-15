from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import GoalSheetStatus, UserRole
from app.models.department import Department
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.schemas.report import GoalReportRow, OrgCompletionSummary, OrgStatsResponse


class ReportService:
	async def get_org_stats(self, db: AsyncSession) -> OrgStatsResponse:
		total_employees_stmt = select(func.count()).select_from(User).where(User.role == UserRole.EMPLOYEE)
		total_employees = int((await db.execute(total_employees_stmt)).scalar_one())

		total_sheets_stmt = select(func.count()).select_from(GoalSheet)
		total_sheets = int((await db.execute(total_sheets_stmt)).scalar_one())

		submitted_stmt = select(func.count()).select_from(GoalSheet).where(GoalSheet.status == GoalSheetStatus.SUBMITTED)
		approved_stmt = select(func.count()).select_from(GoalSheet).where(GoalSheet.status == GoalSheetStatus.APPROVED)
		pending_stmt = select(func.count()).select_from(GoalSheet).where(GoalSheet.status == GoalSheetStatus.DRAFT)

		submitted_count = int((await db.execute(submitted_stmt)).scalar_one())
		approved_count = int((await db.execute(approved_stmt)).scalar_one())
		pending_count = int((await db.execute(pending_stmt)).scalar_one())

		completion_percentage = Decimal("0")
		if total_sheets > 0:
			completion_percentage = (Decimal(approved_count) / Decimal(total_sheets)) * Decimal("100")

		department_summaries = await self.get_completion_by_department(db)

		return OrgStatsResponse(
			total_employees=total_employees,
			total_sheets=total_sheets,
			submitted_count=submitted_count,
			approved_count=approved_count,
			pending_count=pending_count,
			completion_percentage=completion_percentage,
			department_summaries=department_summaries,
		)

	async def get_completion_by_department(self, db: AsyncSession) -> list[OrgCompletionSummary]:
		stmt = (
			select(
				Department.name,
				func.count(User.id),
				func.sum(case((GoalSheet.status == GoalSheetStatus.SUBMITTED, 1), else_=0)),
				func.sum(case((GoalSheet.status == GoalSheetStatus.APPROVED, 1), else_=0)),
				func.sum(case((GoalSheet.status == GoalSheetStatus.DRAFT, 1), else_=0)),
			)
			.join(User, User.department_id == Department.id)
			.join(GoalSheet, GoalSheet.user_id == User.id, isouter=True)
			.group_by(Department.name)
		)
		result = await db.execute(stmt)
		summaries: list[OrgCompletionSummary] = []
		for name, total, submitted, approved, pending in result.all():
			completion = Decimal("0")
			if total:
				completion = (Decimal(approved or 0) / Decimal(total)) * Decimal("100")
			summaries.append(
				OrgCompletionSummary(
					department_name=name,
					total_employees=int(total or 0),
					sheets_submitted=int(submitted or 0),
					sheets_approved=int(approved or 0),
					sheets_pending=int(pending or 0),
					completion_percentage=completion,
				)
			)
		return summaries

	async def get_goal_report(
		self,
		filters: dict[str, Any],
		skip: int,
		limit: int,
		db: AsyncSession,
	) -> tuple[list[GoalReportRow], int]:
		stmt = (
			select(
				User.full_name,
				User.employee_code,
				Department.name,
				Goal.title,
				Goal.thrust_area,
				Goal.uom_type,
				Goal.target_value,
				Goal.weightage,
				GoalSheet.status,
			)
			.join(User, Goal.user_id == User.id)
			.join(Department, User.department_id == Department.id, isouter=True)
			.join(GoalSheet, Goal.goal_sheet_id == GoalSheet.id)
		)

		if filters.get("department_id"):
			stmt = stmt.where(User.department_id == filters["department_id"])
		if filters.get("manager_id"):
			stmt = stmt.where(User.manager_id == filters["manager_id"])
		if filters.get("status"):
			stmt = stmt.where(GoalSheet.status == filters["status"])

		count_stmt = select(func.count()).select_from(stmt.subquery())
		total = int((await db.execute(count_stmt)).scalar_one())

		stmt = stmt.offset(skip).limit(limit)
		result = await db.execute(stmt)
		rows = []
		for full_name, employee_code, department, title, thrust, uom, target_value, weightage, sheet_status in result.all():
			rows.append(
				GoalReportRow(
					employee_name=full_name,
					employee_code=employee_code or "",
					department=department or "",
					manager_name="",
					goal_title=title,
					thrust_area=str(thrust),
					uom_type=str(uom),
					target_value=target_value or Decimal("0"),
					weightage=weightage,
					sheet_status=str(sheet_status),
				)
			)
		return rows, total

	def generate_csv_content(self, rows: list[GoalReportRow]) -> str:
		import csv
		from io import StringIO

		output = StringIO()
		writer = csv.writer(output)
		writer.writerow(
			[
				"employee_name",
				"employee_code",
				"department",
				"manager_name",
				"goal_title",
				"thrust_area",
				"uom_type",
				"target_value",
				"weightage",
				"sheet_status",
			]
		)
		for row in rows:
			writer.writerow(
				[
					row.employee_name,
					row.employee_code,
					row.department,
					row.manager_name,
					row.goal_title,
					row.thrust_area,
					row.uom_type,
					row.target_value,
					row.weightage,
					row.sheet_status,
				]
			)
		return output.getvalue()


report_service = ReportService()
