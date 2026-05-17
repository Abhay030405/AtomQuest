from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import CheckinCommentType, CheckinRatingSentiment, Quarter
from app.models.base import BaseModel


class Checkin(BaseModel):
	"""Manager-led quarterly check-in with a direct report.

	Mirrors migration 011. The (manager, employee, quarter, cycle) tuple is
	unique — one check-in per pairing per quarter per cycle.
	"""

	__tablename__ = "checkins"
	__table_args__ = (
		UniqueConstraint(
			"manager_id",
			"employee_id",
			"quarter",
			"cycle_id",
			name="uq_checkins_manager_employee_quarter_cycle",
		),
	)

	manager_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	employee_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
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
	# min length 20 chars enforced at the Pydantic / service layer
	comment = Column(Text, nullable=False)
	comment_type = Column(
		Enum(
			CheckinCommentType,
			name="checkin_comment_type",
			values_callable=lambda x: [e.value for e in x],
		),
		default=CheckinCommentType.FREEFORM,
		nullable=False,
	)
	# Goal IDs explicitly covered in this check-in (free-form, no FK)
	goals_discussed = Column(ARRAY(PG_UUID(as_uuid=True)), nullable=True)
	overall_rating_sentiment = Column(
		Enum(
			CheckinRatingSentiment,
			name="checkin_rating_sentiment",
			values_callable=lambda x: [e.value for e in x],
		),
		nullable=True,
	)
	completed_at = Column(DateTime(timezone=True), nullable=True)
	is_acknowledged_by_employee = Column(Boolean, default=False, nullable=False)
	acknowledged_at = Column(DateTime(timezone=True), nullable=True)

	manager = relationship("User", foreign_keys=[manager_id])
	employee = relationship("User", foreign_keys=[employee_id])
	cycle = relationship("CycleConfig")
	events = relationship("CheckinEvent", back_populates="checkin")


Index("ix_checkins_manager_quarter", Checkin.manager_id, Checkin.quarter)
