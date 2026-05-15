from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
	get_current_active_employee,
	get_current_manager,
	get_current_user,
	get_db,
	get_pagination,
	require_permission,
)
from app.core.constants import Permission, UserRole
from app.core.exceptions import ForbiddenError, GoalNotFoundError
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.common import APIResponse, BaseSchema, PaginatedData
from app.schemas.goal import (
	GoalCreate,
	GoalResponse,
	GoalSheetResponse,
	GoalUpdate,
	ManagerGoalEdit,
	SheetSubmitResponse,
)
from app.services.approval_service import approval_service
from app.services.goal_service import goal_service
from app.utils.pagination import build_pagination_meta


router = APIRouter()


class ReturnReason(BaseSchema):
	reason: str = Field(min_length=10, max_length=500)


def _build_goal_response(goal: Goal, sheet_status_override=None) -> GoalResponse:
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
			"sheet_status": sheet_status_override or (goal.goal_sheet.status if getattr(goal, "goal_sheet", None) else None),
		}
	)


def _build_sheet_response(sheet: GoalSheet) -> GoalSheetResponse:
	goals = [goal for goal in sheet.goals if not goal.is_deleted]
	total_weightage = sum((goal.weightage for goal in goals), Decimal("0"))
	return GoalSheetResponse.model_validate(
		{
			"id": sheet.id,
			"user_id": sheet.user_id,
			"cycle_id": sheet.cycle_id,
			"status": sheet.status,
			"goals": [_build_goal_response(goal, sheet.status) for goal in goals],
			"total_weightage": total_weightage,
			"submitted_at": sheet.submitted_at,
			"approved_at": sheet.approved_at,
			"approved_by_name": sheet.approver.full_name if getattr(sheet, "approver", None) else None,
			"returned_count": sheet.returned_count,
			"cycle_name": sheet.cycle.cycle_name if getattr(sheet, "cycle", None) else None,
			"owner_name": sheet.owner.full_name if getattr(sheet, "owner", None) else None,
		}
	)


@router.post("/", response_model=APIResponse[GoalResponse])
async def create_goal(
	payload: GoalCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.CREATE_GOAL)),
) -> APIResponse[GoalResponse]:
	goal = await goal_service.create_goal(current_user, payload, db)
	return APIResponse.ok(_build_goal_response(goal))


