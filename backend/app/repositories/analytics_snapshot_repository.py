from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Quarter
from app.models.analytics_snapshot import AnalyticsSnapshot
from app.models.department import Department
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class AnalyticsSnapshotRepository(BaseRepository[AnalyticsSnapshot]):
	"""Data-access for the lite-CQRS read projection.

	No business logic — projection is maintained by `SnapshotUpdateHandler`.
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
		"""Department × quarter aggregates for the admin completion dashboard.

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
