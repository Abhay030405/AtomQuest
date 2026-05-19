from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.core.constants import UserRole
from app.models.base import BaseModel


class User(BaseModel):
	__tablename__ = "users"

	email = Column(String(255), unique=True, nullable=False, index=True)
	hashed_password = Column(Text, nullable=False)
	full_name = Column(String(255), nullable=False)
	role = Column(Enum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]), nullable=False)
	manager_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
	department_id = Column(PG_UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
	employee_code = Column(String(50), unique=True, nullable=True)
	phone_number = Column(String(20), nullable=True)
	microsoft_email = Column(String(255), unique=True, nullable=True)
	is_active = Column(Boolean, default=True, nullable=False)

	manager = relationship("User", remote_side="User.id", back_populates="direct_reports")
	direct_reports = relationship("User", back_populates="manager")
	department = relationship("Department", foreign_keys=[department_id])
	goal_sheets = relationship("GoalSheet", foreign_keys="[GoalSheet.user_id]", back_populates="owner")


Index("ix_users_email_is_deleted", User.email, User.is_deleted)
