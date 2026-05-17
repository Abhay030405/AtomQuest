"""Check-in event names and payload contracts.

Mirrors the convention from ``app/events/achievement_events.py``:

  * Event names are lowercase ``snake_case`` strings used by ``event_bus``.
  * Persisted ``CheckinEventType`` values (the DB enum) are UPPERCASE and live
    in ``app/core/constants.py`` — do not confuse the two.

Handlers (audit, notifications, snapshot updater) subscribe to these literals.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, TypedDict
from uuid import UUID

from app.core.constants import (
	CheckinCommentType,
	CheckinRatingSentiment,
	Quarter,
	UserRole,
)


# ---------------------------------------------------------------------------
# Event-name constants
# ---------------------------------------------------------------------------

CHECKIN_COMPLETED = "checkin_completed"
CHECKIN_UPDATED = "checkin_updated"
CHECKIN_ACKNOWLEDGED = "checkin_acknowledged"


# ---------------------------------------------------------------------------
# Payload TypedDicts (advisory — runtime payloads are plain dicts)
# ---------------------------------------------------------------------------


class CheckinCompletedEvent(TypedDict):
	checkin_id: UUID
	manager_id: UUID
	employee_id: UUID
	quarter: Quarter
	cycle_id: UUID
	comment_type: CheckinCommentType
	sentiment: Optional[CheckinRatingSentiment]
	occurred_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


class CheckinUpdatedEvent(TypedDict):
	checkin_id: UUID
	manager_id: UUID
	employee_id: UUID
	quarter: Quarter
	cycle_id: UUID
	old_comment: str
	new_comment: str
	edit_reason: str
	occurred_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


class CheckinAcknowledgedEvent(TypedDict):
	checkin_id: UUID
	manager_id: UUID
	employee_id: UUID
	quarter: Quarter
	cycle_id: UUID
	acknowledged_at: datetime
	actor_id: UUID
	actor_role: UserRole
	request_id: Optional[str]


__all__ = [
	"CHECKIN_COMPLETED",
	"CHECKIN_UPDATED",
	"CHECKIN_ACKNOWLEDGED",
	"CheckinCompletedEvent",
	"CheckinUpdatedEvent",
	"CheckinAcknowledgedEvent",
]
