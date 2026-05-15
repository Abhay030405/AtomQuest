from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel


class SharedGoal(BaseModel):
	__tablename__ = "shared_goals"
	__table_args__ = (
		UniqueConstraint("source_goal_id", "recipient_user_id", name="uq_shared_goal_recipient"),
	)

	source_goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
	recipient_user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	custom_weightage = Column(Numeric(5, 2), nullable=True)
	is_accepted = Column(Boolean, default=True, nullable=False)
	pushed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	pushed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

	source_goal = relationship("Goal", foreign_keys=[source_goal_id])
	recipient = relationship("User", foreign_keys=[recipient_user_id])
	pusher = relationship("User", foreign_keys=[pushed_by])
