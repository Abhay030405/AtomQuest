"""SharedGoalSyncHandler — propagate source achievements to recipient goals.

Build plan §6.3. Subscribes to ``ACHIEVEMENT_LOGGED`` (and resubmissions). For
each event:

  1. Load the goal referenced by ``event_data["goal_id"]``.
  2. If ``goal.is_shared`` is ``False`` → return (no-op for personal goals).
  3. If ``goal.source_shared_goal_id`` is not NULL → return — this IS a
     recipient row; propagating again would recurse forever.
  4. Delegate to :class:`SharedGoalSyncService` which mirrors the source row
     onto every recipient and emits ``SHARED_ACHIEVEMENT_SYNCED`` per recipient.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events.event_bus import EventBus
from app.models.goal import Goal
from app.services.shared_goal_sync_service import shared_goal_sync_service


logger = get_logger(__name__)


async def _maybe_sync(event_data: dict[str, Any], db: AsyncSession) -> None:
	goal_id: UUID = event_data["goal_id"]
	goal = (
		await db.execute(
			select(Goal)
			.where(Goal.id == goal_id)
			.where(Goal.is_deleted.is_(False))
		)
	).scalar_one_or_none()
	if goal is None:
		return
	# Only the SOURCE goal cascades; recipient rows must never re-trigger sync.
	if not goal.is_shared or goal.source_shared_goal_id is not None:
		return

	await shared_goal_sync_service.sync_achievement(
		source_goal_id=goal_id,
		quarter=event_data["quarter"],
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		db=db,
		request_id=event_data.get("request_id"),
	)


async def on_achievement_logged(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _maybe_sync(event_data, db)


async def on_achievement_resubmitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _maybe_sync(event_data, db)


def register(bus: EventBus) -> None:
	bus.subscribe(ae.ACHIEVEMENT_LOGGED, on_achievement_logged)
	bus.subscribe(ae.ACHIEVEMENT_RESUBMITTED, on_achievement_resubmitted)
