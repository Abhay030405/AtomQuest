from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, TypedDict
from uuid import UUID

from app.core.constants import AchievementStatus, Quarter, UserRole


# ---------------------------------------------------------------------------
# Event-name constants
# ---------------------------------------------------------------------------
# Achievement events do NOT map to GoalEventType (which is goal-table-scoped).
# Handlers (audit, notifications) subscribe by these literal strings.

ACHIEVEMENT_LOGGED = "achievement_logged"
ACHIEVEMENT_RESUBMITTED = "achievement_resubmitted"
SHARED_ACHIEVEMENT_SYNCED = "shared_achievement_synced"


# ---------------------------------------------------------------------------
# Payload TypedDicts (advisory)
# ---------------------------------------------------------------------------


class AchievementLoggedEvent(TypedDict):
	achievement_id: UUID
	goal_id: UUID
	user_id: UUID
	quarter: Quarter
	cycle_id: UUID
	status: AchievementStatus
	computed_score: Optional[Decimal]
	formula_used: Optional[str]
	occurred_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


class AchievementResubmittedEvent(TypedDict):
	achievement_id: UUID
	goal_id: UUID
	user_id: UUID
	quarter: Quarter
	cycle_id: UUID
	version_number: int
	edit_reason: str
	status: AchievementStatus
	old_score: Optional[Decimal]
	computed_score: Optional[Decimal]
	formula_used: Optional[str]
	occurred_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


class SharedAchievementSyncedEvent(TypedDict):
	"""Emitted by ``SharedGoalSyncService`` once per recipient goal."""

	achievement_id: UUID
	goal_id: UUID                     # recipient's goal
	user_id: UUID                     # recipient user
	quarter: Quarter
	cycle_id: UUID
	source_achievement_id: UUID
	source_goal_id: UUID
	source_user_id: UUID
	is_new: bool                      # True = INSERT, False = UPDATE
	status: AchievementStatus
	computed_score: Optional[Decimal]
	formula_used: Optional[str]
	occurred_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


__all__ = [
	"ACHIEVEMENT_LOGGED",
	"ACHIEVEMENT_RESUBMITTED",
	"SHARED_ACHIEVEMENT_SYNCED",
	"AchievementLoggedEvent",
	"AchievementResubmittedEvent",
	"SharedAchievementSyncedEvent",
]
