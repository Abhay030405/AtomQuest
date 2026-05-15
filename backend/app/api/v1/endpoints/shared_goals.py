from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_permission
from app.core.constants import Permission, UserRole
from app.core.exceptions import CycleNotFoundError, ForbiddenError
from app.models.goal import Goal
from app.models.shared_goal import SharedGoal
from app.schemas.common import APIResponse
from app.schemas.goal import GoalResponse
from app.schemas.shared_goal import SharedGoalPush, SharedGoalResponse
from app.services.cycle_service import cycle_service
from app.services.shared_goal_service import shared_goal_service


router = APIRouter()


def _build_shared_goal_response(shared_goal: SharedGoal) -> SharedGoalResponse:
	return SharedGoalResponse.model_validate(
		{
			"id": shared_goal.id,
			"source_goal_id": shared_goal.source_goal_id,
			"recipient_user_id": shared_goal.recipient_user_id,
			"recipient_name": shared_goal.recipient.full_name if getattr(shared_goal, "recipient", None) else "",
			"custom_weightage": shared_goal.custom_weightage,
			"pushed_at": shared_goal.pushed_at,
			"pushed_by_name": shared_goal.pusher.full_name if getattr(shared_goal, "pusher", None) else "",
		}
	)


def _build_goal_response(goal: Goal) -> GoalResponse:
	return GoalResponse.model_validate(
		{
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
	)


@router.post("/push", response_model=APIResponse[list[GoalResponse]])
async def push_shared_goals(
	payload: SharedGoalPush,
	cycle_id: Optional[UUID] = Query(default=None),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.PUSH_SHARED_GOAL)),
) -> APIResponse[list[GoalResponse]]:
	if cycle_id is None:
		cycle = await cycle_service.get_active_window(db)
		if cycle is None:
			raise CycleNotFoundError()
		cycle_id = cycle.id

	goals = await shared_goal_service.push_to_employees(current_user, payload, cycle_id, db)
	items = [_build_goal_response(goal) for goal in goals]
	return APIResponse.ok(items)


@router.get("/received", response_model=APIResponse[list[SharedGoalResponse]])
async def list_received_shared_goals(
	cycle_id: UUID = Query(...),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[list[SharedGoalResponse]]:
	stmt = (
		select(SharedGoal)
		.options(selectinload(SharedGoal.recipient), selectinload(SharedGoal.pusher))
		.join(Goal, SharedGoal.source_goal_id == Goal.id)
		.where(SharedGoal.recipient_user_id == current_user.id)
		.where(Goal.cycle_id == cycle_id)
	)
	result = await db.execute(stmt)
	shared_goals = list(result.scalars().all())
	items = [_build_shared_goal_response(item) for item in shared_goals]
	return APIResponse.ok(items)


@router.get("/{source_goal_id}/recipients", response_model=APIResponse[list[SharedGoalResponse]])
async def list_shared_goal_recipients(
	source_goal_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[list[SharedGoalResponse]]:
	if current_user.role != UserRole.ADMIN:
		raise ForbiddenError()
	stmt = (
		select(SharedGoal)
		.options(selectinload(SharedGoal.recipient), selectinload(SharedGoal.pusher))
		.where(SharedGoal.source_goal_id == source_goal_id)
	)
	result = await db.execute(stmt)
	shared_goals = list(result.scalars().all())
	items = [_build_shared_goal_response(item) for item in shared_goals]
	return APIResponse.ok(items)
