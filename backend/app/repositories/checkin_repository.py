from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CheckinEventType, Quarter
from app.models.checkin import Checkin
from app.models.checkin_event import CheckinEvent
from app.models.cycle_config import CycleConfig
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class CheckinRepository(BaseRepository[Checkin]):
	"""Data-access for check-ins and their immutable event log.

	Phase 2 data layer. No business logic. Methods flush but never commit;
	the caller owns the transaction.
	"""

	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, Checkin)

	async def get_by_manager_employee_quarter(
		self,
		manager_id: UUID,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
	) -> Checkin | None:
		"""Single-row lookup by the 4-part UNIQUE key."""
		stmt = (
			select(Checkin)
			.where(Checkin.manager_id == manager_id)
			.where(Checkin.employee_id == employee_id)
			.where(Checkin.quarter == quarter)
			.where(Checkin.cycle_id == cycle_id)
			.where(Checkin.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_by_employee_quarter(
		self,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
	) -> list[Checkin]:
		"""All check-ins received by an employee for the given quarter/cycle."""
		stmt = (
			select(Checkin)
			.where(Checkin.employee_id == employee_id)
			.where(Checkin.quarter == quarter)
			.where(Checkin.cycle_id == cycle_id)
			.where(Checkin.is_deleted.is_(False))
			.order_by(Checkin.completed_at.desc().nullslast())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_team_checkins(
		self, manager_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> list[Checkin]:
		"""All check-ins this manager has completed for the given quarter."""
		stmt = (
			select(Checkin)
			.where(Checkin.manager_id == manager_id)
			.where(Checkin.quarter == quarter)
			.where(Checkin.cycle_id == cycle_id)
			.where(Checkin.is_deleted.is_(False))
			.order_by(Checkin.completed_at.desc().nullslast())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_completion_rate(
		self, manager_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> tuple[int, int]:
		"""(checkins_done, total_active_reports) for this manager/quarter."""
		done_stmt = (
			select(func.count())
			.select_from(Checkin)
			.where(Checkin.manager_id == manager_id)
			.where(Checkin.quarter == quarter)
			.where(Checkin.cycle_id == cycle_id)
			.where(Checkin.is_deleted.is_(False))
		)
		total_stmt = (
			select(func.count())
			.select_from(User)
			.where(User.manager_id == manager_id)
			.where(User.is_active.is_(True))
			.where(User.is_deleted.is_(False))
		)
		done_result = await self.session.execute(done_stmt)
		total_result = await self.session.execute(total_stmt)
		return int(done_result.scalar_one()), int(total_result.scalar_one())

	async def get_overdue(
		self, quarter: Quarter, cycle_id: UUID
	) -> list[dict[str, Any]]:
		"""Active employees with no check-in for the (quarter, cycle).

		Returns a list of dicts: user_id, full_name, email, manager_id,
		days_since_window_open. `days_since_window_open` is computed from
		`cycle_configs.window_open`.
		"""
		# Outer join: employees who do NOT have a matching check-in row
		join_cond = and_(
			Checkin.employee_id == User.id,
			Checkin.quarter == quarter,
			Checkin.cycle_id == cycle_id,
			Checkin.is_deleted.is_(False),
		)
		stmt = (
			select(
				User.id,
				User.full_name,
				User.email,
				User.manager_id,
				CycleConfig.window_open.label("cycle_window_open"),
			)
			.select_from(User)
			.outerjoin(Checkin, join_cond)
			.join(CycleConfig, CycleConfig.id == cycle_id)
			.where(User.is_active.is_(True))
			.where(User.is_deleted.is_(False))
			.where(Checkin.id.is_(None))
		)
		result = await self.session.execute(stmt)
		rows = result.all()

		now = datetime.now(timezone.utc)
		out: list[dict[str, Any]] = []
		for row in rows:
			opened = row.cycle_window_open
			if opened is not None:
				if opened.tzinfo is None:
					opened = opened.replace(tzinfo=timezone.utc)
				days = max((now - opened).days, 0)
			else:
				days = 0
			out.append(
				{
					"user_id": row.id,
					"full_name": row.full_name,
					"email": row.email,
					"manager_id": row.manager_id,
					"days_since_window_open": days,
				}
			)
		return out

	async def create_event(
		self,
		checkin_id: UUID,
		event_type: CheckinEventType,
		actor_id: UUID,
		payload: dict[str, Any] | None,
	) -> CheckinEvent:
		"""Append-only event row. Caller owns commit."""
		event = CheckinEvent(
			checkin_id=checkin_id,
			event_type=event_type,
			actor_id=actor_id,
			payload=payload,
		)
		self.session.add(event)
		await self.session.flush()
		return event
