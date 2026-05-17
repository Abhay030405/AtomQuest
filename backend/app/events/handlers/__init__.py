from app.core.logging import get_logger
from app.events.event_bus import event_bus
from app.events.handlers import (
	audit_handler,
	goal_event_handler,
	notification_handler,
	shared_goal_sync_handler,
	snapshot_update_handler,
)


logger = get_logger(__name__)


def setup_handlers() -> None:
	"""Register all event subscribers on the global EventBus.

	Called once during FastAPI startup. Idempotent: clears any prior subscriptions
	first so the call is safe to repeat (e.g. from tests).
	"""
	event_bus.clear()
	audit_handler.register(event_bus)
	notification_handler.register(event_bus)
	goal_event_handler.register(event_bus)
	# Phase 2 — analytics read model + shared-goal propagation.
	snapshot_update_handler.register(event_bus)
	shared_goal_sync_handler.register(event_bus)
	logger.info("event_handlers_registered", count=sum(len(h) for h in event_bus.handlers.values()))


__all__ = ["setup_handlers"]

