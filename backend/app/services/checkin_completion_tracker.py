"""CheckinCompletionTracker — Specification pattern (Build plan §6.4).

Single source of truth for "who has done what" — used by:

  * the manager check-in dashboard,
  * the overdue endpoint,
  * the future Escalation engine (Good-to-Have feature #2).

Do not duplicate this logic in services, schedulers, or notification handlers.
Every consumer should ask the tracker; the tracker queries the live tables.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AchievementStatus, Quarter
from app.repositories.achievement_repository import AchievementRepository
from app.repositories.checkin_repository import CheckinRepository
from app.repositories.user_repository import UserRepository


@dataclass(frozen=True)
class OverdueUser:
	"""Flat row returned by the tracker for downstream consumers."""

	user_id: UUID
	full_name: str
	email: str
	manager_id: UUID | None
	days_since_window_open: int


class CheckinCompletionTracker:
	"""Stateless. All methods take an ``AsyncSession`` and a domain key."""

	# ------------------------------------------------------------------
	# Per-user predicates
	# ------------------------------------------------------------------

	async def has_submitted_achievement(
		self,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> bool:
		"""True iff the employee has at least one non-NOT_STARTED achievement
		row for the (quarter, cycle). Mirrors the snapshot's
		``achievement_submitted`` flag."""
		repo = AchievementRepository(db)
		rows = await repo.get_by_user_quarter(employee_id, quarter, cycle_id)
		return any(a.status != AchievementStatus.NOT_STARTED for a in rows)

	async def has_checkin(
		self,
		manager_id: UUID,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> bool:
		"""True iff this manager has logged a check-in for this employee in
		the (quarter, cycle)."""
		repo = CheckinRepository(db)
		row = await repo.get_by_manager_employee_quarter(
			manager_id, employee_id, quarter, cycle_id
		)
		return row is not None

	async def is_overdue(
		self,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> bool:
		"""An employee is *overdue* when no manager has filed a check-in for
		them in this (quarter, cycle). The (manager_id, employee_id,
		quarter, cycle_id) uniqueness guarantees at most one row per pairing,
		so 'no check-in by my manager' is sufficient.

		If the employee has no manager (admin/orphan), they cannot be overdue.
		"""
		user_repo = UserRepository(db)
		employee = await user_repo.get(employee_id)
		if employee is None or employee.manager_id is None:
			return False
		return not await self.has_checkin(
			employee.manager_id, employee_id, quarter, cycle_id, db
		)

	# ------------------------------------------------------------------
	# Aggregate queries
	# ------------------------------------------------------------------

	async def get_overdue_users(
		self,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> list[OverdueUser]:
		"""Every active employee with no check-in for the (quarter, cycle).

		The heavy SQL — outer-join users → checkins — lives in
		``CheckinRepository.get_overdue``; this method just maps the raw rows
		into a stable dataclass for callers.
		"""
		repo = CheckinRepository(db)
		raw: list[dict[str, Any]] = await repo.get_overdue(quarter, cycle_id)
		return [
			OverdueUser(
				user_id=row["user_id"],
				full_name=row["full_name"],
				email=row["email"],
				manager_id=row["manager_id"],
				days_since_window_open=row["days_since_window_open"],
			)
			for row in raw
		]


checkin_completion_tracker = CheckinCompletionTracker()


__all__ = [
	"CheckinCompletionTracker",
	"OverdueUser",
	"checkin_completion_tracker",
]
