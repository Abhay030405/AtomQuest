from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func, text

from app.core.database import Base


class BaseModel(Base):
	__abstract__ = True

	id = Column(
		PG_UUID(as_uuid=True),
		primary_key=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	updated_at = Column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
	)
	is_deleted = Column(Boolean, server_default=text("false"), nullable=False)

	def soft_delete(self) -> None:
		self.is_deleted = True

	def to_dict(self) -> dict[str, Any]:
		return {column.name: getattr(self, column.name) for column in self.__table__.columns}
