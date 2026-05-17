from __future__ import annotations

from datetime import datetime
from typing import TypedDict
from uuid import UUID

from app.core.constants import GoalEventType


# ---------------------------------------------------------------------------
# Event-name constants
# ---------------------------------------------------------------------------
# All event names are lowercase strings. Names that map to a row in the
# ``goal_events`` table re-use ``GoalEventType`` values directly (the DB enum
# already enforces them). Names without a GoalEventType counterpart are
# cross-cutting events that only audit/notification handlers care about.

# Backed by GoalEventType (will be persisted by goal_event_handler):
GOAL_CREATED = GoalEventType.GOAL_CREATED.value
GOAL_SUBMITTED = GoalEventType.GOAL_SUBMITTED.value
GOAL_APPROVED = GoalEventType.GOAL_APPROVED.value
GOAL_LOCKED = GoalEventType.GOAL_LOCKED.value
GOAL_RETURNED_FOR_REWORK = GoalEventType.GOAL_RETURNED_FOR_REWORK.value
GOAL_UNLOCKED = GoalEventType.GOAL_UNLOCKED.value
TARGET_EDITED_BY_MANAGER = GoalEventType.TARGET_EDITED_BY_MANAGER.value
WEIGHTAGE_EDITED_BY_MANAGER = GoalEventType.WEIGHTAGE_EDITED_BY_MANAGER.value
SHARED_GOAL_PUSHED = GoalEventType.SHARED_GOAL_PUSHED.value
SHARED_GOAL_RECEIVED = GoalEventType.SHARED_GOAL_RECEIVED.value

# Audit-only events (no goal_events row; not in GoalEventType enum):
GOAL_UPDATED = "goal_updated"
GOAL_DELETED = "goal_deleted"
GOAL_SHEET_SUBMITTED = "goal_sheet_submitted"
GOAL_SHEET_APPROVED = "goal_sheet_approved"
GOAL_SHEET_RETURNED = "goal_sheet_returned"


# Names whose publication should also produce a goal_events row.
GOAL_EVENT_PERSISTED_TYPES: frozenset[str] = frozenset({
	GOAL_CREATED,
	GOAL_SUBMITTED,
	GOAL_APPROVED,
	GOAL_LOCKED,
	GOAL_RETURNED_FOR_REWORK,
	GOAL_UNLOCKED,
	TARGET_EDITED_BY_MANAGER,
	WEIGHTAGE_EDITED_BY_MANAGER,
	SHARED_GOAL_PUSHED,
	SHARED_GOAL_RECEIVED,
})


# ---------------------------------------------------------------------------
# Payload TypedDicts (advisory — payload is still passed as a plain dict)
# ---------------------------------------------------------------------------


class GoalCreatedEvent(TypedDict):
	goal_id: UUID
	user_id: UUID
	user_name: str
	cycle_id: UUID
	occurred_at: datetime


class GoalSubmittedEvent(TypedDict):
	goal_sheet_id: UUID
	user_id: UUID
	user_name: str
	manager_id: UUID
	goal_count: int
	occurred_at: datetime


class GoalApprovedEvent(TypedDict):
	goal_sheet_id: UUID
	employee_id: UUID
	employee_name: str
	manager_id: UUID
	manager_name: str
	occurred_at: datetime


class GoalReturnedEvent(TypedDict):
	goal_sheet_id: UUID
	employee_id: UUID
	employee_name: str
	manager_id: UUID
	reason: str
	occurred_at: datetime


class GoalLockedEvent(TypedDict):
	goal_id: UUID
	user_id: UUID
	locked_by: UUID
	locked_at: datetime
	occurred_at: datetime


class GoalUnlockedEvent(TypedDict):
	goal_id: UUID
	user_id: UUID
	admin_id: UUID
	reason: str
	occurred_at: datetime


class ManagerGoalEditedEvent(TypedDict):
	goal_id: UUID
	field_changed: str
	old_value: str
	new_value: str
	manager_id: UUID
	reason: str
	occurred_at: datetime


class SharedGoalPushedEvent(TypedDict):
	source_goal_id: UUID
	admin_id: UUID
	recipient_ids: list[UUID]
	occurred_at: datetime

