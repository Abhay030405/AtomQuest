from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import AuditAction, GoalEventType, Quarter, UserRole
from app.models.achievement import Achievement
from app.models.audit_log import AuditLog
from app.models.goal import Goal
from app.models.goal_event import GoalEvent
from app.repositories.base_repository import BaseRepository
from app.schemas.audit import AuditFilter


class AuditRepository(BaseRepository[AuditLog]):
	def __init__(self, session: AsyncSession) -> None:
		super().__init__(session, AuditLog)

	async def log(
		self,
		table_name: str,
		record_id: UUID,
		action: AuditAction,
		actor_id: UUID,
		actor_role: UserRole,
		field_name: Optional[str] = None,
		old_value: Optional[str] = None,
		new_value: Optional[str] = None,
		ip_address: Optional[str] = None,
		request_id: Optional[str] = None,
	) -> AuditLog:
		entry = AuditLog(
			table_name=table_name,
			record_id=record_id,
			action=action,
			field_name=field_name,
			old_value=old_value,
			new_value=new_value,
			actor_id=actor_id,
			actor_role=actor_role,
			ip_address=ip_address,
			request_id=request_id,
		)
		self.session.add(entry)
		await self.session.flush()
		return entry

	async def get_filtered(self, filters: AuditFilter, skip: int = 0, limit: int = 50) -> tuple[list[AuditLog], int]:
		stmt = select(AuditLog).options(selectinload(AuditLog.actor))

		if filters.post_lock_only:
			stmt = stmt.join(
				GoalEvent,
				and_(
					AuditLog.table_name == "goals",
					AuditLog.record_id == GoalEvent.goal_id,
					GoalEvent.event_type == GoalEventType.GOAL_LOCKED,
					AuditLog.changed_at > GoalEvent.occurred_at,
				),
			)

		if filters.date_from:
			stmt = stmt.where(AuditLog.changed_at >= filters.date_from)
		if filters.date_to:
			stmt = stmt.where(AuditLog.changed_at <= filters.date_to)
		if filters.actor_id:
			stmt = stmt.where(AuditLog.actor_id == filters.actor_id)
		if filters.table_name:
			stmt = stmt.where(AuditLog.table_name == filters.table_name)
		if filters.action:
			stmt = stmt.where(AuditLog.action == filters.action)

		count_stmt = select(func.count()).select_from(stmt.subquery())
		total_result = await self.session.execute(count_stmt)
		total = int(total_result.scalar_one())

		stmt = stmt.order_by(AuditLog.changed_at.desc()).offset(skip).limit(limit)
		result = await self.session.execute(stmt)
		return list(result.scalars().all()), total

	async def get_by_record(self, table_name: str, record_id: UUID) -> list[AuditLog]:
		stmt = (
			select(AuditLog)
			.where(AuditLog.table_name == table_name, AuditLog.record_id == record_id)
			.order_by(AuditLog.changed_at.desc())
		)
		result = await self.session.execute(stmt)
		return list(result.scalars().all())

	async def get_achievement_changes(
		self,
		user_id: Optional[UUID] = None,
		quarter: Optional[Quarter] = None,
		date_from: Optional[datetime] = None,
		date_to: Optional[datetime] = None,
		skip: int = 0,
		limit: int = 50,
	) -> tuple[list[AuditLog], int]:
		"""Audit-log slice scoped to achievement edits.

		Matches the existing `get_filtered` pattern: returns
		`(rows, total)` with offset/limit pagination. Filters rows whose
		`table_name` is `achievements` or `achievement_versions`.

		`user_id` and `quarter` filter by joining `achievements` →
		`goals` to resolve ownership and quarter scope. Rows targeting
		`achievement_versions` are resolved via the same chain.
		"""
		base = select(AuditLog).options(selectinload(AuditLog.actor)).where(
			AuditLog.table_name.in_(("achievements", "achievement_versions"))
		)

		if date_from is not None:
			base = base.where(AuditLog.changed_at >= date_from)
		if date_to is not None:
			base = base.where(AuditLog.changed_at <= date_to)

		if user_id is not None or quarter is not None:
			# Join Achievement on record_id (works for table_name='achievements')
			base = base.join(
				Achievement,
				and_(
					AuditLog.table_name == "achievements",
					AuditLog.record_id == Achievement.id,
				),
			).join(Goal, Achievement.goal_id == Goal.id)
			if user_id is not None:
				base = base.where(Goal.user_id == user_id)
			if quarter is not None:
				base = base.where(Achievement.quarter == quarter)

		count_stmt = select(func.count()).select_from(base.subquery())
		total_result = await self.session.execute(count_stmt)
		total = int(total_result.scalar_one())

		stmt = base.order_by(AuditLog.changed_at.desc()).offset(skip).limit(limit)
		result = await self.session.execute(stmt)
		return list(result.scalars().all()), total
