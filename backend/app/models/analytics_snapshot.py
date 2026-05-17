from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.constants import Quarter
from app.models.base import BaseModel


class AnalyticsSnapshot(BaseModel):
	"""Lite-CQRS read projection: one row per (user, quarter, cycle).

	Mirrors migration 013. Kept current by `SnapshotUpdateHandler` (an event
	subscriber). Dashboards read this table instead of running multi-table joins.
	"""

	__tablename__ = "analytics_snapshots"
	__table_args__ = (
		UniqueConstraint(
			"user_id",
			"quarter",
			"cycle_id",
			name="uq_analytics_snapshots_user_quarter_cycle",
		),
	)

	quarter = Column(
		Enum(
			Quarter,
			name="quarter",
			values_callable=lambda x: [e.value for e in x],
			create_type=False,
		),
		nullable=False,
	)
	cycle_id = Column(PG_UUID(as_uuid=True), ForeignKey("cycle_configs.id"), nullable=False)
	user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	# Nullable: derived from the user; admin / unassigned users may lack these
	department_id = Column(
		PG_UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
	)
	manager_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
	# Nullable: WeightedScoreAggregator returns None when no goals have scored yet
	weighted_score = Column(Numeric(8, 4), nullable=True)
	goals_total = Column(Integer, default=0, nullable=False)
	goals_submitted = Column(Integer, default=0, nullable=False)
	goals_completed = Column(Integer, default=0, nullable=False)
	checkin_done = Column(Boolean, default=False, nullable=False)
	achievement_submitted = Column(Boolean, default=False, nullable=False)
	snapshot_generated_at = Column(
		DateTime(timezone=True), server_default=func.now(), nullable=False
	)

	user = relationship("User", foreign_keys=[user_id])
	manager = relationship("User", foreign_keys=[manager_id])
	department = relationship("Department", foreign_keys=[department_id])
	cycle = relationship("CycleConfig")


Index(
	"ix_analytics_snapshots_dept_quarter",
	AnalyticsSnapshot.department_id,
	AnalyticsSnapshot.quarter,
)
Index(
	"ix_analytics_snapshots_manager_quarter",
	AnalyticsSnapshot.manager_id,
	AnalyticsSnapshot.quarter,
)
