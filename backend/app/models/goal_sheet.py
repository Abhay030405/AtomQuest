from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import GoalSheetStatus
from app.models.base import BaseModel


class GoalSheet(BaseModel):
    __tablename__ = "goal_sheets"
    __table_args__ = (UniqueConstraint("user_id", "cycle_id", name="uq_goal_sheet_user_cycle"),)

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cycle_id = Column(PG_UUID(as_uuid=True), ForeignKey("cycle_configs.id"), nullable=False)
    status = Column(Enum(GoalSheetStatus, name="goal_sheet_status", values_callable=lambda x: [e.value for e in x]), default=GoalSheetStatus.DRAFT, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    returned_count = Column(Integer, default=0, nullable=False)

    owner = relationship("User", foreign_keys=[user_id], back_populates="goal_sheets")
    approver = relationship("User", foreign_keys=[approved_by])
    cycle = relationship("CycleConfig")
    goals = relationship("Goal", back_populates="goal_sheet")
