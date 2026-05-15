from __future__ import annotations

from datetime import datetime, timezone

from app.core.constants import GoalStatus, Permission, UserRole
from app.core.exceptions import ForbiddenError, InvalidStateTransitionError
from app.models.goal import Goal
from app.models.user import User
from app.services.rbac_service import rbac_service


class GoalStateMachine:
	ALLOWED_TRANSITIONS = {
		GoalStatus.DRAFT: [GoalStatus.SUBMITTED],
		GoalStatus.SUBMITTED: [GoalStatus.UNDER_REVIEW, GoalStatus.DRAFT],
		GoalStatus.UNDER_REVIEW: [GoalStatus.APPROVED, GoalStatus.DRAFT],
		GoalStatus.APPROVED: [GoalStatus.LOCKED],
		GoalStatus.LOCKED: [GoalStatus.UNDER_REVIEW],
		GoalStatus.ARCHIVED: [],
	}

	ACTOR_PERMISSIONS: dict[tuple[GoalStatus, GoalStatus], list[Permission] | None] = {
		(GoalStatus.DRAFT, GoalStatus.SUBMITTED): [Permission.SUBMIT_GOAL_SHEET],
		(GoalStatus.SUBMITTED, GoalStatus.UNDER_REVIEW): [Permission.APPROVE_GOAL, Permission.REJECT_GOAL],
		(GoalStatus.SUBMITTED, GoalStatus.DRAFT): [Permission.RETURN_FOR_REWORK],
		(GoalStatus.UNDER_REVIEW, GoalStatus.APPROVED): [Permission.APPROVE_GOAL],
		(GoalStatus.UNDER_REVIEW, GoalStatus.DRAFT): [Permission.RETURN_FOR_REWORK],
		(GoalStatus.APPROVED, GoalStatus.LOCKED): None,
		(GoalStatus.LOCKED, GoalStatus.UNDER_REVIEW): [Permission.UNLOCK_GOAL],
	}

	def can_transition(self, current_status: GoalStatus, target_status: GoalStatus) -> bool:
		return target_status in self.ALLOWED_TRANSITIONS.get(current_status, [])

	def transition(self, goal: Goal, target_status: GoalStatus, actor: User) -> Goal:
		if not self.can_transition(goal.status, target_status):
			raise InvalidStateTransitionError(goal.status.value, target_status.value)

		permissions = self.ACTOR_PERMISSIONS.get((goal.status, target_status))
		if permissions:
			if not any(rbac_service.has_permission(actor.role, perm) for perm in permissions):
				raise ForbiddenError()

		goal.status = target_status
		if target_status == GoalStatus.LOCKED:
			goal.locked_at = datetime.now(timezone.utc)
			goal.locked_by = actor.id
		goal.version += 1
		return goal


goal_state_machine = GoalStateMachine()
