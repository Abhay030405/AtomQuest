from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.core.constants import UserRole
from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
	email: EmailStr
	full_name: str
	role: UserRole
	department_id: Optional[UUID] = None
	employee_code: Optional[str] = None


class UserCreate(UserBase):
	password: str = Field(min_length=8)
	manager_id: Optional[UUID] = None

	@field_validator("password")
	@classmethod
	def validate_password(cls, value: str) -> str:
		if not re.search(r"[A-Z]", value):
			raise ValueError("Password must contain at least one uppercase letter")
		if not re.search(r"[a-z]", value):
			raise ValueError("Password must contain at least one lowercase letter")
		if not re.search(r"\d", value):
			raise ValueError("Password must contain at least one digit")
		return value


class UserUpdate(BaseSchema):
	full_name: Optional[str] = None
	department_id: Optional[UUID] = None
	manager_id: Optional[UUID] = None
	is_active: Optional[bool] = None


class UserResponse(UserBase):
	id: UUID
	manager_id: Optional[UUID] = None
	manager_name: Optional[str] = None
	department_name: Optional[str] = None
	is_active: bool
	created_at: datetime
	permissions: list[str]


class UserListResponse(BaseSchema):
	id: UUID
	email: EmailStr
	full_name: str
	role: UserRole
	employee_code: Optional[str] = None
	department_name: Optional[str] = None
	manager_name: Optional[str] = None
	is_active: bool
