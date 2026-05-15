from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import NotificationType
from app.models.base import BaseModel


class Notification(BaseModel):
	__tablename__ = "notifications"

	recipient_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	notification_type = Column(Enum(NotificationType, name="notification_type"), nullable=False)
	title = Column(String(255), nullable=False)
	body = Column(Text, nullable=False)
	is_read = Column(Boolean, default=False, nullable=False)
	read_at = Column(DateTime(timezone=True), nullable=True)
	deep_link = Column(String(500), nullable=True)
	related_goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=True)

	recipient = relationship("User", foreign_keys=[recipient_id])
	related_goal = relationship("Goal", foreign_keys=[related_goal_id])


Index("ix_notifications_recipient_is_read", Notification.recipient_id, Notification.is_read)
