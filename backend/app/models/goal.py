from __future__ import annotations

from uuid import UUID

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import GoalStatus, ThrustArea, UoMType
from app.models.base import BaseModel


class Goal(BaseModel):
	__tablename__ = "goals"

	user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	goal_sheet_id = Column(PG_UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
	title = Column(String(500), nullable=False)
	description = Column(Text, nullable=True)
	thrust_area = Column(Enum(ThrustArea, name="thrust_area", values_callable=lambda x: [e.value for e in x]), nullable=False)
	uom_type = Column(Enum(UoMType, name="uom_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
	target_value = Column(Numeric(15, 4), nullable=True)
	target_date = Column(Date, nullable=True)
	weightage = Column(Numeric(5, 2), nullable=False)
	status = Column(Enum(GoalStatus, name="goal_status", values_callable=lambda x: [e.value for e in x]), default=GoalStatus.DRAFT, nullable=False)
	is_shared = Column(Boolean, default=False, nullable=False)
	source_shared_goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=True)
	version = Column(Integer, default=1, nullable=False)
	locked_at = Column(DateTime(timezone=True), nullable=True)
	locked_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
	cycle_id = Column(PG_UUID(as_uuid=True), ForeignKey("cycle_configs.id"), nullable=False)

	owner = relationship("User", foreign_keys=[user_id])
	goal_sheet = relationship("GoalSheet", back_populates="goals")
	versions = relationship("GoalVersion", back_populates="goal")
	events = relationship("GoalEvent", back_populates="goal")
	source_goal = relationship("Goal", remote_side="Goal.id", foreign_keys=[source_shared_goal_id])
	locker = relationship("User", foreign_keys=[locked_by])
	cycle = relationship("CycleConfig")


Index("ix_goals_user_cycle", Goal.user_id, Goal.cycle_id)
Index("ix_goals_goal_sheet_id", Goal.goal_sheet_id)
Index("ix_goals_status", Goal.status)
