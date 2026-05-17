from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.logging import get_logger
from app.models.audit_log import AuditLog
from app.models.goal import Goal
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditFilter


logger = get_logger(__name__)


class AuditService:
	async def log_create(
		self,
		table_name: str,
		record_id: UUID,
		actor: User,
		db: AsyncSession,
		request_id: str | None = None,
	) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(table_name, record_id, AuditAction.INSERT, actor.id, actor.role, request_id=request_id)
		except Exception as exc:  # pragma: no cover - audit must never break the flow
			logger.error("audit_log_create_failed", error=str(exc))

	async def log_update(
		self,
		table_name: str,
		record_id: UUID,
		actor: User,
		field_name: str,
		old_value: Any,
		new_value: Any,
		db: AsyncSession,
		request_id: str | None = None,
	) -> None:
		try:
			repo = AuditRepository(db)
			await repo.log(
				table_name,
				record_id,
				AuditAction.UPDATE,
				actor.id,
				actor.role,
				field_name=field_name,
				old_value=str(old_value) if old_value is not None else None,
				new_value=str(new_value) if new_value is not None else None,
				request_id=request_id,
			)
		except Exception as exc:  # pragma: no cover
			logger.error("audit_log_update_failed", error=str(exc))

	async def log_goal_changes(
		self,
		old_goal: dict[str, Any],
		new_goal: Goal | dict[str, Any],
		actor: User,
		db: AsyncSession,
		request_id: str | None = None,
	) -> None:
		# The caller MUST pass either a pre-computed dict for ``new_goal`` or a Goal
		# instance whose attributes are still in-memory (i.e. before any db.flush()).
		# Once the session flushes, server-managed columns like ``updated_at`` get
		# expired, and reading them via getattr() would trigger a sync lazy-load
		# from inside the async session and raise MissingGreenlet.
		if isinstance(new_goal, dict):
			new_snapshot: dict[str, Any] = new_goal
			record_id = new_goal.get("id")
		else:
			new_snapshot = {
				column.name: getattr(new_goal, column.name)
				for column in new_goal.__table__.columns
			}
			record_id = new_goal.id

		if record_id is None:
			return

		for field, old_value in old_goal.items():
			if field not in new_snapshot:
				continue
			new_value = new_snapshot[field]
			if old_value != new_value:
				await self.log_update(
					"goals",
					record_id,
					actor,
					field,
					old_value,
					new_value,
					db,
					request_id=request_id,
				)

	async def get_audit_log(
		self,
		filters: AuditFilter,
		skip: int,
		limit: int,
		db: AsyncSession,
	) -> tuple[list[AuditLog], int]:
		repo = AuditRepository(db)
		return await repo.get_filtered(filters, skip=skip, limit=limit)


audit_service = AuditService()
