from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.core.constants import UserRole
from app.core.exceptions import ForbiddenError, GoalNotFoundError
from app.models.goal import Goal
from app.models.goal_version import GoalVersion
from app.schemas.common import APIResponse
from app.schemas.goal import GoalWithVersions
from app.schemas.goal_version import GoalVersionResponse


router = APIRouter()


def _build_goal_response(goal: Goal) -> dict:
	return {
		"id": goal.id,
		"user_id": goal.user_id,
		"goal_sheet_id": goal.goal_sheet_id,
		"cycle_id": goal.cycle_id,
		"title": goal.title,
		"description": goal.description,
		"thrust_area": goal.thrust_area,
		"uom_type": goal.uom_type,
		"target_value": goal.target_value,
		"target_date": goal.target_date,
		"weightage": goal.weightage,
		"status": goal.status,
		"is_shared": goal.is_shared,
		"source_shared_goal_id": goal.source_shared_goal_id,
		"version": goal.version,
		"locked_at": goal.locked_at,
		"locked_by": goal.locked_by,
		"locked_by_name": goal.locker.full_name if getattr(goal, "locker", None) else None,
		"created_at": goal.created_at,
		"updated_at": goal.updated_at,
		"owner_name": goal.owner.full_name if getattr(goal, "owner", None) else None,
		"sheet_status": goal.goal_sheet.status if getattr(goal, "goal_sheet", None) else None,
	}


def _build_version_response(version: GoalVersion) -> GoalVersionResponse:
	return GoalVersionResponse.model_validate(
		{
			"id": version.id,
			"goal_id": version.goal_id,
			"version_number": version.version_number,
			"title": version.title,
			"description": version.description,
			"thrust_area": version.thrust_area,
			"uom_type": version.uom_type,
			"target_value": version.target_value,
			"target_date": version.target_date,
			"weightage": version.weightage,
			"status": version.status,
			"changed_by": version.changed_by,
			"changed_by_name": version.changed_by_user.full_name if getattr(version, "changed_by_user", None) else "",
			"change_reason": version.change_reason,
			"snapshot_at": version.snapshot_at,
		}
	)


@router.get("/{goal_id}/versions", response_model=APIResponse[GoalWithVersions])
async def get_goal_versions(
	goal_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[GoalWithVersions]:
	stmt = (
		select(Goal)
		.options(
			selectinload(Goal.versions).selectinload(GoalVersion.changed_by_user),
			selectinload(Goal.owner),
			selectinload(Goal.goal_sheet),
			selectinload(Goal.locker),
		)
		.where(Goal.id == goal_id, Goal.is_deleted.is_(False))
	)
	result = await db.execute(stmt)
	goal = result.scalar_one_or_none()
	if goal is None:
		raise GoalNotFoundError()
	if current_user.role == UserRole.EMPLOYEE and goal.user_id != current_user.id:
		raise ForbiddenError()
	if current_user.role == UserRole.MANAGER:
		owner = goal.owner
		if owner is None or (owner.manager_id != current_user.id and owner.id != current_user.id):
			raise ForbiddenError()

	versions = [_build_version_response(version) for version in goal.versions]
	data = GoalWithVersions.model_validate({**_build_goal_response(goal), "versions": versions})
	return APIResponse.ok(data)
