from __future__ import annotations

from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import CyclePhase
from app.models.base import BaseModel


class CycleConfig(BaseModel):
	__tablename__ = "cycle_configs"

	cycle_name = Column(String(100), nullable=False)
	phase = Column(Enum(CyclePhase, name="cycle_phase"), nullable=False)
	window_open = Column(DateTime(timezone=True), nullable=False)
	window_close = Column(DateTime(timezone=True), nullable=False)
	is_active = Column(Boolean, default=False, nullable=False)
	created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

	creator = relationship("User")
