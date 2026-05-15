from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalEventType, GoalSheetStatus, GoalStatus, NotificationType
from app.core.exceptions import ForbiddenError, WeightageError
from app.models.goal import Goal
from app.models.goal_event import GoalEvent
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.services.audit_service import audit_service
from app.services.goal_state_machine import goal_state_machine
from app.services.notification_service import notification_service
from app.services.version_service import version_service


class ApprovalService:
	async def get_pending_approvals(self, manager: User, db: AsyncSession) -> list[GoalSheet]:
		stmt = (
			select(GoalSheet)
			.join(User, GoalSheet.user_id == User.id)
			.options(selectinload(GoalSheet.goals))
			.where(User.manager_id == manager.id)
			.where(GoalSheet.status.in_([GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW]))
			.where(GoalSheet.is_deleted.is_(False))
			.order_by(GoalSheet.submitted_at.asc())
		)
		result = await db.execute(stmt)
		return list(result.scalars().all())

	async def approve_sheet(self, sheet_id: UUID, manager: User, db: AsyncSession) -> GoalSheet:
		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals), selectinload(GoalSheet.owner))
			.where(GoalSheet.id == sheet_id, GoalSheet.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		sheet = result.scalar_one_or_none()
		if sheet is None:
			raise ForbiddenError()
		if sheet.status not in {GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW}:
			raise ForbiddenError()
		if sheet.owner.manager_id != manager.id:
			raise ForbiddenError()

		for goal in sheet.goals:
			goal_state_machine.transition(goal, GoalStatus.APPROVED, manager)
			goal_state_machine.transition(goal, GoalStatus.LOCKED, manager)
			await version_service.snapshot_goal(goal, manager, "Approved and locked by manager", db)
			db.add(
				GoalEvent(
					goal_id=goal.id,
					event_type=GoalEventType.GOAL_APPROVED,
					actor_id=manager.id,
					payload=None,
				)
			)
			db.add(
				GoalEvent(
					goal_id=goal.id,
					event_type=GoalEventType.GOAL_LOCKED,
					actor_id=manager.id,
					payload=None,
				)
			)
			await audit_service.log_update("goals", goal.id, manager, "status", "submitted", "locked", db)

		sheet.status = GoalSheetStatus.APPROVED
		sheet.approved_at = datetime.now(timezone.utc)
		sheet.approved_by = manager.id
		await audit_service.log_update("goal_sheets", sheet.id, manager, "status", "submitted", "approved", db)

		await notification_service.create_in_app(
			sheet.user_id,
			NotificationType.GOAL_APPROVED,
			"Goal sheet approved",
			f"Your goal sheet has been approved by {manager.full_name}. All goals are now locked.",
			db,
		)

		await db.commit()
		await db.refresh(sheet)
		return sheet

	async def return_for_rework(self, sheet_id: UUID, manager: User, reason: str, db: AsyncSession) -> GoalSheet:
		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals), selectinload(GoalSheet.owner))
			.where(GoalSheet.id == sheet_id, GoalSheet.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		sheet = result.scalar_one_or_none()
		if sheet is None:
			raise ForbiddenError()
		if sheet.status not in {GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW}:
			raise ForbiddenError()
		if sheet.owner.manager_id != manager.id:
			raise ForbiddenError()

		for goal in sheet.goals:
			goal_state_machine.transition(goal, GoalStatus.DRAFT, manager)
			await version_service.snapshot_goal(goal, manager, reason, db)
			db.add(
				GoalEvent(
					goal_id=goal.id,
					event_type=GoalEventType.GOAL_RETURNED_FOR_REWORK,
					actor_id=manager.id,
					payload={"reason": reason},
				)
			)

		sheet.status = GoalSheetStatus.DRAFT
		sheet.returned_count += 1
		await notification_service.create_in_app(
			sheet.user_id,
			NotificationType.GOAL_RETURNED,
			"Goal sheet returned for rework",
			reason,
			db,
		)

		await db.commit()
		await db.refresh(sheet)
		return sheet

	async def inline_edit_goal(self, goal_id: UUID, manager: User, data: Any, db: AsyncSession) -> Goal:
		stmt = (
			select(Goal)
			.options(selectinload(Goal.owner))
			.where(Goal.id == goal_id, Goal.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		goal = result.scalar_one_or_none()
		if goal is None:
			raise ForbiddenError()
		if goal.status not in {GoalStatus.SUBMITTED, GoalStatus.UNDER_REVIEW}:
			raise ForbiddenError()
		if goal.owner.manager_id != manager.id:
			raise ForbiddenError()

		old_snapshot = goal.to_dict()
		if data.target_value is not None:
			goal.target_value = data.target_value
		if data.target_date is not None:
			goal.target_date = data.target_date
		if data.weightage is not None:
			goal.weightage = data.weightage
		goal.version += 1

		await version_service.snapshot_goal(goal, manager, data.change_reason, db)
		await audit_service.log_goal_changes(old_snapshot, goal, manager, db)

		event_type = (
			GoalEventType.WEIGHTAGE_EDITED_BY_MANAGER
			if old_snapshot.get("weightage") != goal.weightage
			else GoalEventType.TARGET_EDITED_BY_MANAGER
		)
		db.add(
			GoalEvent(
				goal_id=goal.id,
				event_type=event_type,
				actor_id=manager.id,
				payload={"reason": data.change_reason},
			)
		)

		sheet_stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals))
			.where(GoalSheet.id == goal.goal_sheet_id)
		)
		sheet_result = await db.execute(sheet_stmt)
		sheet = sheet_result.scalar_one_or_none()
		if sheet:
			total_weightage = sum((g.weightage for g in sheet.goals if not g.is_deleted), Decimal("0"))
			if total_weightage.quantize(Decimal("0.01")) != Decimal("100.00"):
				raise WeightageError()

		await db.commit()
		await db.refresh(goal)
		return goal


approval_service = ApprovalService()
