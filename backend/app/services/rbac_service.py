from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Permission, RBAC_MATRIX, UserRole
from app.core.exceptions import ForbiddenError
from app.core.logging import get_logger
from app.models.permission import RolePermission

logger = get_logger(__name__)


class RBACService:
	def __init__(self) -> None:
		self._matrix = {role: set(perms) for role, perms in RBAC_MATRIX.items()}

	def has_permission(self, role: UserRole, permission: Permission) -> bool:
		return permission in self._matrix.get(role, set())

	def get_permissions(self, role: UserRole) -> list[Permission]:
		return list(self._matrix.get(role, set()))

	def require_permission(self, role: UserRole, permission: Permission) -> None:
		if not self.has_permission(role, permission):
			raise ForbiddenError()

	async def verify_db_consistency(self, db: AsyncSession) -> None:
		"""Verify role_permissions table matches the in-memory RBAC_MATRIX.

		Raises RuntimeError if the two sources have drifted.
		"""
		result = await db.execute(select(RolePermission.role, RolePermission.permission_key))
		db_matrix: dict[UserRole, set[str]] = {}
		for role, permission_key in result.all():
			role_enum = role if isinstance(role, UserRole) else UserRole(role)
			db_matrix.setdefault(role_enum, set()).add(permission_key)

		constant_matrix: dict[UserRole, set[str]] = {
			role: {p.value for p in perms} for role, perms in RBAC_MATRIX.items()
		}

		errors: list[str] = []

		for role, const_perms in constant_matrix.items():
			db_perms = db_matrix.get(role, set())
			missing_in_db = const_perms - db_perms
			extra_in_db = db_perms - const_perms
			if missing_in_db:
				errors.append(
					f"RBAC inconsistency: Role.{role.name} has permissions in constant "
					f"but not in DB: {sorted(missing_in_db)}"
				)
			if extra_in_db:
				errors.append(
					f"RBAC inconsistency: Role.{role.name} has permissions in DB "
					f"but not in constant: {sorted(extra_in_db)}"
				)

		for role in db_matrix:
			if role not in constant_matrix:
				errors.append(
					f"RBAC inconsistency: Role.{role.name} exists in DB but not in RBAC_MATRIX constant"
				)

		if errors:
			raise RuntimeError("\n".join(errors))

		logger.info("rbac_db_consistency_verified")


rbac_service = RBACService()
