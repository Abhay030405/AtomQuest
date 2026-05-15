from __future__ import annotations

from datetime import datetime
from typing import TypedDict
from uuid import UUID


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
