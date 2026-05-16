from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.core.constants import GoalStatus, ThrustArea, UoMType
from app.core.database import Base


class GoalVersion(Base):
	__tablename__ = "goal_versions"
	__table_args__ = (UniqueConstraint("goal_id", "version_number", name="uq_goal_versions_goal_version"),)

	id = Column(
		PG_UUID(as_uuid=True),
		primary_key=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
	version_number = Column(Integer, nullable=False)
	title = Column(String(500), nullable=False)
	description = Column(Text, nullable=True)
	thrust_area = Column(Enum(ThrustArea, name="thrust_area", values_callable=lambda x: [e.value for e in x]), nullable=False)
	uom_type = Column(Enum(UoMType, name="uom_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
	target_value = Column(Numeric(15, 4), nullable=True)
	target_date = Column(Date, nullable=True)
	weightage = Column(Numeric(5, 2), nullable=False)
	status = Column(Enum(GoalStatus, name="goal_status", values_callable=lambda x: [e.value for e in x]), nullable=False)
	changed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	change_reason = Column(Text, nullable=True)
	snapshot_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	goal = relationship("Goal", back_populates="versions")
	changed_by_user = relationship("User")
