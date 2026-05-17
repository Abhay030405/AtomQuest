from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.core.constants import Quarter
from app.models.achievement import Achievement
from app.models.achievement_version import AchievementVersion
from app.models.goal import Goal
from app.repositories.base_repository import BaseRepository


class AchievementRepository(BaseRepository[Achievement]):
	"""Data-access for achievements and their version history.

	Phase 2 data layer. No business logic, no event firing, no scoring.
	Callers own the transaction — methods flush but never commit.
	"""

	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, Achievement)

	async def get_by_goal_and_quarter(
		self, goal_id: UUID, quarter: Quarter
	) -> Achievement | None:
		"""Single-row lookup by the UNIQUE(goal_id, quarter) key."""
		stmt = (
			select(Achievement)
			.where(Achievement.goal_id == goal_id)
			.where(Achievement.quarter == quarter)
			.where(Achievement.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_by_user_quarter(
		self, user_id: UUID, quarter: Quarter, cycle_id: UUID
	) -> list[Achievement]:
		"""All achievements for an employee in a given quarter + cycle."""
		stmt = (
			select(Achievement)
			.join(Goal, Achievement.goal_id == Goal.id)
			.where(Goal.user_id == user_id)
			.where(Goal.cycle_id == cycle_id)
			.where(Achievement.quarter == quarter)
			.where(Achievement.is_deleted.is_(False))
			.where(Goal.is_deleted.is_(False))
			.order_by(Goal.id.asc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_user_history(self, user_id: UUID) -> list[Achievement]:
		"""Full achievement history across all quarters and cycles for a user."""
		stmt = (
			select(Achievement)
			.join(Goal, Achievement.goal_id == Goal.id)
			.where(Goal.user_id == user_id)
			.where(Achievement.is_deleted.is_(False))
			.where(Goal.is_deleted.is_(False))
			.order_by(Achievement.quarter.asc(), Achievement.goal_id.asc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def upsert(
		self, goal_id: UUID, quarter: Quarter, data: dict[str, Any]
	) -> Achievement:
		"""Upsert keyed on UNIQUE(goal_id, quarter).

		Does NOT commit; caller owns the transaction. Versioning is the
		caller's responsibility (call `create_version` before updating to
		snapshot the prior state).
		"""
		existing = await self.get_by_goal_and_quarter(goal_id, quarter)
		if existing is None:
			payload = dict(data)
			payload["goal_id"] = goal_id
			payload["quarter"] = quarter
			instance = Achievement(**payload)
			self.session.add(instance)
			await self.session.flush()
			return instance
		for key, value in data.items():
			setattr(existing, key, value)
		await self.session.flush()
		return existing

	async def create_version(
		self, achievement_id: UUID, snapshot_data: dict[str, Any]
	) -> AchievementVersion:
		"""Append an immutable snapshot.

		The next `version_number` is computed as MAX + 1 inside the same
		transaction. Caller owns the commit.
		"""
		max_stmt = select(func.max(AchievementVersion.version_number)).where(
			AchievementVersion.achievement_id == achievement_id
		)
		result = await self.session.execute(max_stmt)
		current_max = result.scalar_one_or_none() or 0

		payload = dict(snapshot_data)
		payload["achievement_id"] = achievement_id
		payload["version_number"] = current_max + 1
		version = AchievementVersion(**payload)
		self.session.add(version)
		await self.session.flush()
		return version

	async def get_versions(self, achievement_id: UUID) -> list[AchievementVersion]:
		"""All snapshots for an achievement in chronological order."""
		stmt = (
			select(AchievementVersion)
			.where(AchievementVersion.achievement_id == achievement_id)
			.where(AchievementVersion.is_deleted.is_(False))
			.order_by(AchievementVersion.version_number.asc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())
