from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.constants import CheckinEventType
from app.models.base import BaseModel


class CheckinEvent(BaseModel):
	"""Append-only event log for check-in mutations.

	Mirrors migration 012. `event_type` values are UPPERCASE per build plan §1.
	"""

	__tablename__ = "checkin_events"

	checkin_id = Column(PG_UUID(as_uuid=True), ForeignKey("checkins.id"), nullable=False)
	event_type = Column(
		Enum(
			CheckinEventType,
			name="checkin_event_type",
			values_callable=lambda x: [e.value for e in x],
		),
		nullable=False,
	)
	actor_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	# Old/new comment, prior/new status, etc.
	payload = Column(JSONB, nullable=True)
	occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	checkin = relationship("Checkin", back_populates="events")
	actor = relationship("User", foreign_keys=[actor_id])


Index("ix_checkin_events_checkin_id", CheckinEvent.checkin_id)
