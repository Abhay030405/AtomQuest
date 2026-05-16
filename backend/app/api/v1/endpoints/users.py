from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_manager, get_current_user, get_db, get_pagination
from app.core.constants import RBAC_MATRIX, UserRole
from app.core.exceptions import ForbiddenError
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.user import UserCreate, UserListResponse, UserResponse, UserUpdate
from app.services.audit_service import audit_service
from app.utils.pagination import build_pagination_meta


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
			"manager_id": user.manager_id,
			"manager_name": user.manager.full_name if getattr(user, "manager", None) else None,
			"department_name": user.department.name if getattr(user, "department", None) else None,
			"is_active": user.is_active,
			"created_at": user.created_at,
			"permissions": [perm.value for perm in RBAC_MATRIX.get(user.role, [])],
		}
	)


def _build_user_list_response(user) -> UserListResponse:
	return UserListResponse.model_validate(
		{
			"id": user.id,
			"email": user.email,
			"full_name": user.full_name,
			"role": user.role,
			"employee_code": user.employee_code,
			"department_name": user.department.name if getattr(user, "department", None) else None,
			"manager_name": user.manager.full_name if getattr(user, "manager", None) else None,
			"is_active": user.is_active,
		}
	)


@router.get("/", response_model=APIResponse[PaginatedData[UserListResponse]])
async def list_users(
	role: Optional[UserRole] = Query(default=None),
	department_id: Optional[UUID] = Query(default=None),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[PaginatedData[UserListResponse]]:
	repo = UserRepository(db)
	users = await repo.get_all(include_deleted=False)
	if role:
		users = [user for user in users if user.role == role]
	if department_id:
		users = [user for user in users if user.department_id == department_id]

	total = len(users)
	items = users[pagination.skip : pagination.skip + pagination.limit]
	data = [_build_user_list_response(item) for item in items]
	meta = build_pagination_meta(total=total, page=pagination.page, page_size=pagination.page_size)
	return APIResponse.ok(PaginatedData(items=data, meta=meta))


@router.post("/", response_model=APIResponse[UserResponse])
async def create_user(
	payload: UserCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[UserResponse]:
	repo = UserRepository(db)
	user = await repo.create(
		{
			"email": payload.email,
			"hashed_password": hash_password(payload.password),
			"full_name": payload.full_name,
			"role": payload.role,
			"department_id": payload.department_id,
			"employee_code": payload.employee_code,
			"manager_id": payload.manager_id,
			"is_active": True,
		}
	)

	await audit_service.log_create("users", user.id, current_user, db)
	await db.commit()
	await db.refresh(user)
	return APIResponse.ok(_build_user_response(user))


@router.get("/me/team", response_model=APIResponse[list[UserListResponse]])
async def get_my_team(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_manager),
) -> APIResponse[list[UserListResponse]]:
	repo = UserRepository(db)
	users = await repo.get_team(current_user.id)
	items = [_build_user_list_response(user) for user in users]
	return APIResponse.ok(items)


@router.get("/{user_id}", response_model=APIResponse[UserResponse])
async def get_user(
	user_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[UserResponse]:
	repo = UserRepository(db)
	user = await repo.get_or_raise(user_id)
	if current_user.role == UserRole.EMPLOYEE and current_user.id != user.id:
		raise ForbiddenError()
	if current_user.role == UserRole.MANAGER and user.manager_id != current_user.id and current_user.id != user.id:
		raise ForbiddenError()
	return APIResponse.ok(_build_user_response(user))


@router.patch("/{user_id}", response_model=APIResponse[UserResponse])
async def update_user(
	user_id: UUID,
	payload: UserUpdate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[UserResponse]:
	repo = UserRepository(db)
	user = await repo.get_or_raise(user_id)
	updates = payload.model_dump(exclude_unset=True)
	await repo.update(user, updates)
	for field, value in updates.items():
		await audit_service.log_update("users", user.id, current_user, field, getattr(user, field), value, db)
	await db.commit()
	await db.refresh(user)
	return APIResponse.ok(_build_user_response(user))
