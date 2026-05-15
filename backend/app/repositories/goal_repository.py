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


class GoalRepository(BaseRepository[Goal]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, Goal, not_found_exception=GoalNotFoundError)

	async def get_by_user_and_cycle(self, user_id: UUID, cycle_id: UUID) -> list[Goal]:
		stmt = (
			select(Goal)
			.where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
			.order_by(Goal.created_at.asc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_sheet_for_user(self, user_id: UUID, cycle_id: UUID) -> GoalSheet | None:
		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals))
			.where(GoalSheet.user_id == user_id, GoalSheet.cycle_id == cycle_id)
			.where(GoalSheet.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_pending_approvals(self, manager_id: UUID) -> list[GoalSheet]:
		stmt = (
			select(GoalSheet)
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
		stmt = select(Goal).where(Goal.status == GoalStatus.LOCKED).where(Goal.is_deleted.is_(False))
		if employee_id:
			stmt = stmt.where(Goal.user_id == employee_id)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_with_versions(self, goal_id: UUID) -> Goal | None:
		stmt = select(Goal).options(selectinload(Goal.versions)).where(Goal.id == goal_id)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_team_goals(self, manager_id: UUID, cycle_id: UUID) -> list[Goal]:
		stmt = (
			select(Goal)
			.join(User, Goal.user_id == User.id)
			.where(User.manager_id == manager_id)
			.where(Goal.cycle_id == cycle_id)
			.where(Goal.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())
