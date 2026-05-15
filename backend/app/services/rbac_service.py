from __future__ import annotations

from app.core.constants import Permission, RBAC_MATRIX, UserRole
from app.core.exceptions import ForbiddenError


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


rbac_service = RBACService()
