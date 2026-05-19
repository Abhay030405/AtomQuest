"""Escalation Engine — the brain behind the Escalation Module.

This service is intentionally stateless: all methods accept an ``AsyncSession``
and read/write through repositories.  The scheduler (``escalation_scheduler.py``)
creates a fresh session for every periodic run; the API endpoint does the same
for the "Run Now" button.

Design principles
-----------------
* Rules are data, not code.  The engine reads ``escalation_rules`` rows and
  executes whatever chain is configured there.
* Additive only — no existing service is modified; this service reads from
  tables already maintained by goal_service / approval_service / checkin_tracker.
* Resolution is a first-class citizen.  ``resolve_for_user`` is called by
  goal_service (sheet submit) and approval_service (sheet approve) to close
  open log entries automatically.
"""

from __future__ import annotations

import string
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import GoalSheetStatus, NotificationType, Quarter, UserRole
from app.core.logging import get_logger
from app.models.cycle_config import CycleConfig
from app.models.escalation import EscalationLogStatus, EscalationRule
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.escalation_repository import (
    EscalationLogRepository,
    EscalationRuleRepository,
)
from app.repositories.user_repository import UserRepository
from app.schemas.escalation import EscalationRunResult
from app.services.checkin_completion_tracker import checkin_completion_tracker
from app.services.notification_service import NotificationService


logger = get_logger(__name__)

# Canonical trigger condition identifiers
TRIGGER_GOALS_NOT_SUBMITTED = "goals_not_submitted"
TRIGGER_MANAGER_APPROVAL_OVERDUE = "manager_approval_overdue"
TRIGGER_CHECKIN_NOT_COMPLETED = "checkin_not_completed"


