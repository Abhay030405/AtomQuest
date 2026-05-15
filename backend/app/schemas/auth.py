from __future__ import annotations

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema
from app.schemas.user import UserResponse


class LoginRequest(BaseSchema):
	email: EmailStr
	password: str = Field(min_length=6)


class TokenResponse(BaseSchema):
	access_token: str
	refresh_token: str
	token_type: str = "bearer"
	user: UserResponse


class RefreshRequest(BaseSchema):
	refresh_token: str


class LogoutRequest(BaseSchema):
	refresh_token: str
