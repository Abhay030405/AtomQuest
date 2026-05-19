from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalStatus, GoalSheetStatus
from app.core.exceptions import GoalNotFoundError
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.base_repository import BaseRepository

_GOAL_OPTS = (selectinload(Goal.owner), selectinload(Goal.locker), selectinload(Goal.goal_sheet))
_SHEET_OPTS = (selectinload(GoalSheet.owner), selectinload(GoalSheet.goals))


class GoalRepository(BaseRepository[Goal]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, Goal, not_found_exception=GoalNotFoundError)

	async def get_by_user_and_cycle(self, user_id: UUID, cycle_id: UUID) -> list[Goal]:
		stmt = (
			select(Goal)
			.options(*_GOAL_OPTS)
			.where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
			.order_by(Goal.created_at.asc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_sheet_for_user(self, user_id: UUID, cycle_id: UUID) -> GoalSheet | None:
		stmt = (
			select(GoalSheet)
			.options(*_SHEET_OPTS)
			.where(GoalSheet.user_id == user_id, GoalSheet.cycle_id == cycle_id)
			.where(GoalSheet.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_pending_approvals(self, manager_id: UUID) -> list[GoalSheet]:
		stmt = (
			select(GoalSheet)
			.options(*_SHEET_OPTS)
			.join(User, GoalSheet.user_id == User.id)
			.where(User.manager_id == manager_id)
			.where(GoalSheet.status.in_([GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW]))
			.where(GoalSheet.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def count_goals_in_cycle(self, user_id: UUID, cycle_id: UUID) -> int:
		stmt = (
			select(func.count())
			.select_from(Goal)
			.where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return int(result.scalar_one())

	async def sum_weightage_in_cycle(self, user_id: UUID, cycle_id: UUID) -> Decimal:
		stmt = (
			select(func.coalesce(func.sum(Goal.weightage), 0))
			.select_from(Goal)
			.where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return Decimal(result.scalar_one())

	async def get_locked_goals(self, employee_id: UUID | None = None) -> list[Goal]:
		stmt = (
			select(Goal)
			.options(*_GOAL_OPTS)
			.where(Goal.status == GoalStatus.LOCKED)
			.where(Goal.is_deleted.is_(False))
		)
		if employee_id:
			stmt = stmt.where(Goal.user_id == employee_id)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_with_versions(self, goal_id: UUID) -> Goal | None:
		stmt = (
			select(Goal)
			.options(*_GOAL_OPTS, selectinload(Goal.versions))
			.where(Goal.id == goal_id)
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_team_goals(self, manager_id: UUID, cycle_id: UUID) -> list[Goal]:
		stmt = (
			select(Goal)
			.options(*_GOAL_OPTS)
			.join(User, Goal.user_id == User.id)
			.where(User.manager_id == manager_id)
			.where(Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_goal_distribution(self, cycle_id: UUID) -> dict[str, list[dict]]:
		"""Count goals grouped by thrust_area, uom_type, and status for the given cycle."""
		async def _count_by(col: object) -> list[dict]:
			stmt = (
				select(col, func.count(Goal.id).label("count"))
				.where(Goal.cycle_id == cycle_id)
				.where(Goal.is_deleted.is_(False))
				.group_by(col)
				.order_by(func.count(Goal.id).desc())
			)
			result = await self.session.execute(stmt)
			return [
				{
					"label": (row[0].value if hasattr(row[0], "value") else str(row[0])),
					"count": int(row[1]),
				}
				for row in result.all()
			]

		return {
			"by_thrust_area": await _count_by(Goal.thrust_area),
			"by_uom_type": await _count_by(Goal.uom_type),
			"by_status": await _count_by(Goal.status),
		}
