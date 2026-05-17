from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalSheetStatus, GoalStatus, UserRole
from app.core.exceptions import ForbiddenError, WeightageError
from app.events import goal_events as ge
from app.events.event_bus import event_bus
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.services.goal_state_machine import goal_state_machine
from app.services.version_service import version_service


class ApprovalService:
	async def get_pending_approvals(self, manager: User, db: AsyncSession) -> list[GoalSheet]:
		stmt = (
			select(GoalSheet)
			.join(User, GoalSheet.user_id == User.id)
			.options(
				selectinload(GoalSheet.goals),
				selectinload(GoalSheet.owner),
				selectinload(GoalSheet.approver),
				selectinload(GoalSheet.cycle),
			)
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
		# Managers may only act on their own reports; admins act org-wide.
		if sheet.owner.manager_id != manager.id and manager.role != UserRole.ADMIN:
			raise ForbiddenError()

		for goal in sheet.goals:
			# Skip goals that are already locked (e.g., from a prior approval cycle
			# when the employee added new drafts and re-submitted the sheet).
			if goal.status == GoalStatus.LOCKED:
				continue
			goal_state_machine.transition(goal, GoalStatus.APPROVED, manager)
			goal_state_machine.transition(goal, GoalStatus.LOCKED, manager)
			await version_service.snapshot_goal(goal, manager, "Approved and locked by manager", db)
			await event_bus.publish(
				ge.GOAL_APPROVED,
				{
					"goal_id": goal.id,
					"goal_sheet_id": sheet.id,
					"employee_id": sheet.owner.id,
					"employee_name": sheet.owner.full_name,
					"manager_id": manager.id,
					"manager_name": manager.full_name,
					"actor_id": manager.id,
					"actor_role": manager.role,
					"payload": None,
				},
				db,
			)
			await event_bus.publish(
				ge.GOAL_LOCKED,
				{
					"goal_id": goal.id,
					"user_id": sheet.owner.id,
					"locked_by": manager.id,
					"actor_id": manager.id,
					"actor_role": manager.role,
					"payload": None,
				},
				db,
			)

		sheet.status = GoalSheetStatus.APPROVED
		sheet.approved_at = datetime.now(timezone.utc)
		sheet.approved_by = manager.id
		await event_bus.publish(
			ge.GOAL_SHEET_APPROVED,
			{
				"goal_sheet_id": sheet.id,
				"employee_id": sheet.owner.id,
				"employee_name": sheet.owner.full_name,
				"manager_id": manager.id,
				"manager_name": manager.full_name,
				"actor_id": manager.id,
				"actor_role": manager.role,
			},
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
		# Managers may only act on their own reports; admins act org-wide.
		if sheet.owner.manager_id != manager.id and manager.role != UserRole.ADMIN:
			raise ForbiddenError()

		for goal in sheet.goals:
			# Skip locked goals (already approved in a previous submission). Only
			# the freshly-submitted goals should be returned to draft.
			if goal.status == GoalStatus.LOCKED:
				continue
			goal_state_machine.transition(goal, GoalStatus.DRAFT, manager)
			await version_service.snapshot_goal(goal, manager, reason, db)
			await event_bus.publish(
				ge.GOAL_RETURNED_FOR_REWORK,
				{
					"goal_id": goal.id,
					"goal_sheet_id": sheet.id,
					"employee_id": sheet.owner.id,
					"employee_name": sheet.owner.full_name,
					"manager_id": manager.id,
					"reason": reason,
					"actor_id": manager.id,
					"actor_role": manager.role,
					"payload": {"reason": reason},
				},
				db,
			)

		sheet.status = GoalSheetStatus.DRAFT
		sheet.returned_count += 1
		await event_bus.publish(
			ge.GOAL_SHEET_RETURNED,
			{
				"goal_sheet_id": sheet.id,
				"employee_id": sheet.owner.id,
				"employee_name": sheet.owner.full_name,
				"manager_id": manager.id,
				"reason": reason,
				"actor_id": manager.id,
				"actor_role": manager.role,
			},
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
		# Managers may only act on their own reports; admins act org-wide.
		if goal.owner.manager_id != manager.id and manager.role != UserRole.ADMIN:
			raise ForbiddenError()

		old_snapshot = goal.to_dict()
		if data.target_value is not None:
			goal.target_value = data.target_value
		if data.target_date is not None:
			goal.target_date = data.target_date
		if data.weightage is not None:
			goal.weightage = data.weightage
		goal.version += 1

		# Capture new snapshot BEFORE snapshot_goal() flushes the session, otherwise
		# server-managed columns (updated_at) get expired and a later getattr would
		# trigger a sync lazy-load inside the async session (MissingGreenlet).
		new_snapshot = goal.to_dict()
		await version_service.snapshot_goal(goal, manager, data.change_reason, db)

		weightage_changed = old_snapshot.get("weightage") != goal.weightage
		event_name = ge.WEIGHTAGE_EDITED_BY_MANAGER if weightage_changed else ge.TARGET_EDITED_BY_MANAGER
		await event_bus.publish(
			event_name,
			{
				"goal_id": goal.id,
				"old_snapshot": old_snapshot,
				"new_snapshot": new_snapshot,
				"manager_id": manager.id,
				"reason": data.change_reason,
				"actor_id": manager.id,
				"actor_role": manager.role,
				"payload": {"reason": data.change_reason},
			},
			db,
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
