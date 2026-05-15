from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.core.constants import GoalEventType
from app.core.database import Base


class GoalEvent(Base):
	__tablename__ = "goal_events"

	id = Column(
		PG_UUID(as_uuid=True),
		primary_key=True,
		server_default=text("gen_random_uuid()"),
	)
	goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
	event_type = Column(Enum(GoalEventType, name="goal_event_type"), nullable=False)
	actor_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	payload = Column(JSON, nullable=True)
	occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	goal = relationship("Goal", back_populates="events")
	actor = relationship("User")


Index("ix_goal_events_goal_event", GoalEvent.goal_id, GoalEvent.event_type)
