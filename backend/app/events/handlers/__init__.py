from app.events.event_bus import event_bus
from app.events.handlers.audit_handler import audit_handler
from app.events.handlers.notification_handler import notification_handler


def setup_handlers() -> None:
	audit_handler.register(event_bus, db_factory=lambda: None)
	notification_handler.register(event_bus)


__all__ = ["setup_handlers"]
