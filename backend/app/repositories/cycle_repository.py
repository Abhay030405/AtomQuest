from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CyclePhase
from app.core.exceptions import CycleNotFoundError
from app.models.cycle_config import CycleConfig
from app.repositories.base_repository import BaseRepository


class CycleRepository(BaseRepository[CycleConfig]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, CycleConfig, not_found_exception=CycleNotFoundError)

	async def get_active(self) -> CycleConfig | None:
		stmt = select(CycleConfig).where(CycleConfig.is_active.is_(True))
		result = await self.session.execute(stmt)
		return result.scalar_one_or_none()

	async def get_active_or_raise(self) -> CycleConfig:
		cycle = await self.get_active()
		if cycle is None:
			raise CycleNotFoundError()
		return cycle

	async def get_by_phase(self, phase: CyclePhase) -> list[CycleConfig]:
		stmt = select(CycleConfig).where(CycleConfig.phase == phase)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def activate(self, cycle_id: UUID, db: AsyncSession) -> CycleConfig:
		stmt = select(CycleConfig).where(CycleConfig.id == cycle_id)
		result = await db.execute(stmt)
		cycle = result.scalar_one_or_none()
		if cycle is None:
			raise CycleNotFoundError()
		deactivate_stmt = (
			select(CycleConfig)
			.where(CycleConfig.phase == cycle.phase)
			.where(CycleConfig.id != cycle.id)
		)
		deactivate_result = await db.execute(deactivate_stmt)
		for other in deactivate_result.scalars().all():
			other.is_active = False
		cycle.is_active = True
		await db.flush()
		return cycle

	async def get_all_for_cycle(self, cycle_name: str) -> list[CycleConfig]:
		stmt = select(CycleConfig).where(CycleConfig.cycle_name == cycle_name)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())
