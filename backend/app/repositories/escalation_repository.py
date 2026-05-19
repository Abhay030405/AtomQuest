from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.escalation import EscalationLog, EscalationLogStatus, EscalationRule


class EscalationRuleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, data: dict[str, Any]) -> EscalationRule:
        rule = EscalationRule(**data)
        self.session.add(rule)
        await self.session.flush()
        return rule

    async def get(self, rule_id: UUID) -> Optional[EscalationRule]:
        stmt = select(EscalationRule).where(
            EscalationRule.id == rule_id,
            EscalationRule.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_active(self) -> list[EscalationRule]:
        stmt = select(EscalationRule).where(
            EscalationRule.is_active.is_(True),
            EscalationRule.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[EscalationRule]:
        stmt = (
            select(EscalationRule)
            .where(EscalationRule.is_deleted.is_(False))
            .order_by(EscalationRule.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update(self, rule: EscalationRule, data: dict[str, Any]) -> EscalationRule:
        for key, value in data.items():
            setattr(rule, key, value)
        await self.session.flush()
        return rule

    async def soft_delete(self, rule: EscalationRule) -> None:
        rule.is_deleted = True
        await self.session.flush()


class EscalationLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, data: dict[str, Any]) -> EscalationLog:
        log = EscalationLog(**data)
        self.session.add(log)
        await self.session.flush()
        return log

    async def get_open_for_user_rule(
        self,
        rule_id: UUID,
        subject_user_id: UUID,
    ) -> list[EscalationLog]:
        """Return all open log rows for a (rule, subject_user) pair — used to
        decide whether to advance the chain or skip."""
        stmt = select(EscalationLog).where(
            EscalationLog.rule_id == rule_id,
            EscalationLog.subject_user_id == subject_user_id,
            EscalationLog.status == EscalationLogStatus.OPEN,
            EscalationLog.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_highest_open_level(
        self,
        rule_id: UUID,
        subject_user_id: UUID,
    ) -> Optional[EscalationLog]:
        """Return the most-advanced open log entry for a (rule, subject_user)."""
        stmt = (
            select(EscalationLog)
            .where(
                EscalationLog.rule_id == rule_id,
                EscalationLog.subject_user_id == subject_user_id,
                EscalationLog.status == EscalationLogStatus.OPEN,
                EscalationLog.is_deleted.is_(False),
            )
            .order_by(EscalationLog.chain_level.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def resolve_open_for_user_rule(
        self,
        rule_id: UUID,
        subject_user_id: UUID,
        resolved_at: datetime,
    ) -> int:
        """Bulk-mark all open entries as resolved.  Returns the row count."""
        stmt = (
            update(EscalationLog)
            .where(
                EscalationLog.rule_id == rule_id,
                EscalationLog.subject_user_id == subject_user_id,
                EscalationLog.status == EscalationLogStatus.OPEN,
                EscalationLog.is_deleted.is_(False),
            )
            .values(status=EscalationLogStatus.RESOLVED, resolved_at=resolved_at)
        )
        result = await self.session.execute(stmt)
        return result.rowcount  # type: ignore[return-value]

    async def list_logs(
        self,
        rule_id: Optional[UUID] = None,
        subject_user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[EscalationLog]:
        stmt = select(EscalationLog).where(EscalationLog.is_deleted.is_(False))
        if rule_id is not None:
            stmt = stmt.where(EscalationLog.rule_id == rule_id)
        if subject_user_id is not None:
            stmt = stmt.where(EscalationLog.subject_user_id == subject_user_id)
        if status is not None:
            stmt = stmt.where(EscalationLog.status == status)
        stmt = stmt.order_by(EscalationLog.notified_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
