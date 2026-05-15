from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
	EMPLOYEE = "employee"
	MANAGER = "manager"
	ADMIN = "admin"


class GoalStatus(str, Enum):
	DRAFT = "draft"
	SUBMITTED = "submitted"
	UNDER_REVIEW = "under_review"
	APPROVED = "approved"
	LOCKED = "locked"
	ARCHIVED = "archived"


class UoMType(str, Enum):
	MIN = "min"
	MAX = "max"
	TIMELINE = "timeline"
	ZERO = "zero"


class ThrustArea(str, Enum):
	REVENUE_GROWTH = "revenue_growth"
	CUSTOMER_SATISFACTION = "customer_satisfaction"
	OPERATIONAL_EXCELLENCE = "operational_excellence"
	PEOPLE_DEVELOPMENT = "people_development"
	SAFETY_COMPLIANCE = "safety_compliance"
	INNOVATION = "innovation"
	COST_OPTIMISATION = "cost_optimisation"
	QUALITY = "quality"


class GoalSheetStatus(str, Enum):
	DRAFT = "draft"
	SUBMITTED = "submitted"
	APPROVED = "approved"


class CyclePhase(str, Enum):
	GOAL_SETTING = "goal_setting"
	Q1 = "q1"
	Q2 = "q2"
	Q3 = "q3"
	Q4 = "q4"


class AuditAction(str, Enum):
	INSERT = "insert"
	UPDATE = "update"
	DELETE = "delete"


class GoalEventType(str, Enum):
	GOAL_CREATED = "goal_created"
	GOAL_SUBMITTED = "goal_submitted"
	GOAL_RETURNED_FOR_REWORK = "goal_returned_for_rework"
	GOAL_APPROVED = "goal_approved"
	GOAL_LOCKED = "goal_locked"
	GOAL_UNLOCKED = "goal_unlocked"
	TARGET_EDITED_BY_MANAGER = "target_edited_by_manager"
	WEIGHTAGE_EDITED_BY_MANAGER = "weightage_edited_by_manager"
	SHARED_GOAL_PUSHED = "shared_goal_pushed"
	SHARED_GOAL_RECEIVED = "shared_goal_received"


class Permission(str, Enum):
	CREATE_GOAL = "create_goal"
	SUBMIT_GOAL_SHEET = "submit_goal_sheet"
	EDIT_OWN_DRAFT_GOAL = "edit_own_draft_goal"
	VIEW_OWN_GOALS = "view_own_goals"
	VIEW_TEAM_GOALS = "view_team_goals"
	APPROVE_GOAL = "approve_goal"
	REJECT_GOAL = "reject_goal"
	EDIT_GOAL_IN_REVIEW = "edit_goal_in_review"
	RETURN_FOR_REWORK = "return_for_rework"
	PUSH_SHARED_GOAL = "push_shared_goal"
	UNLOCK_GOAL = "unlock_goal"
	CONFIGURE_CYCLE = "configure_cycle"
	VIEW_ALL_GOALS = "view_all_goals"
	EXPORT_REPORTS = "export_reports"
	VIEW_AUDIT_LOG = "view_audit_log"


class NotificationType(str, Enum):
	GOAL_SUBMITTED = "goal_submitted"
	GOAL_APPROVED = "goal_approved"
	GOAL_RETURNED = "goal_returned"
	GOAL_UNLOCKED = "goal_unlocked"
	SHARED_GOAL_RECEIVED = "shared_goal_received"
	CHECKIN_COMPLETED = "checkin_completed"
	WINDOW_OPENING = "window_opening"


RBAC_MATRIX = {
	UserRole.EMPLOYEE: [
		Permission.CREATE_GOAL,
		Permission.SUBMIT_GOAL_SHEET,
		Permission.EDIT_OWN_DRAFT_GOAL,
		Permission.VIEW_OWN_GOALS,
	],
	UserRole.MANAGER: [
		Permission.VIEW_OWN_GOALS,
		Permission.VIEW_TEAM_GOALS,
		Permission.APPROVE_GOAL,
		Permission.REJECT_GOAL,
		Permission.EDIT_GOAL_IN_REVIEW,
		Permission.RETURN_FOR_REWORK,
	],
	UserRole.ADMIN: list(Permission),
}
