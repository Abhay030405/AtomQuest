from __future__ import annotations

from typing import Any
from uuid import UUID

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalSheetStatus, GoalStatus, Permission, UserRole
from app.core.exceptions import ForbiddenError, GoalCountError, GoalLockedError
from app.events import goal_events as ge
from app.events.event_bus import event_bus
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.shared_goal import SharedGoal
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.repositories.user_repository import UserRepository
from app.services.goal_state_machine import goal_state_machine
from app.services.rbac_service import rbac_service
from app.services.version_service import version_service


class SharedGoalService:
	async def push_to_employees(self, admin: User, data: Any, cycle_id: UUID, db: AsyncSession) -> list[Goal]:
		if not rbac_service.has_permission(admin.role, Permission.PUSH_SHARED_GOAL):
			raise ForbiddenError()

		goal_repo = GoalRepository(db)
		user_repo = UserRepository(db)

		admin_sheet = await goal_repo.get_sheet_for_user(admin.id, cycle_id)
		if admin_sheet is None:
			admin_sheet = await self._create_sheet(admin.id, cycle_id, db)

		master_goal = Goal(
			user_id=admin.id,
			goal_sheet_id=admin_sheet.id,
			title=data.goal_data.title,
			description=data.goal_data.description,
			thrust_area=data.goal_data.thrust_area,
			uom_type=data.goal_data.uom_type,
			target_value=data.goal_data.target_value,
			target_date=data.goal_data.target_date,
			weightage=data.suggested_weightage,
			status=GoalStatus.DRAFT,
			is_shared=True,
			cycle_id=cycle_id,
		)
		db.add(master_goal)
		await db.flush()

		created_goals: list[Goal] = []
		for recipient_id in data.recipient_user_ids:
			recipient = await user_repo.get_active_by_id(recipient_id)
			if recipient is None or recipient.role != UserRole.EMPLOYEE:
				continue
			count = await goal_repo.count_goals_in_cycle(recipient.id, cycle_id)
			if count >= 8:
				raise GoalCountError()

			sheet = await goal_repo.get_sheet_for_user(recipient.id, cycle_id)
			if sheet is None:
				sheet = await self._create_sheet(recipient.id, cycle_id, db)

			goal = Goal(
				user_id=recipient.id,
				goal_sheet_id=sheet.id,
				title=master_goal.title,
				description=master_goal.description,
				thrust_area=master_goal.thrust_area,
				uom_type=master_goal.uom_type,
				target_value=master_goal.target_value,
				target_date=master_goal.target_date,
				weightage=data.suggested_weightage,
				status=GoalStatus.DRAFT,
				is_shared=True,
				source_shared_goal_id=master_goal.id,
				cycle_id=cycle_id,
			)
			db.add(goal)
			await db.flush()

			db.add(
				SharedGoal(
					source_goal_id=master_goal.id,
					recipient_user_id=recipient.id,
					custom_weightage=None,
					pushed_by=admin.id,
				)
			)
			await event_bus.publish(
				ge.SHARED_GOAL_RECEIVED,
				{
					"goal_id": goal.id,
					"recipient_id": recipient.id,
					"source_goal_id": master_goal.id,
					"actor_id": admin.id,
					"actor_role": admin.role,
					"payload": {"source_goal_id": str(master_goal.id)},
				},
				db,
			)
			created_goals.append(goal)

		await event_bus.publish(
			ge.SHARED_GOAL_PUSHED,
			{
				"goal_id": master_goal.id,
				"source_goal_id": master_goal.id,
				"admin_id": admin.id,
				"recipient_ids": [g.user_id for g in created_goals],
				"actor_id": admin.id,
				"actor_role": admin.role,
				"payload": {"recipient_ids": [str(g.user_id) for g in created_goals]},
			},
			db,
		)

		await db.commit()
		return created_goals

	async def unlock_goal(self, goal_id: UUID, admin: User, reason: str, db: AsyncSession) -> Goal:
		if not rbac_service.has_permission(admin.role, Permission.UNLOCK_GOAL):
			raise ForbiddenError()
		goal_repo = GoalRepository(db)
		goal = await goal_repo.get_or_raise(goal_id)
		if goal.status != GoalStatus.LOCKED:
			raise GoalLockedError()

		goal_state_machine.transition(goal, GoalStatus.UNDER_REVIEW, admin)
		await version_service.snapshot_goal(goal, admin, f"Admin unlock: {reason}", db)

		# Load owner name for the notification message (handler does an extra
		# query for the manager lookup, but the owner name we already need here).
		owner = await UserRepository(db).get_active_by_id(goal.user_id) if goal.user_id else None
		owner_name = owner.full_name if owner else ""

		await event_bus.publish(
			ge.GOAL_UNLOCKED,
			{
				"goal_id": goal.id,
				"user_id": goal.user_id,
				"user_name": owner_name,
				"admin_id": admin.id,
				"admin_name": admin.full_name,
				"reason": reason,
				"actor_id": admin.id,
				"actor_role": admin.role,
				"payload": {"reason": reason, "unlocked_by": str(admin.id)},
			},
			db,
		)
		await db.commit()
		await db.refresh(goal)
		return goal

	async def unlock_sheet(self, sheet_id: UUID, admin: User, reason: str, db: AsyncSession) -> GoalSheet:
		"""Admin-only: unlock a previously approved goal sheet and return it to DRAFT
		so the employee can revise their goals mid-cycle. All LOCKED goals are
		transitioned LOCKED → UNDER_REVIEW → DRAFT.
		"""
		if not rbac_service.has_permission(admin.role, Permission.UNLOCK_GOAL):
			raise ForbiddenError()

		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals), selectinload(GoalSheet.owner))
			.where(GoalSheet.id == sheet_id, GoalSheet.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		sheet = result.scalar_one_or_none()
		if sheet is None:
			raise ForbiddenError()
		if sheet.status != GoalSheetStatus.APPROVED:
			raise GoalLockedError()

		for goal in sheet.goals:
			if goal.status != GoalStatus.LOCKED:
				continue
			# LOCKED → UNDER_REVIEW (UNLOCK_GOAL) → DRAFT (RETURN_FOR_REWORK)
			goal_state_machine.transition(goal, GoalStatus.UNDER_REVIEW, admin)
			goal_state_machine.transition(goal, GoalStatus.DRAFT, admin)
			goal.locked_at = None
			goal.locked_by = None
			await version_service.snapshot_goal(goal, admin, f"Admin unlock: {reason}", db)
			await event_bus.publish(
				ge.GOAL_UNLOCKED,
				{
					"goal_id": goal.id,
					"user_id": goal.user_id,
					"user_name": sheet.owner.full_name if sheet.owner else "",
					"admin_id": admin.id,
					"admin_name": admin.full_name,
					"reason": reason,
					"actor_id": admin.id,
					"actor_role": admin.role,
					"payload": {"reason": reason, "unlocked_by": str(admin.id), "goal_sheet_id": str(sheet.id)},
				},
				db,
			)

		sheet.status = GoalSheetStatus.DRAFT
		sheet.approved_at = None
		sheet.approved_by = None
		sheet.returned_count += 1

		await db.commit()
		await db.refresh(sheet)
		return sheet

	async def _create_sheet(self, user_id: UUID, cycle_id: UUID, db: AsyncSession) -> GoalSheet:
		sheet = GoalSheet(user_id=user_id, cycle_id=cycle_id, status=GoalSheetStatus.DRAFT, returned_count=0)
		db.add(sheet)
		await db.flush()
		return sheet


shared_goal_service = SharedGoalService()
