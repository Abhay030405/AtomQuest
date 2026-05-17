from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import GoalEventType
from app.events import goal_events as ge
from app.events.event_bus import EventBus
from app.models.goal_event import GoalEvent


# Map event-name string -> GoalEventType enum member.
_EVENT_TYPE_MAP: dict[str, GoalEventType] = {
	ge.GOAL_CREATED: GoalEventType.GOAL_CREATED,
	ge.GOAL_SUBMITTED: GoalEventType.GOAL_SUBMITTED,
	ge.GOAL_APPROVED: GoalEventType.GOAL_APPROVED,
	ge.GOAL_LOCKED: GoalEventType.GOAL_LOCKED,
	ge.GOAL_RETURNED_FOR_REWORK: GoalEventType.GOAL_RETURNED_FOR_REWORK,
	ge.GOAL_UNLOCKED: GoalEventType.GOAL_UNLOCKED,
	ge.TARGET_EDITED_BY_MANAGER: GoalEventType.TARGET_EDITED_BY_MANAGER,
	ge.WEIGHTAGE_EDITED_BY_MANAGER: GoalEventType.WEIGHTAGE_EDITED_BY_MANAGER,
	ge.SHARED_GOAL_PUSHED: GoalEventType.SHARED_GOAL_PUSHED,
	ge.SHARED_GOAL_RECEIVED: GoalEventType.SHARED_GOAL_RECEIVED,
}


def _build_handler(event_name: str):
	enum_value = _EVENT_TYPE_MAP[event_name]

	async def handler(event_data: dict[str, Any], db: AsyncSession) -> None:
		goal_id = event_data.get("goal_id")
		if goal_id is None:
			# goal_events.goal_id is NOT NULL. Skip events without a target goal
			# (defensive — services should always provide goal_id for persisted types).
			return
		db.add(
			GoalEvent(
				goal_id=goal_id,
				event_type=enum_value,
				actor_id=event_data["actor_id"],
				payload=event_data.get("payload"),
			)
		)
		await db.flush()

	handler.__qualname__ = f"goal_event_handler.on_{event_name}"
	return handler


def register(bus: EventBus) -> None:
	for event_name in ge.GOAL_EVENT_PERSISTED_TYPES:
		bus.subscribe(event_name, _build_handler(event_name))
