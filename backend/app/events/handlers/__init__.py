from app.events.event_bus import event_bus
from app.events.handlers.audit_handler import AuditHandler
from app.events.handlers.notification_handler import NotificationHandler


def setup_handlers() -> None:
    AuditHandler().register(event_bus, db_factory=lambda: None)
    NotificationHandler().register(event_bus)


__all__ = ["setup_handlers"]
