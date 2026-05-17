from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import AchievementStatus, Quarter
from app.models.base import BaseModel


class Achievement(BaseModel):
	"""Quarterly achievement entry for a goal.

	Mirrors migration 009 exactly. The (goal_id, quarter) pair is unique so a
	goal has at most one achievement row per quarter; resubmissions go to
	`AchievementVersion`.
	"""

	__tablename__ = "achievements"
	__table_args__ = (
		UniqueConstraint("goal_id", "quarter", name="uq_achievements_goal_quarter"),
	)

	goal_id = Column(PG_UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
	quarter = Column(
		Enum(Quarter, name="quarter", values_callable=lambda x: [e.value for e in x]),
		nullable=False,
	)
	# NULL until the employee submits
	actual_value = Column(Numeric(15, 4), nullable=True)
	# Used only when the parent goal's uom_type == 'timeline'
	actual_date = Column(Date, nullable=True)
	status = Column(
		Enum(
			AchievementStatus,
			name="achievement_status",
			values_callable=lambda x: [e.value for e in x],
		),
		default=AchievementStatus.NOT_STARTED,
		nullable=False,
	)
	# Nullable: TimelineScoringStrategy returns None while in-progress
	computed_score = Column(Numeric(8, 4), nullable=True)
	score_formula_used = Column(String(50), nullable=True)
	submitted_at = Column(DateTime(timezone=True), nullable=True)
	submitted_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
	is_synced_from_shared = Column(Boolean, default=False, nullable=False)

	goal = relationship("Goal", foreign_keys=[goal_id])
	submitter = relationship("User", foreign_keys=[submitted_by])
	versions = relationship("AchievementVersion", back_populates="achievement")


Index("ix_achievements_goal_id", Achievement.goal_id)
