from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import GoalEventType, GoalStatus, NotificationType, Permission, UserRole
from app.core.exceptions import ForbiddenError, GoalCountError, GoalLockedError
from app.models.goal import Goal
from app.models.goal_event import GoalEvent
from app.models.shared_goal import SharedGoal
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.repositories.shared_goal_repository import SharedGoalRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import audit_service
from app.services.goal_state_machine import goal_state_machine
from app.services.notification_service import notification_service
from app.services.rbac_service import rbac_service
from app.services.version_service import version_service


class SharedGoalService:
	async def push_to_employees(self, admin: User, data: Any, cycle_id: UUID, db: AsyncSession) -> list[Goal]:
		if not rbac_service.has_permission(admin.role, Permission.PUSH_SHARED_GOAL):
			raise ForbiddenError()

		goal_repo = GoalRepository(db)
		user_repo = UserRepository(db)
		shared_repo = SharedGoalRepository(db)

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
			db.add(
				GoalEvent(
					goal_id=goal.id,
					event_type=GoalEventType.SHARED_GOAL_RECEIVED,
					actor_id=admin.id,
					payload=None,
				)
			)

			await notification_service.create_in_app(
				recipient.id,
				NotificationType.SHARED_GOAL_RECEIVED,
				"Shared KPI added",
				"A shared departmental KPI has been added to your goal sheet.",
				db,
				related_goal_id=goal.id,
			)
			created_goals.append(goal)

		db.add(
			GoalEvent(
				goal_id=master_goal.id,
				event_type=GoalEventType.SHARED_GOAL_PUSHED,
				actor_id=admin.id,
				payload={"recipient_ids": [g.user_id for g in created_goals]},
			)
		)

		await audit_service.log_create("goals", master_goal.id, admin, db)
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
		db.add(
			GoalEvent(
				goal_id=goal.id,
				event_type=GoalEventType.GOAL_UNLOCKED,
				actor_id=admin.id,
				payload={"reason": reason, "unlocked_by": str(admin.id)},
			)
		)
		await audit_service.log_update("goals", goal.id, admin, "status", "locked", "under_review", db)
		if goal.user_id:
			await notification_service.create_in_app(
				goal.user_id,
				NotificationType.GOAL_UNLOCKED,
				"Goal unlocked",
				f"Your goal was unlocked by {admin.full_name}: {reason}",
				db,
				related_goal_id=goal.id,
			)
		await notification_service.create_in_app(
			admin.id,
			NotificationType.GOAL_UNLOCKED,
			"Goal unlocked",
			f"You unlocked goal {goal.title}",
			db,
			related_goal_id=goal.id,
		)
		await db.commit()
		await db.refresh(goal)
		return goal

	async def _create_sheet(self, user_id: UUID, cycle_id: UUID, db: AsyncSession):
		from app.models.goal_sheet import GoalSheet
		from app.core.constants import GoalSheetStatus

		sheet = GoalSheet(user_id=user_id, cycle_id=cycle_id, status=GoalSheetStatus.DRAFT, returned_count=0)
		db.add(sheet)
		await db.flush()
		return sheet


shared_goal_service = SharedGoalService()
