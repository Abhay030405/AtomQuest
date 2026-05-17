from __future__ import annotations

import csv
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass, field
from decimal import Decimal
from io import StringIO
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.constants import GoalSheetStatus, GoalStatus, Quarter, UserRole
from app.models.achievement import Achievement
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


# ---------------------------------------------------------------------------
# Phase 2 — AchievementReportBuilder (Build plan §6.3) + CSVExporter
# ---------------------------------------------------------------------------


# CSV columns — order is contractual; tests / consumers depend on it.
ACHIEVEMENT_CSV_COLUMNS: tuple[str, ...] = (
	"Employee",
	"Employee Code",
	"Department",
	"Manager",
	"Goal Title",
	"UoM Type",
	"Target",
	"Actual",
	"Computed Score",
	"Status",
	"Quarter",
	"Cycle",
)


@dataclass
class AchievementReportRowDict:
	"""Lightweight row shape — works as both a Pydantic-friendly dict and as
	an ordered tuple for the CSV stream. Built by `AchievementReportBuilder`."""

	employee_name: str
	employee_code: str
	department: str
	manager_name: str
	goal_title: str
	uom_type: str
	target: str
	actual: str
	computed_score: str
	status: str
	quarter: str
	cycle: str
	# Optional enrichments (not part of CSV) used by the JSON endpoint.
	weighted_score: Optional[Decimal] = None
	qoq_prev_score: Optional[Decimal] = None

	def to_csv_tuple(self) -> tuple[str, ...]:
		return (
			self.employee_name,
			self.employee_code,
			self.department,
			self.manager_name,
			self.goal_title,
			self.uom_type,
			self.target,
			self.actual,
			self.computed_score,
			self.status,
			self.quarter,
			self.cycle,
		)

	def to_dict(self) -> dict[str, Any]:
		return {
			"employee_name": self.employee_name,
			"employee_code": self.employee_code,
			"department": self.department,
			"manager_name": self.manager_name,
			"goal_title": self.goal_title,
			"uom_type": self.uom_type,
			"target": self.target,
			"actual": self.actual,
			"computed_score": self.computed_score,
			"status": self.status,
			"quarter": self.quarter,
			"cycle": self.cycle,
			"weighted_score": (
				str(self.weighted_score) if self.weighted_score is not None else None
			),
			"qoq_prev_score": (
				str(self.qoq_prev_score) if self.qoq_prev_score is not None else None
			),
		}


