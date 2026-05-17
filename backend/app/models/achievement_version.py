from __future__ import annotations

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import AchievementStatus
from app.models.base import BaseModel


class AchievementVersion(BaseModel):
	"""Append-only snapshot of every achievement edit / resubmission.

	Mirrors migration 010 exactly. `edit_reason` is NOT NULL — every
	resubmission must justify itself for the audit trail.
	"""

	__tablename__ = "achievement_versions"
	__table_args__ = (
		UniqueConstraint(
			"achievement_id",
			"version_number",
			name="uq_achievement_versions_achievement_version",
		),
	)

	achievement_id = Column(
		PG_UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=False
	)
	version_number = Column(Integer, nullable=False)
	actual_value = Column(Numeric(15, 4), nullable=True)
	actual_date = Column(Date, nullable=True)
	status = Column(
		Enum(
			AchievementStatus,
			name="achievement_status",
			values_callable=lambda x: [e.value for e in x],
			create_type=False,
		),
		nullable=False,
	)
	computed_score = Column(Numeric(8, 4), nullable=True)
	score_formula_used = Column(String(50), nullable=True)
	submitted_at = Column(DateTime(timezone=True), nullable=True)
	submitted_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
	edit_reason = Column(Text, nullable=False)

	achievement = relationship("Achievement", back_populates="versions")
	submitter = relationship("User", foreign_keys=[submitted_by])
