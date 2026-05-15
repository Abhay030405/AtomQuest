from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.shared_goal import SharedGoal
from app.repositories.base_repository import BaseRepository


class SharedGoalRepository(BaseRepository[SharedGoal]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, SharedGoal)

	async def get_recipients(self, source_goal_id: UUID) -> list[SharedGoal]:
		stmt = select(SharedGoal).where(SharedGoal.source_goal_id == source_goal_id)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_by_recipient(self, recipient_user_id: UUID, cycle_id: UUID) -> list[SharedGoal]:
		stmt = (
			select(SharedGoal)
			.join(Goal, SharedGoal.source_goal_id == Goal.id)
			.where(SharedGoal.recipient_user_id == recipient_user_id)
			.where(Goal.cycle_id == cycle_id)
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def is_already_pushed(self, source_goal_id: UUID, recipient_user_id: UUID) -> bool:
		stmt = (
			select(SharedGoal)
			.where(SharedGoal.source_goal_id == source_goal_id)
			.where(SharedGoal.recipient_user_id == recipient_user_id)
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none() is not None
