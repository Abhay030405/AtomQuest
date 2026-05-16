from __future__ import annotations

from typing import Any, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, UserRole
from app.core.logging import get_logger
from app.events.event_bus import EventBus
from app.repositories.audit_repository import AuditRepository


logger = get_logger(__name__)


class AuditHandler:
	def register(self, event_bus: EventBus, db_factory: Callable[[], AsyncSession]) -> None:
		self.db_factory = db_factory
		event_bus.subscribe("goal_submitted", self.handle_goal_submitted)
		event_bus.subscribe("goal_approved", self.handle_goal_approved)
		event_bus.subscribe("goal_returned", self.handle_goal_returned)
		event_bus.subscribe("goal_locked", self.handle_goal_locked)
		event_bus.subscribe("goal_unlocked", self.handle_goal_unlocked)

	async def handle_goal_submitted(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				"goal_sheets",
				event_data["goal_sheet_id"],
				AuditAction.INSERT,
				event_data["user_id"],
				UserRole.EMPLOYEE,
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_handler_failed", error=str(exc))

	async def handle_goal_approved(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				"goal_sheets",
				event_data["goal_sheet_id"],
				AuditAction.UPDATE,
				event_data["manager_id"],
				UserRole.MANAGER,
				field_name="status",
				old_value="submitted",
				new_value="approved",
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_handler_failed", error=str(exc))

	async def handle_goal_returned(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				"goal_sheets",
				event_data["goal_sheet_id"],
				AuditAction.UPDATE,
				event_data["manager_id"],
				UserRole.MANAGER,
				field_name="status",
				old_value="submitted",
				new_value="draft",
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_handler_failed", error=str(exc))

	async def handle_goal_locked(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				"goals",
				event_data["goal_id"],
				AuditAction.UPDATE,
				event_data["locked_by"],
				UserRole.MANAGER,
				field_name="status",
				old_value="approved",
				new_value="locked",
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_handler_failed", error=str(exc))

	async def handle_goal_unlocked(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				"goals",
				event_data["goal_id"],
				AuditAction.UPDATE,
				event_data["admin_id"],
				UserRole.ADMIN,
				field_name="status",
				old_value="locked",
				new_value="under_review",
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_handler_failed", error=str(exc))


audit_handler = AuditHandler()
