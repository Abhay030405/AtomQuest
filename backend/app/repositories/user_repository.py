from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import UserRole
from app.core.exceptions import UserNotFoundError
from app.models.user import User
from app.repositories.base_repository import BaseRepository

_USER_OPTS = (selectinload(User.manager), selectinload(User.department))





class UserRepository(BaseRepository[User]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, User, not_found_exception=UserNotFoundError)

	async def get_by_email(self, email: str) -> Optional[User]:
		stmt = (
			select(User)
			.options(*_USER_OPTS)
			.where(func.lower(User.email) == email.lower())
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get(self, id: UUID) -> Optional[User]:
		stmt = (
			select(User)
			.options(*_USER_OPTS)
			.where(User.id == id)
			.where(User.is_deleted.is_(False))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_all(self, skip: int = 0, limit: int = 1000, include_deleted: bool = False) -> list[User]:
		stmt = select(User).options(*_USER_OPTS)
		if not include_deleted:
			stmt = stmt.where(User.is_deleted.is_(False))
		stmt = stmt.offset(skip).limit(limit)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_active_by_id(self, id: UUID) -> Optional[User]:
		stmt = (
			select(User)
			.options(*_USER_OPTS)
			.where(User.id == id, User.is_deleted.is_(False), User.is_active.is_(True))
		)
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_team(self, manager_id: UUID) -> list[User]:
		stmt = (
			select(User)
			.options(*_USER_OPTS)
			.where(User.manager_id == manager_id)
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_all_employees(self, department_id: Optional[UUID] = None) -> list[User]:
		stmt = (
			select(User)
			.options(*_USER_OPTS)
			.where(User.role == UserRole.EMPLOYEE)
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		if department_id:
			stmt = stmt.where(User.department_id == department_id)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_hierarchy_tree(self, root_user_id: UUID) -> list[User]:
		base = (
			select(User)
			.where(User.id == root_user_id)
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		cte = base.cte(name="user_tree", recursive=True)
		children = (
			select(User)
			.where(User.manager_id == cte.c.id)
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		cte = cte.union_all(children)
		stmt = select(User).where(User.id.in_(select(cte.c.id)))
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_users_with_role(self, role: UserRole) -> list[User]:
		stmt = (
			select(User)
			.where(User.role == role)
			.where(User.is_deleted.is_(False))
			.where(User.is_active.is_(True))
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())