@dataclass
class AchievementReportBuilder:
	"""Fluent builder for the Phase 2 achievement export.

	Usage::

	    rows = await (
	        AchievementReportBuilder()
	        .for_quarter(Quarter.Q1)
	        .for_department(dept_id)
	        .for_manager(mgr_id)
	        .include_scores()
	        .include_qoq_comparison()
	        .build(db)
	    )

	Build returns an **async iterator** of rows — never materialises the full
	dataset so it stays memory-bounded even for org-wide exports.
	"""

	quarter: Optional[Quarter] = None
	cycle_id: Optional[UUID] = None
	department_id: Optional[UUID] = None
	manager_id: Optional[UUID] = None
	include_score_breakdown: bool = False
	include_qoq: bool = False
	# Internal: hard-cap to defend against runaway queries.
	_max_rows: int = field(default=100_000)

	# -- fluent setters -------------------------------------------------

	def for_quarter(self, quarter: Quarter) -> "AchievementReportBuilder":
		self.quarter = quarter
		return self

	def for_cycle(self, cycle_id: UUID) -> "AchievementReportBuilder":
		self.cycle_id = cycle_id
		return self

	def for_department(self, department_id: UUID) -> "AchievementReportBuilder":
		self.department_id = department_id
		return self

	def for_manager(self, manager_id: UUID) -> "AchievementReportBuilder":
		self.manager_id = manager_id
		return self

	def include_scores(self) -> "AchievementReportBuilder":
		self.include_score_breakdown = True
		return self

	def include_qoq_comparison(self) -> "AchievementReportBuilder":
		self.include_qoq = True
		return self

	# -- query construction --------------------------------------------

	def _build_stmt(self):
		mgr = aliased(User)
		stmt = (
			select(
				Goal,
				Achievement,
				User,
				Department.name.label("department_name"),
				mgr.full_name.label("manager_name"),
			)
			.select_from(Goal)
			.join(User, User.id == Goal.user_id)
			.join(
				Department,
				Department.id == User.department_id,
				isouter=True,
			)
			.join(mgr, mgr.id == User.manager_id, isouter=True)
			.join(
				Achievement,
				(Achievement.goal_id == Goal.id)
				& (Achievement.is_deleted.is_(False)),
				isouter=True,
			)
			.where(Goal.is_deleted.is_(False))
			.where(Goal.status == GoalStatus.LOCKED)
		)
		if self.cycle_id is not None:
			stmt = stmt.where(Goal.cycle_id == self.cycle_id)
		if self.quarter is not None:
			# Outer-join with the quarter filter on Achievement: rows without
			# an achievement for this quarter are emitted with empty actual.
			stmt = stmt.where(
				(Achievement.quarter == self.quarter) | (Achievement.id.is_(None))
			)
		if self.department_id is not None:
			stmt = stmt.where(User.department_id == self.department_id)
		if self.manager_id is not None:
			stmt = stmt.where(User.manager_id == self.manager_id)
		stmt = stmt.order_by(User.full_name.asc(), Goal.title.asc())
		return stmt.limit(self._max_rows)

	# -- build (streaming) ---------------------------------------------

	async def build(self, db: AsyncSession) -> AsyncIterator[AchievementReportRowDict]:
		"""Stream rows lazily.

		Single SQL round-trip (`stream()`); rows are yielded one at a time.
		QoQ comparison runs an extra targeted lookup only when requested.
		"""
		stmt = self._build_stmt()
		result = await db.stream(stmt)

		cycle_name_cache: dict[UUID, str] = {}

		async def _cycle_name(cycle_id: UUID) -> str:
			cached = cycle_name_cache.get(cycle_id)
			if cached is not None:
				return cached
			from app.models.cycle_config import CycleConfig  # local import: avoid cycle

			row = (
				await db.execute(
					select(CycleConfig.cycle_name).where(CycleConfig.id == cycle_id)
				)
			).scalar_one_or_none()
			name = row or str(cycle_id)
			cycle_name_cache[cycle_id] = name
			return name

		async for row in result:
			goal: Goal = row.Goal
			achievement: Optional[Achievement] = row.Achievement
			user: User = row.User
			dept_name: Optional[str] = row.department_name
			manager_name: Optional[str] = row.manager_name

			cycle_name = await _cycle_name(goal.cycle_id)
			target_str = (
				str(goal.target_value)
				if goal.target_value is not None
				else (goal.target_date.isoformat() if goal.target_date else "")
			)
			actual_str = ""
			score_str = ""
			status_str = ""
			quarter_str = self.quarter.value if self.quarter else ""
			if achievement is not None:
				actual_str = (
					str(achievement.actual_value)
					if achievement.actual_value is not None
					else (
						achievement.actual_date.isoformat()
						if achievement.actual_date
						else ""
					)
				)
				if self.include_score_breakdown and achievement.computed_score is not None:
					score_str = str(achievement.computed_score)
				status_str = (
					achievement.status.value
					if hasattr(achievement.status, "value")
					else str(achievement.status)
				)
				quarter_str = (
					achievement.quarter.value
					if hasattr(achievement.quarter, "value")
					else str(achievement.quarter)
				)

			out = AchievementReportRowDict(
				employee_name=user.full_name,
				employee_code=user.employee_code or "",
				department=dept_name or "",
				manager_name=manager_name or "",
				goal_title=goal.title,
				uom_type=(
					goal.uom_type.value
					if hasattr(goal.uom_type, "value")
					else str(goal.uom_type)
				),
				target=target_str,
				actual=actual_str,
				computed_score=score_str,
				status=status_str,
				quarter=quarter_str,
				cycle=cycle_name,
			)

			if self.include_qoq and self.quarter is not None and achievement is not None:
				out.qoq_prev_score = await self._fetch_prev_quarter_score(
					db, goal.id, self.quarter
				)

			yield out

	async def _fetch_prev_quarter_score(
		self, db: AsyncSession, goal_id: UUID, quarter: Quarter
	) -> Optional[Decimal]:
		"""Look up the previous-quarter score for QoQ delta display.

		Linear chain Q1→Q2→Q3→Q4; Q1 has no predecessor.
		"""
		order = [Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4]
		idx = order.index(quarter)
		if idx == 0:
			return None
		prev = order[idx - 1]
		row = (
			await db.execute(
				select(Achievement.computed_score)
				.where(Achievement.goal_id == goal_id)
				.where(Achievement.quarter == prev)
				.where(Achievement.is_deleted.is_(False))
			)
		).scalar_one_or_none()
		return row


class CSVExporter:
	"""Stream CSV bytes from any iterable / async-iterable of report rows.

	Memory-efficient — never loads the dataset; each row is encoded and yielded
	immediately so it can be piped into FastAPI's ``StreamingResponse``.
	"""

	@staticmethod
	def _encode(row: Iterable[Any]) -> str:
		buf = StringIO()
		writer = csv.writer(buf)
		writer.writerow(list(row))
		return buf.getvalue()

	@classmethod
	async def stream(
		cls,
		rows: "AsyncIterator[AchievementReportRowDict] | Iterable[AchievementReportRowDict]",
		*,
		headers: tuple[str, ...] = ACHIEVEMENT_CSV_COLUMNS,
	) -> AsyncIterator[str]:
		"""Yield CSV chunks. Empty dataset → returns just the header row."""
		yield cls._encode(headers)
		if hasattr(rows, "__aiter__"):
			async for row in rows:  # type: ignore[union-attr]
				yield cls._encode(row.to_csv_tuple())
		else:
			for row in rows:  # type: ignore[assignment]
				yield cls._encode(row.to_csv_tuple())


__all__ = [
	"ReportService",
	"report_service",
	"AchievementReportBuilder",
	"AchievementReportRowDict",
	"CSVExporter",
	"ACHIEVEMENT_CSV_COLUMNS",
]
