from __future__ import annotations

from collections.abc import AsyncGenerator, Callable
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Permission, UserRole
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.core.database import AsyncSessionLocal
from app.repositories.user_repository import UserRepository
from app.services.rbac_service import rbac_service
from app.utils.pagination import PaginationParams


bearer_scheme = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
	session: AsyncSession = AsyncSessionLocal()
	try:
		yield session
	finally:
		await session.close()


async def get_current_user(
	credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
	db: AsyncSession = Depends(get_db),
):
	payload = decode_token(credentials.credentials)
	user_id = payload.get("sub")
	if not user_id:
		raise UnauthorizedError()
	repo = UserRepository(db)
	user = await repo.get_active_by_id(UUID(user_id))
	if user is None or user.is_deleted:
		raise UnauthorizedError()
	return user


def require_permission(permission: Permission) -> Callable:
	def _dependency(
		current_user=Depends(get_current_user),
	):
		if not rbac_service.has_permission(current_user.role, permission):
			raise ForbiddenError()
		return current_user

	return _dependency


def get_current_active_employee(current_user=Depends(get_current_user)):
	if current_user.role != UserRole.EMPLOYEE:
		raise ForbiddenError()
	return current_user


def get_current_manager(current_user=Depends(get_current_user)):
	if current_user.role not in {UserRole.MANAGER, UserRole.ADMIN}:
		raise ForbiddenError()
	return current_user


def get_current_admin(current_user=Depends(get_current_user)):
	if current_user.role != UserRole.ADMIN:
		raise ForbiddenError()
	return current_user


def get_pagination(page: int = 1, page_size: int = 20, max_size: int = 500) -> PaginationParams:
	if page < 1:
		raise HTTPException(status_code=400, detail="page must be >= 1")
	if page_size < 1 or page_size > max_size:
		raise HTTPException(
			status_code=400,
			detail=f"page_size must be between 1 and {max_size}",
		)
	skip = (page - 1) * page_size
	return PaginationParams(skip=skip, limit=page_size, page=page, page_size=page_size)


def get_request_id(request: Request) -> str:
	return request.headers.get("X-Request-ID") or str(uuid4())
