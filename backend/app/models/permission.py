from __future__ import annotations

from sqlalchemy import Column, Enum, Integer, String, UniqueConstraint

from app.core.constants import UserRole
from app.core.database import Base


class RolePermission(Base):
	__tablename__ = "role_permissions"
	__table_args__ = (UniqueConstraint("role", "permission_key", name="uq_role_permission"),)

	id = Column(Integer, primary_key=True, autoincrement=True)
	role = Column(Enum(UserRole, name="user_role"), nullable=False)
	permission_key = Column(String(100), nullable=False)
