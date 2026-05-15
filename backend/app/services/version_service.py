from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.goal_version import GoalVersion
from app.models.user import User


class VersionService:
	async def snapshot_goal(
		self,
		goal: Goal,
		changed_by: User,
		change_reason: str | None,
		db: AsyncSession,
	) -> GoalVersion:
		version = GoalVersion(
			goal_id=goal.id,
			version_number=goal.version,
			title=goal.title,
			description=goal.description,
			thrust_area=goal.thrust_area,
			uom_type=goal.uom_type,
			target_value=goal.target_value,
			target_date=goal.target_date,
			weightage=goal.weightage,
			status=goal.status,
			changed_by=changed_by.id,
			change_reason=change_reason,
		)
		db.add(version)
		await db.flush()
		return version

	async def get_versions(self, goal_id: UUID, db: AsyncSession) -> list[GoalVersion]:
		stmt = select(GoalVersion).where(GoalVersion.goal_id == goal_id).order_by(GoalVersion.version_number.asc())
		result = await db.execute(stmt)
		return list(result.scalars().all())

	def get_diff(self, version_a: GoalVersion, version_b: GoalVersion) -> dict[str, dict[str, Any]]:
		fields = [
			"title",
			"description",
			"thrust_area",
			"uom_type",
			"target_value",
			"target_date",
			"weightage",
			"status",
		]
		diff: dict[str, dict[str, Any]] = {}
		for field in fields:
			old_value = getattr(version_a, field)
			new_value = getattr(version_b, field)
			if old_value != new_value:
				diff[field] = {"from": old_value, "to": new_value}
		return diff


version_service = VersionService()
