from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_manager, get_db, require_permission
from app.core.constants import Permission
from app.core.exceptions import ForbiddenError, GoalSheetNotFoundError
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.schemas.common import APIResponse, BaseSchema
from app.schemas.goal import GoalResponse, GoalSheetResponse, ManagerGoalEdit
from app.services.approval_service import approval_service


router = APIRouter()


class ReturnReason(BaseSchema):
	reason: str = Field(min_length=20, max_length=500)


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


@router.get("/pending", response_model=APIResponse[list[GoalSheetResponse]])
async def list_pending_approvals(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_manager),
) -> APIResponse[list[GoalSheetResponse]]:
	sheets = await approval_service.get_pending_approvals(current_user, db)
	items = [_build_sheet_response(sheet) for sheet in sheets]
	return APIResponse.ok(items)


@router.get("/{sheet_id}", response_model=APIResponse[GoalSheetResponse])
async def get_approval_sheet(
	sheet_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_manager),
) -> APIResponse[GoalSheetResponse]:
	stmt = (
		select(GoalSheet)
		.options(
			selectinload(GoalSheet.goals).selectinload(Goal.owner),
			selectinload(GoalSheet.goals).selectinload(Goal.locker),
			selectinload(GoalSheet.goals).selectinload(Goal.goal_sheet),
			selectinload(GoalSheet.owner),
			selectinload(GoalSheet.approver),
			selectinload(GoalSheet.cycle),
		)
		.where(GoalSheet.id == sheet_id, GoalSheet.is_deleted.is_(False))
	)
	result = await db.execute(stmt)
	sheet = result.scalar_one_or_none()
	if sheet is None:
		raise GoalSheetNotFoundError()
	if sheet.owner.manager_id != current_user.id:
		raise ForbiddenError()
	return APIResponse.ok(_build_sheet_response(sheet))


@router.post("/{sheet_id}/approve", response_model=APIResponse[GoalSheetResponse])
async def approve_sheet(
	sheet_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.APPROVE_GOAL)),
) -> APIResponse[GoalSheetResponse]:
	sheet = await approval_service.approve_sheet(sheet_id, current_user, db)
	return APIResponse.ok(_build_sheet_response(sheet))


@router.post("/{sheet_id}/return-for-rework", response_model=APIResponse[GoalSheetResponse])
async def return_sheet(
	sheet_id: UUID,
	payload: ReturnReason,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.RETURN_FOR_REWORK)),
) -> APIResponse[GoalSheetResponse]:
	sheet = await approval_service.return_for_rework(sheet_id, current_user, payload.reason, db)
	return APIResponse.ok(_build_sheet_response(sheet))


@router.patch("/{sheet_id}/goals/{goal_id}", response_model=APIResponse[GoalResponse])
async def inline_edit_goal(
	sheet_id: UUID,
	goal_id: UUID,
	payload: ManagerGoalEdit,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.EDIT_GOAL_IN_REVIEW)),
) -> APIResponse[GoalResponse]:
	goal = await approval_service.inline_edit_goal(goal_id, current_user, payload, db)
	return APIResponse.ok(_build_goal_response(goal))
