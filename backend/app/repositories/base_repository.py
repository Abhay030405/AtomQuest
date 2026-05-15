from __future__ import annotations

from typing import Any, Generic, Optional, Sequence, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AtomQuestException


ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
	def __init__(self, session: AsyncSession, model: type[ModelType], not_found_exception: type[AtomQuestException] | None = None):
		self.session = session
		self.model = model
		self.not_found_exception = not_found_exception

	def _has_column(self, name: str) -> bool:
		return hasattr(self.model, name)

	async def get(self, id: UUID) -> Optional[ModelType]:
		stmt = select(self.model).where(self.model.id == id)
		if self._has_column("is_deleted"):
			stmt = stmt.where(self.model.is_deleted.is_(False))
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_or_raise(self, id: UUID) -> ModelType:
		instance = await self.get(id)
		if instance is None:
			if self.not_found_exception is not None:
				raise self.not_found_exception()
			raise AtomQuestException("NOT_FOUND", "Resource not found", 404)
		return instance

	async def get_all(self, skip: int = 0, limit: int = 100, include_deleted: bool = False) -> list[ModelType]:
		stmt = select(self.model)
		if self._has_column("is_deleted") and not include_deleted:
			stmt = stmt.where(self.model.is_deleted.is_(False))
		stmt = stmt.offset(skip).limit(limit)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def create(self, data: dict[str, Any]) -> ModelType:
		instance = self.model(**data)
		self.session.add(instance)
		await self.session.flush()
		return instance

	async def update(self, instance: ModelType, data: dict[str, Any]) -> ModelType:
		for key, value in data.items():
			setattr(instance, key, value)
		await self.session.flush()
		return instance

	async def soft_delete(self, instance: ModelType) -> ModelType:
		if not self._has_column("is_deleted"):
			raise ValueError("Model does not support soft delete")
		setattr(instance, "is_deleted", True)
		if self._has_column("updated_at"):
			setattr(instance, "updated_at", func.now())
		await self.session.flush()
		return instance

	async def count(self, filters: Optional[Sequence[Any]] = None) -> int:
		stmt = select(func.count()).select_from(self.model)
		if self._has_column("is_deleted"):
			stmt = stmt.where(self.model.is_deleted.is_(False))
		if filters:
			stmt = stmt.where(*filters)
		result = await self.session.execute(stmt)
		return int(result.scalar_one())