class EscalationEngine:
    """Stateless escalation evaluator."""

    def __init__(self) -> None:
        self._notification_svc = NotificationService()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self, db: AsyncSession) -> EscalationRunResult:
        """Evaluate all active rules and fire pending notifications."""
        rule_repo = EscalationRuleRepository(db)
        rules = await rule_repo.get_all_active()
        total_sent = 0
        errors: list[str] = []

        for rule in rules:
            try:
                sent = await self._evaluate_rule(rule, db)
                total_sent += sent
            except Exception as exc:  # pragma: no cover
                msg = f"rule={rule.id} name={rule.name!r} error={exc}"
                logger.error("escalation_rule_error", detail=msg)
                errors.append(msg)

        logger.info(
            "escalation_run_complete",
            rules_evaluated=len(rules),
            notifications_sent=total_sent,
        )
        return EscalationRunResult(
            rules_evaluated=len(rules),
            notifications_sent=total_sent,
            errors=errors,
        )

    async def resolve_for_user(
        self,
        trigger_condition: str,
        subject_user_id: UUID,
        db: AsyncSession,
    ) -> None:
        """Mark all open escalation log entries for (trigger, user) as resolved.

        Called automatically when the underlying condition is fixed (e.g. the
        employee submits their goals, or the manager approves the sheet).
        """
        rule_repo = EscalationRuleRepository(db)
        log_repo = EscalationLogRepository(db)
        rules = await rule_repo.get_all_active()
        now = datetime.now(timezone.utc)

        for rule in rules:
            if rule.trigger_condition == trigger_condition:
                count = await log_repo.resolve_open_for_user_rule(rule.id, subject_user_id, now)
                if count:
                    logger.info(
                        "escalation_resolved",
                        trigger=trigger_condition,
                        subject_user_id=str(subject_user_id),
                        entries_closed=count,
                    )

    # ------------------------------------------------------------------
    # Rule evaluation dispatcher
    # ------------------------------------------------------------------

    async def _evaluate_rule(self, rule: EscalationRule, db: AsyncSession) -> int:
        if rule.trigger_condition == TRIGGER_GOALS_NOT_SUBMITTED:
            return await self._eval_goals_not_submitted(rule, db)
        if rule.trigger_condition == TRIGGER_MANAGER_APPROVAL_OVERDUE:
            return await self._eval_manager_approval_overdue(rule, db)
        if rule.trigger_condition == TRIGGER_CHECKIN_NOT_COMPLETED:
            return await self._eval_checkin_not_completed(rule, db)
        logger.warning("escalation_unknown_trigger", trigger=rule.trigger_condition)
        return 0

    # ------------------------------------------------------------------
    # Trigger: goals_not_submitted
    # ------------------------------------------------------------------

    async def _eval_goals_not_submitted(
        self, rule: EscalationRule, db: AsyncSession
    ) -> int:
        """Find employees who have not submitted their goal sheet N days after
        the active goal-setting window opened."""
        cycle = await self._get_active_goal_setting_cycle(db)
        if cycle is None:
            return 0

        now = datetime.now(timezone.utc)
        window_open = cycle.window_open
        if window_open.tzinfo is None:
            window_open = window_open.replace(tzinfo=timezone.utc)

        days_elapsed = (now - window_open).days
        if days_elapsed < rule.threshold_days:
            return 0

        user_repo = UserRepository(db)
        employees = await user_repo.get_all_employees()

        # Employees who HAVE submitted (any status except DRAFT is "submitted")
        submitted_user_ids = await self._submitted_user_ids_in_cycle(cycle.id, db)

        sent = 0
        for employee in employees:
            if employee.id in submitted_user_ids:
                continue
            trigger_fired_at = window_open
            manager_name: str | None = None
            if employee.manager_id:
                mgr = await user_repo.get(employee.manager_id)
                if mgr:
                    manager_name = mgr.full_name
            sent += await self._maybe_escalate(
                rule=rule,
                subject_user=employee,
                trigger_fired_at=trigger_fired_at,
                context={
                    "cycle_id": str(cycle.id),
                    "days_elapsed": days_elapsed,
                    "manager_name": manager_name,
                },
                cycle_id=cycle.id,
                db=db,
            )
        return sent

    # ------------------------------------------------------------------
    # Trigger: manager_approval_overdue
    # ------------------------------------------------------------------

    async def _eval_manager_approval_overdue(
        self, rule: EscalationRule, db: AsyncSession
    ) -> int:
        """Find managers who have pending sheets submitted more than N days ago."""
        now = datetime.now(timezone.utc)

        stmt = (
            select(GoalSheet)
            .where(
                GoalSheet.status.in_([GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW]),
                GoalSheet.submitted_at.isnot(None),
                GoalSheet.is_deleted.is_(False),
            )
        )
        result = await db.execute(stmt)
        pending_sheets = list(result.scalars().all())

        user_repo = UserRepository(db)
        sent = 0

        for sheet in pending_sheets:
            submitted_at = sheet.submitted_at
            if submitted_at.tzinfo is None:
                submitted_at = submitted_at.replace(tzinfo=timezone.utc)
            days_elapsed = (now - submitted_at).days
            if days_elapsed < rule.threshold_days:
                continue

            # Subject of this escalation is the manager, not the employee
            employee = await user_repo.get(sheet.user_id)
            if employee is None or employee.manager_id is None:
                continue
            manager = await user_repo.get(employee.manager_id)
            if manager is None:
                continue

            sent += await self._maybe_escalate(
                rule=rule,
                subject_user=manager,
                trigger_fired_at=submitted_at,
                context={
                    "sheet_id": str(sheet.id),
                    "employee_id": str(employee.id),
                    "employee_name": employee.full_name,
                    "days_elapsed": days_elapsed,
                },
                cycle_id=sheet.cycle_id,
                db=db,
            )
        return sent

    # ------------------------------------------------------------------
    # Trigger: checkin_not_completed
    # ------------------------------------------------------------------

    async def _eval_checkin_not_completed(
        self, rule: EscalationRule, db: AsyncSession
    ) -> int:
        """Find managers who have not filed check-ins for their reports during
        the active quarterly window."""
        cycle = await self._get_active_quarterly_cycle(db)
        if cycle is None:
            return 0

        quarter = self._cycle_to_quarter(cycle)
        if quarter is None:
            return 0

        now = datetime.now(timezone.utc)
        window_open = cycle.window_open
        if window_open.tzinfo is None:
            window_open = window_open.replace(tzinfo=timezone.utc)
        days_elapsed = (now - window_open).days
        if days_elapsed < rule.threshold_days:
            return 0

        # Use the CheckinCompletionTracker for the canonical "who is overdue" query
        overdue = await checkin_completion_tracker.get_overdue_users(quarter, cycle.id, db)
        user_repo = UserRepository(db)
        sent = 0

        for overdue_user in overdue:
            if overdue_user.manager_id is None:
                continue
            manager = await user_repo.get(overdue_user.manager_id)
            if manager is None:
                continue

            sent += await self._maybe_escalate(
                rule=rule,
                subject_user=manager,
                trigger_fired_at=window_open,
                context={
                    "employee_id": str(overdue_user.user_id),
                    "employee_name": overdue_user.full_name,
                    "quarter": quarter.value,
                    "days_elapsed": days_elapsed,
                },
                cycle_id=cycle.id,
                db=db,
            )
        return sent

    # ------------------------------------------------------------------
    # Core escalation logic
    # ------------------------------------------------------------------

    async def _maybe_escalate(
        self,
        rule: EscalationRule,
        subject_user: User,
        trigger_fired_at: datetime,
        context: dict,
        cycle_id: UUID | None,
        db: AsyncSession,
    ) -> int:
        """Decide which chain level to fire (if any) and send the notification."""
        log_repo = EscalationLogRepository(db)
        now = datetime.now(timezone.utc)

        # Always enrich context with the subject user's name so logs are readable
        context = {
            **context,
            "subject_user_name": subject_user.full_name,
            "subject_user_email": subject_user.email,
        }
        highest_log = await log_repo.get_highest_open_level(rule.id, subject_user.id)
        next_level = (highest_log.chain_level + 1) if highest_log is not None else 0

        chain: list[dict] = rule.escalation_chain  # type: ignore[assignment]

        # If we've exhausted all chain levels, nothing more to do
        if next_level >= len(chain):
            return 0

        # Check whether enough time has elapsed to fire the *next* level
        step = chain[next_level]
        required_delay = step.get("delay_days", 0)
        elapsed = (now - trigger_fired_at).days
        if elapsed < (rule.threshold_days + required_delay):
            return 0

        # Determine the recipient at this level
        recipient = await self._resolve_recipient(
            target=step["target"],
            subject_user=subject_user,
            db=db,
        )
        if recipient is None:
            logger.warning(
                "escalation_recipient_not_found",
                target=step["target"],
                subject_user_id=str(subject_user.id),
            )
            return 0

        # Render templates
        title = self._render(rule.notification_title_template, subject_user, context)
        body = self._render(rule.notification_body_template, subject_user, context)

        # Send the in-app notification
        await self._notification_svc.create_in_app(
            recipient_id=recipient.id,
            notification_type=NotificationType.WINDOW_OPENING,  # generic governance type
            title=title,
            body=body,
            db=db,
        )

        # Log the escalation
        await log_repo.create(
            {
                "rule_id": rule.id,
                "subject_user_id": subject_user.id,
                "notified_user_id": recipient.id,
                "chain_level": next_level,
                "trigger_fired_at": trigger_fired_at,
                "notified_at": now,
                "status": EscalationLogStatus.OPEN,
                "cycle_id": cycle_id,
                "context_data": context,
            }
        )

        logger.info(
            "escalation_fired",
            rule_id=str(rule.id),
            subject_user_id=str(subject_user.id),
            recipient_id=str(recipient.id),
            level=next_level,
            target=step["target"],
        )
        return 1

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _resolve_recipient(
        self,
        target: str,
        subject_user: User,
        db: AsyncSession,
    ) -> User | None:
        user_repo = UserRepository(db)
        if target == "self":
            return subject_user
        if target == "manager":
            if subject_user.manager_id is None:
                return None
            return await user_repo.get(subject_user.manager_id)
        if target == "hr":
            # Return the first active admin as the HR representative
            admins = await user_repo.get_users_with_role(UserRole.ADMIN)
            return admins[0] if admins else None
        return None

    @staticmethod
    def _render(template: str, user: User, context: dict) -> str:
        """Safe string interpolation using only known keys."""
        safe_context = {
            "full_name": user.full_name,
            "email": user.email,
            **{k: str(v) for k, v in context.items()},
        }
        try:
            return string.Formatter().vformat(template, (), safe_context)
        except (KeyError, ValueError):
            return template

    @staticmethod
    async def _get_active_goal_setting_cycle(db: AsyncSession) -> CycleConfig | None:
        from app.core.constants import CyclePhase

        stmt = select(CycleConfig).where(
            CycleConfig.is_active.is_(True),
            CycleConfig.phase == CyclePhase.GOAL_SETTING,
            CycleConfig.is_deleted.is_(False),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_active_quarterly_cycle(db: AsyncSession) -> CycleConfig | None:
        from app.core.constants import CyclePhase

        quarterly_phases = {CyclePhase.Q1, CyclePhase.Q2, CyclePhase.Q3, CyclePhase.Q4}
        stmt = select(CycleConfig).where(
            CycleConfig.is_active.is_(True),
            CycleConfig.phase.in_(quarterly_phases),
            CycleConfig.is_deleted.is_(False),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _cycle_to_quarter(cycle: CycleConfig) -> Quarter | None:
        from app.core.constants import CyclePhase

        mapping = {
            CyclePhase.Q1: Quarter.Q1,
            CyclePhase.Q2: Quarter.Q2,
            CyclePhase.Q3: Quarter.Q3,
            CyclePhase.Q4: Quarter.Q4,
        }
        return mapping.get(cycle.phase)

    @staticmethod
    async def _submitted_user_ids_in_cycle(cycle_id: UUID, db: AsyncSession) -> set[UUID]:
        stmt = select(GoalSheet.user_id).where(
            GoalSheet.cycle_id == cycle_id,
            GoalSheet.status.in_(
                [GoalSheetStatus.SUBMITTED, GoalSheetStatus.UNDER_REVIEW, GoalSheetStatus.APPROVED]
            ),
            GoalSheet.is_deleted.is_(False),
        )
        result = await db.execute(stmt)
        return set(result.scalars().all())


escalation_engine = EscalationEngine()

__all__ = ["EscalationEngine", "escalation_engine", "TRIGGER_GOALS_NOT_SUBMITTED",
           "TRIGGER_MANAGER_APPROVAL_OVERDUE", "TRIGGER_CHECKIN_NOT_COMPLETED"]
