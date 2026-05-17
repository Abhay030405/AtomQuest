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
	source = shared_goal.source_goal if _attr_loaded(shared_goal, "source_goal") else None
	return SharedGoalResponse.model_validate(
		{
			"id": shared_goal.id,
			"source_goal_id": shared_goal.source_goal_id,
			"recipient_user_id": shared_goal.recipient_user_id,
			"recipient_name": shared_goal.recipient.full_name if getattr(shared_goal, "recipient", None) else "",
			"custom_weightage": shared_goal.custom_weightage,
			"pushed_at": shared_goal.pushed_at,
			"pushed_by_name": shared_goal.pusher.full_name if getattr(shared_goal, "pusher", None) else "",
			"source_goal_title": source.title if source else None,
			"source_goal_description": source.description if source else None,
			"source_goal_thrust_area": source.thrust_area if source else None,
			"source_goal_uom_type": source.uom_type if source else None,
			"source_goal_target_value": source.target_value if source else None,
			"source_goal_target_date": source.target_date if source else None,
			"source_goal_weightage": source.weightage if source else None,
		}
	)


def _attr_loaded(obj: object, name: str) -> bool:
	# In async SQLAlchemy, accessing an unloaded relationship triggers lazy
	# IO that raises MissingGreenlet. Only touch attributes already in the
	# instance __dict__ (i.e. loaded via select-in/joined load or set).
	return name in getattr(obj, "__dict__", {})


def _build_goal_response(goal: Goal) -> GoalResponse:
	owner = goal.owner if _attr_loaded(goal, "owner") else None
	sheet = goal.goal_sheet if _attr_loaded(goal, "goal_sheet") else None
	locker = goal.locker if _attr_loaded(goal, "locker") else None
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
			"locked_by_name": locker.full_name if locker else None,
			"created_at": goal.created_at,
			"updated_at": goal.updated_at,
			"owner_name": owner.full_name if owner else None,
			"sheet_status": sheet.status if sheet else None,
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


@router.get("/pushed", response_model=APIResponse[list[SharedGoalResponse]])
async def list_pushed_shared_goals(
	cycle_id: UUID = Query(...),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.PUSH_SHARED_GOAL)),
) -> APIResponse[list[SharedGoalResponse]]:
	stmt = (
		select(SharedGoal)
		.options(
			selectinload(SharedGoal.recipient),
			selectinload(SharedGoal.pusher),
			selectinload(SharedGoal.source_goal),
		)
		.join(Goal, SharedGoal.source_goal_id == Goal.id)
		.where(SharedGoal.pushed_by == current_user.id)
		.where(Goal.cycle_id == cycle_id)
		.order_by(SharedGoal.pushed_at.desc())
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
