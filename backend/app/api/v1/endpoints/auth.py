from __future__ import annotations

import secrets
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
import httpx

from app.core.config import settings
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


# ─── Microsoft / Azure AD SSO ─────────────────────────────────────────────────

_AZURE_SCOPE = "openid profile email User.Read"


@router.get("/azure/login")
async def azure_login() -> RedirectResponse:
	"""Redirect the browser to the Microsoft OAuth2 authorization page."""
	if not settings.azure_client_id or not settings.azure_tenant_id:
		raise AtomQuestException("AZURE_NOT_CONFIGURED", "Microsoft SSO is not configured.", 501)

	params = {
		"client_id": settings.azure_client_id,
		"response_type": "code",
		"redirect_uri": settings.azure_redirect_uri,
		"response_mode": "query",
		"scope": _AZURE_SCOPE,
		"state": secrets.token_urlsafe(24),
	}
	auth_url = (
		f"https://login.microsoftonline.com/{settings.azure_tenant_id}"
		f"/oauth2/v2.0/authorize?{urlencode(params)}"
	)
	return RedirectResponse(url=auth_url)


@router.get("/azure/callback")
async def azure_callback(
	code: str | None = Query(default=None),
	error: str | None = Query(default=None),
	error_description: str | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
	"""Exchange the authorization code for tokens, look up the user, and redirect to the frontend."""
	frontend_cb = f"{settings.frontend_url}/auth/callback"

	if error or not code:
		msg = error_description or error or "access_denied"
		return RedirectResponse(url=f"{frontend_cb}?error={msg}")

	# Exchange authorization code for Microsoft access token
	async with httpx.AsyncClient(timeout=15.0) as client:
		token_resp = await client.post(
			f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token",
			data={
				"client_id": settings.azure_client_id,
				"client_secret": settings.azure_client_secret,
				"code": code,
				"redirect_uri": settings.azure_redirect_uri,
				"grant_type": "authorization_code",
			},
		)

	if token_resp.status_code != 200:
		return RedirectResponse(url=f"{frontend_cb}?error=token_exchange_failed")

	ms_access_token = token_resp.json().get("access_token")
	if not ms_access_token:
		return RedirectResponse(url=f"{frontend_cb}?error=token_missing")

	# Fetch user profile from Microsoft Graph
	async with httpx.AsyncClient(timeout=15.0) as client:
		graph_resp = await client.get(
			"https://graph.microsoft.com/v1.0/me",
			headers={"Authorization": f"Bearer {ms_access_token}"},
		)

	if graph_resp.status_code != 200:
		return RedirectResponse(url=f"{frontend_cb}?error=graph_api_failed")

	ms_user = graph_resp.json()
	# Microsoft returns "mail" for regular accounts and "userPrincipalName" as fallback
	email: str = ms_user.get("mail") or ms_user.get("userPrincipalName") or ""
	if not email:
		return RedirectResponse(url=f"{frontend_cb}?error=email_not_found")

	# Find the user in our database (must already exist — Admins pre-create accounts)
	repo = UserRepository(db)
	user = await repo.get_by_email(email)
	if user is None:
		return RedirectResponse(url=f"{frontend_cb}?error=user_not_found")
	if not user.is_active:
		return RedirectResponse(url=f"{frontend_cb}?error=account_deactivated")

	# Issue our application JWTs
	permissions = [perm.value for perm in rbac_service.get_permissions(user.role)]
	access_token = create_access_token({"sub": str(user.id), "role": user.role.value, "permissions": permissions})
	refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value, "permissions": permissions})
	await audit_service.log_create("auth_logins", user.id, user, db)

	redirect_params = urlencode({"access_token": access_token, "refresh_token": refresh_token})
	return RedirectResponse(url=f"{frontend_cb}?{redirect_params}")