@router.get("/", response_model=APIResponse[PaginatedData[GoalResponse]])
async def list_goals(
	cycle_id: UUID = Query(...),
	user_id: Optional[UUID] = Query(default=None),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[PaginatedData[GoalResponse]]:
	stmt = (
		select(Goal)
		.options(selectinload(Goal.owner), selectinload(Goal.goal_sheet), selectinload(Goal.locker))
		.where(Goal.is_deleted.is_(False))
		.where(Goal.cycle_id == cycle_id)
	)

	if current_user.role == UserRole.EMPLOYEE:
		stmt = stmt.where(Goal.user_id == current_user.id)
	elif current_user.role == UserRole.MANAGER:
		if user_id:
			user_repo = UserRepository(db)
			target = await user_repo.get_or_raise(user_id)
			if target.manager_id != current_user.id and target.id != current_user.id:
				raise ForbiddenError()
			stmt = stmt.where(Goal.user_id == user_id)
		else:
			stmt = stmt.join(User, Goal.user_id == User.id).where(
				or_(User.manager_id == current_user.id, Goal.user_id == current_user.id)
			)
	else:
		if user_id:
			stmt = stmt.where(Goal.user_id == user_id)

	count_stmt = select(func.count()).select_from(stmt.subquery())
	count_result = await db.execute(count_stmt)
	total = int(count_result.scalar_one())

	stmt = stmt.order_by(Goal.created_at.asc()).offset(pagination.skip).limit(pagination.limit)
	result = await db.execute(stmt)
	goals = list(result.scalars().all())
	items = [_build_goal_response(goal) for goal in goals]
	meta = build_pagination_meta(total=total, page=pagination.page, page_size=pagination.page_size)
	return APIResponse.ok(PaginatedData(items=items, meta=meta))


@router.get("/{goal_id}", response_model=APIResponse[GoalResponse])
async def get_goal(
	goal_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[GoalResponse]:
	stmt = (
		select(Goal)
		.options(selectinload(Goal.owner), selectinload(Goal.goal_sheet), selectinload(Goal.locker))
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
	return APIResponse.ok(_build_goal_response(goal))


@router.patch("/{goal_id}", response_model=APIResponse[GoalResponse])
async def update_goal(
	goal_id: UUID,
	payload: GoalUpdate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_active_employee),
) -> APIResponse[GoalResponse]:
	if payload.id != goal_id:
		raise GoalNotFoundError()
	goal = await goal_service.update_goal(goal_id, current_user, payload, db)
	return APIResponse.ok(_build_goal_response(goal))


@router.delete("/{goal_id}", response_model=APIResponse[dict])
async def delete_goal(
	goal_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_active_employee),
) -> APIResponse[dict]:
	await goal_service.delete_goal(goal_id, current_user, db)
	return APIResponse.ok({"message": "Goal deleted"})


@router.get("/sheets/me", response_model=APIResponse[Optional[GoalSheetResponse]])
async def get_my_sheet(
	cycle_id: UUID = Query(...),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[Optional[GoalSheetResponse]]:
	sheet = await goal_service.get_my_sheet(current_user, cycle_id, db)
	if sheet is None:
		return APIResponse.ok(None)
	return APIResponse.ok(_build_sheet_response(sheet))


@router.get("/sheets/{sheet_id}/validate", response_model=APIResponse[dict])
async def validate_sheet(
	sheet_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[dict]:
	validation = await goal_service.validate_sheet(sheet_id, db)
	return APIResponse.ok(
		{
			"is_valid": validation.is_valid,
			"errors": [{"code": err.code, "message": err.message} for err in validation.errors],
		}
	)


@router.post("/sheets/{sheet_id}/submit", response_model=APIResponse[SheetSubmitResponse])
async def submit_sheet(
	sheet_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.SUBMIT_GOAL_SHEET)),
) -> APIResponse[SheetSubmitResponse]:
	sheet = await goal_service.submit_sheet(sheet_id, current_user, db)
	payload = SheetSubmitResponse(
		message="Goal sheet submitted successfully",
		sheet=_build_sheet_response(sheet),
		locked_at=sheet.submitted_at or datetime.now(timezone.utc),
	)
	return APIResponse.ok(payload)


@router.get("/approvals/pending", response_model=APIResponse[list[GoalSheetResponse]])
async def list_pending_approvals(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_manager),
) -> APIResponse[list[GoalSheetResponse]]:
	sheets = await approval_service.get_pending_approvals(current_user, db)
	items = [_build_sheet_response(sheet) for sheet in sheets]
	return APIResponse.ok(items)


@router.post("/approvals/{sheet_id}/approve", response_model=APIResponse[GoalSheetResponse])
async def approve_sheet(
	sheet_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.APPROVE_GOAL)),
) -> APIResponse[GoalSheetResponse]:
	sheet = await approval_service.approve_sheet(sheet_id, current_user, db)
	return APIResponse.ok(_build_sheet_response(sheet))


@router.post("/approvals/{sheet_id}/return", response_model=APIResponse[GoalSheetResponse])
async def return_sheet(
	sheet_id: UUID,
	payload: ReturnReason,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.RETURN_FOR_REWORK)),
) -> APIResponse[GoalSheetResponse]:
	sheet = await approval_service.return_for_rework(sheet_id, current_user, payload.reason, db)
	return APIResponse.ok(_build_sheet_response(sheet))


@router.patch("/approvals/goals/{goal_id}", response_model=APIResponse[GoalResponse])
async def inline_edit_goal(
	goal_id: UUID,
	payload: ManagerGoalEdit,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.EDIT_GOAL_IN_REVIEW)),
) -> APIResponse[GoalResponse]:
	goal = await approval_service.inline_edit_goal(goal_id, current_user, payload, db)
	return APIResponse.ok(_build_goal_response(goal))
