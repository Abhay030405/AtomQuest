from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.constants import RBAC_MATRIX
from app.core.exceptions import AtomQuestException, InvalidCredentialsError, UnauthorizedError
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.schemas.common import APIResponse
from app.schemas.user import UserResponse
from app.services.audit_service import audit_service
from app.services.rbac_service import rbac_service
from app.api.deps import get_current_user, get_db
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()


def _build_user_response(user) -> UserResponse:
	return UserResponse.model_validate(
		{
			"id": user.id,
			"email": user.email,
			"full_name": user.full_name,
			"role": user.role,
			"department_id": user.department_id,
			"employee_code": user.employee_code,
			"phone_number": user.phone_number,
			"manager_id": user.manager_id,
			"manager_name": user.manager.full_name if getattr(user, "manager", None) else None,
			"department_name": user.department.name if getattr(user, "department", None) else None,
			"is_active": user.is_active,
			"created_at": user.created_at,
			"permissions": [perm.value for perm in RBAC_MATRIX.get(user.role, [])],
		}
	)


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> APIResponse[TokenResponse]:
	repo = UserRepository(db)
	user = await repo.get_by_email(payload.email)
	if user is None or not verify_password(payload.password, user.hashed_password):
		raise InvalidCredentialsError()
	if not user.is_active:
		raise AtomQuestException(
			"ACCOUNT_DEACTIVATED",
			"Account is deactivated. Contact HR Admin.",
			403,
		)

	permissions = [perm.value for perm in rbac_service.get_permissions(user.role)]
	access_token = create_access_token({"sub": str(user.id), "role": user.role.value, "permissions": permissions})
	refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value, "permissions": permissions})
	await audit_service.log_create("auth_logins", user.id, user, db)

	return APIResponse.ok(
		TokenResponse(
			access_token=access_token,
			refresh_token=refresh_token,
			user=_build_user_response(user),
		)
	)


@router.post("/refresh", response_model=APIResponse[TokenResponse])
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> APIResponse[TokenResponse]:
	token_payload = decode_token(payload.refresh_token)
	if token_payload.get("type") != "refresh":
		raise UnauthorizedError()
	user_id = token_payload.get("sub")
	if not user_id:
		raise UnauthorizedError()
	repo = UserRepository(db)
	user = await repo.get_active_by_id(UUID(user_id))
	if user is None:
		raise UnauthorizedError()
	permissions = [perm.value for perm in rbac_service.get_permissions(user.role)]
	access_token = create_access_token({"sub": str(user.id), "role": user.role.value, "permissions": permissions})
	return APIResponse.ok(
		TokenResponse(
			access_token=access_token,
			refresh_token=payload.refresh_token,
			user=_build_user_response(user),
		)
	)


@router.post("/logout", response_model=APIResponse[dict])
async def logout(payload: LogoutRequest) -> APIResponse[dict]:
	decode_token(payload.refresh_token)
	return APIResponse.ok({"message": "Logged out"})


@router.get("/me", response_model=APIResponse[UserResponse])
async def me(current_user=Depends(get_current_user)) -> APIResponse[UserResponse]:
	return APIResponse.ok(_build_user_response(current_user))
