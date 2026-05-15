from __future__ import annotations

from uuid import UUID

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Department(BaseModel):
	__tablename__ = "departments"

	name = Column(String(255), unique=True, nullable=False)
	head_user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

	head_user = relationship("User", foreign_keys=[head_user_id])
