from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Quarter
from app.models.analytics_snapshot import AnalyticsSnapshot
from app.models.department import Department
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class AnalyticsSnapshotRepository(BaseRepository[AnalyticsSnapshot]):
	"""Data-access for the lite-CQRS read projection.

	No business logic â€” projection is maintained by `SnapshotUpdateHandler`.
	Methods flush but never commit; caller owns the transaction.
	"""

	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, AnalyticsSnapshot)

	async def get_by_user_quarter(
		self, user_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> AnalyticsSnapshot | None:
		stmt = (
			select(AnalyticsSnapshot)
			.where(AnalyticsSnapshot.user_id == user_id)
			.where(AnalyticsSnapshot.quarter == quarter)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def upsert(self, snapshot_data: dict[str, Any]) -> AnalyticsSnapshot:
		"""Upsert keyed on UNIQUE(user_id, quarter, cycle_id).

		The caller MUST provide user_id, quarter and cycle_id in
		`snapshot_data`. All remaining keys are written verbatim. No commit.
		"""
		user_id = snapshot_data["user_id"]
		quarter = snapshot_data["quarter"]
		cycle_id = snapshot_data["cycle_id"]
		existing = await self.get_by_user_quarter(user_id, quarter, cycle_id)
		if existing is None:
			instance = AnalyticsSnapshot(**snapshot_data)
			self.session.add(instance)
			await self.session.flush()
			return instance
		for key, value in snapshot_data.items():
			if key in {"user_id", "quarter", "cycle_id"}:
				continue
			setattr(existing, key, value)
		await self.session.flush()
		return existing

	async def get_team_snapshots(
		self, manager_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> list[AnalyticsSnapshot]:
		stmt = (
			select(AnalyticsSnapshot)
			.where(AnalyticsSnapshot.manager_id == manager_id)
			.where(AnalyticsSnapshot.quarter == quarter)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.order_by(AnalyticsSnapshot.weighted_score.desc().nullslast())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_department_snapshots(
		self, department_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> list[AnalyticsSnapshot]:
		stmt = (
			select(AnalyticsSnapshot)
			.where(AnalyticsSnapshot.department_id == department_id)
			.where(AnalyticsSnapshot.quarter == quarter)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.order_by(AnalyticsSnapshot.weighted_score.desc().nullslast())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_completion_heatmap(self, cycle_id: UUID) -> list[dict[str, Any]]:
		"""Department Ã— quarter aggregates for the admin completion dashboard.

		Returns dicts with: department_id, department_name, quarter,
		total_employees, achievement_submitted_count, checkin_done_count,
		achievement_pct, checkin_pct.
		"""
		total = func.count(AnalyticsSnapshot.id).label("total_employees")
		ach_count = func.sum(
			case((AnalyticsSnapshot.achievement_submitted.is_(True), 1), else_=0)
		).label("achievement_submitted_count")
		chk_count = func.sum(
			case((AnalyticsSnapshot.checkin_done.is_(True), 1), else_=0)
		).label("checkin_done_count")

		stmt = (
			select(
				AnalyticsSnapshot.department_id,
				Department.name.label("department_name"),
				AnalyticsSnapshot.quarter,
				total,
				ach_count,
				chk_count,
			)
			.join(
				Department,
				and_(
					Department.id == AnalyticsSnapshot.department_id,
					Department.is_deleted.is_(False),
				),
			)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.where(AnalyticsSnapshot.department_id.is_not(None))
			.group_by(
				AnalyticsSnapshot.department_id,
				Department.name,
				AnalyticsSnapshot.quarter,
			)
			.order_by(Department.name.asc(), AnalyticsSnapshot.quarter.asc())
		)
		result = await self.session.execute(stmt)
		rows = result.all()

		out: list[dict[str, Any]] = []
		for row in rows:
			total_n = int(row.total_employees) or 0
			ach_n = int(row.achievement_submitted_count or 0)
			chk_n = int(row.checkin_done_count or 0)
			out.append(
				{
					"department_id": row.department_id,
					"department_name": row.department_name,
					"quarter": row.quarter,
					"total_employees": total_n,
					"achievement_submitted_count": ach_n,
					"checkin_done_count": chk_n,
					"achievement_pct": (ach_n / total_n * 100) if total_n else 0.0,
					"checkin_pct": (chk_n / total_n * 100) if total_n else 0.0,
				}
			)
		return out

	async def get_overdue_users(
		self, quarter: Quarter, cycle_id: UUID
	) -> list[AnalyticsSnapshot]:
		"""Snapshots flagged as not-yet-complete on either dimension."""
		stmt = (
			select(AnalyticsSnapshot)
			.join(User, User.id == AnalyticsSnapshot.user_id)
			.where(AnalyticsSnapshot.quarter == quarter)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.where(
				(AnalyticsSnapshot.achievement_submitted.is_(False))
				| (AnalyticsSnapshot.checkin_done.is_(False))
			)
			.where(User.is_active.is_(True))
			.where(User.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	# ------------------------------------------------------------------
	# Analytics Module — Phase 2 features
	# ------------------------------------------------------------------

	async def get_qoq_trend(
		self,
		cycle_id: UUID,
		scope: str = "org",
		scope_id: UUID | None = None,
	) -> list[dict[str, Any]]:
		"""Quarter-on-Quarter trend: avg weighted_score grouped by quarter.

		scope = 'org' | 'department' | 'manager' | 'user'
		"""
		avg_score = func.avg(AnalyticsSnapshot.weighted_score).label("avg_score")
		total = func.count(AnalyticsSnapshot.id).label("total")

		stmt = (
			select(AnalyticsSnapshot.quarter, avg_score, total)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.where(AnalyticsSnapshot.weighted_score.is_not(None))
		)

		if scope == "department" and scope_id:
			stmt = stmt.where(AnalyticsSnapshot.department_id == scope_id)
		elif scope == "manager" and scope_id:
			stmt = stmt.where(AnalyticsSnapshot.manager_id == scope_id)
		elif scope == "user" and scope_id:
			stmt = stmt.where(AnalyticsSnapshot.user_id == scope_id)

		stmt = stmt.group_by(AnalyticsSnapshot.quarter).order_by(AnalyticsSnapshot.quarter.asc())
		result = await self.session.execute(stmt)
		rows = result.all()

		quarter_order = {q.value: i for i, q in enumerate(Quarter)}
		out = [
			{
				"quarter": (
					row.quarter.value if hasattr(row.quarter, "value") else row.quarter
				),
				"avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
				"total_employees": int(row.total),
			}
			for row in rows
		]
		out.sort(key=lambda r: quarter_order.get(r["quarter"], 99))
		return out

	async def get_manager_effectiveness(self, cycle_id: UUID) -> list[dict[str, Any]]:
		"""Per-manager summary: headcount, avg turnaround days, avg score, checkin rate."""
		avg_score = func.avg(AnalyticsSnapshot.weighted_score).label("avg_score")
		total_reports = func.count(AnalyticsSnapshot.id).label("total_reports")
		checkin_count = func.sum(
			case((AnalyticsSnapshot.checkin_done.is_(True), 1), else_=0)
		).label("checkin_count")

		snap_stmt = (
			select(
				AnalyticsSnapshot.manager_id,
				avg_score,
				total_reports,
				checkin_count,
			)
			.where(AnalyticsSnapshot.cycle_id == cycle_id)
			.where(AnalyticsSnapshot.is_deleted.is_(False))
			.where(AnalyticsSnapshot.manager_id.is_not(None))
			.group_by(AnalyticsSnapshot.manager_id)
		)
		snap_result = await self.session.execute(snap_stmt)
		snap_rows = {row.manager_id: row for row in snap_result.all()}

		if not snap_rows:
			return []

		turnaround_days = func.avg(
			func.extract("epoch", GoalSheet.approved_at - GoalSheet.submitted_at) / 86400.0
		).label("avg_turnaround_days")

		ta_stmt = (
			select(User.manager_id, turnaround_days)
			.join(GoalSheet, GoalSheet.user_id == User.id)
			.where(GoalSheet.cycle_id == cycle_id)
			.where(GoalSheet.submitted_at.is_not(None))
			.where(GoalSheet.approved_at.is_not(None))
			.where(User.is_deleted.is_(False))
			.group_by(User.manager_id)
		)
		ta_result = await self.session.execute(ta_stmt)
		ta_rows = {row.manager_id: row.avg_turnaround_days for row in ta_result.all()}

		manager_ids = list(snap_rows.keys())
		mgr_stmt = (
			select(User.id, User.full_name)
			.where(User.id.in_(manager_ids))
			.where(User.is_deleted.is_(False))
		)
		mgr_result = await self.session.execute(mgr_stmt)
		mgr_names = {row.id: row.full_name for row in mgr_result.all()}

		out: list[dict[str, Any]] = []
		for manager_id, snap in snap_rows.items():
			total = int(snap.total_reports) or 0
			checkin_n = int(snap.checkin_count or 0)
			ta = ta_rows.get(manager_id)
			out.append(
				{
					"manager_id": str(manager_id),
					"manager_name": mgr_names.get(manager_id, "Unknown"),
					"direct_reports": total,
					"avg_turnaround_days": round(float(ta), 1) if ta is not None else None,
					"avg_team_score": round(float(snap.avg_score), 2)
					if snap.avg_score is not None
					else None,
					"checkin_count": checkin_n,
					"checkin_rate": round(checkin_n / total * 100, 1) if total else 0.0,
				}
			)
		out.sort(key=lambda r: r["checkin_rate"])
		return out
