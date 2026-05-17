from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from uuid import UUID

from app.core.exceptions import WindowClosedError
from app.models.cycle_config import CycleConfig
from app.models.user import User
from app.repositories.cycle_repository import CycleRepository
from app.services.audit_service import audit_service


class CycleService:
	async def get_active_window(self, db: AsyncSession) -> CycleConfig | None:
		repo = CycleRepository(db)
		return await repo.get_active()

	async def is_window_open(self, db: AsyncSession) -> bool:
		cycle = await self.get_active_window(db)
		if cycle is None:
			return False
		now = datetime.now(timezone.utc)
		return cycle.window_open <= now <= cycle.window_close

	async def require_open_window(self, db: AsyncSession) -> CycleConfig:
		cycle = await self.get_active_window(db)
		if cycle is None:
			raise WindowClosedError("unknown")
		now = datetime.now(timezone.utc)
		if not (cycle.window_open <= now <= cycle.window_close):
			raise WindowClosedError(cycle.window_open.isoformat())
		return cycle

	async def get_window_status(self, db: AsyncSession) -> dict[str, Any]:
		cycle = await self.get_active_window(db)
		if cycle is None:
			return {
				"cycle_id": None,
				"cycle_name": None,
				"is_active": False,
				"is_open": False,
				"phase": None,
				"days_remaining": 0,
				"window_open": None,
				"window_close": None,
				"message": "No active goal window",
			}
		now = datetime.now(timezone.utc)
		is_open = cycle.window_open <= now <= cycle.window_close
		days_remaining = (cycle.window_close - now).days
		message = "Goal window is open" if is_open else "Goal window is closed"
		return {
			"cycle_id": cycle.id,
			"cycle_name": cycle.cycle_name,
			"is_active": cycle.is_active,
			"is_open": is_open,
			"phase": cycle.phase,
			"days_remaining": days_remaining,
			"window_open": cycle.window_open,
			"window_close": cycle.window_close,
			"message": message,
		}

	async def activate_window(self, cycle_id: UUID, actor: User, db: AsyncSession) -> CycleConfig:
		repo = CycleRepository(db)
		cycle = await repo.activate(cycle_id, db)
		await audit_service.log_update("cycle_configs", cycle.id, actor, "is_active", False, True, db)
		return cycle

	async def create_window(self, data: dict[str, Any], actor: User, db: AsyncSession) -> CycleConfig:
		if data["window_open"] >= data["window_close"]:
			raise ValueError("Window open must be before window close")
		repo = CycleRepository(db)
		cycle = await repo.create(data)
		await audit_service.log_create("cycle_configs", cycle.id, actor, db)
		return cycle


cycle_service = CycleService()
