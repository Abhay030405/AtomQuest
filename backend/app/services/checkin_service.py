"""Check-in service — manager-led quarterly conversations.

Build-plan §4.2 (Manager Check-in Module) + §6.4 (CheckinCompletionTracker).

Every state-changing path is the same recipe used by AchievementService:

  1. Cycle guard          — ``cycle_service.require_open_window(db)``
  2. RBAC guard           — ``rbac_service.require_permission(role, perm)``
  3. Domain validation    — team membership, comment length, uniqueness
  4. Persistence          — repo flush only (no commit inside repos)
  5. CheckinEvent ledger  — ``CheckinRepository.create_event`` (immutable log)
  6. Event publication    — ``event_bus.publish(...)`` shares the same session
  7. Transaction commit   — service owns the commit at the end

Repos flush but never commit. Handlers run on the publisher's session and must
not commit either; a failing handler aborts the unit of work.

Reads:

  * ``get_team_status``      → reads ``analytics_snapshots`` (CQRS read model).
  * ``get_employee_detail``  → reads live tables (goals + achievements + checkin).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
	CheckinEventType,
	Permission,
	Quarter,
)
from app.core.exceptions import (
	CheckinNotFoundError,
	DuplicateCheckinError,
	ForbiddenError,
	InvalidCheckinCommentError,
	NotInTeamError,
)
from app.core.logging import get_logger
from app.events import checkin_events as ce
from app.events.event_bus import event_bus
from app.models.checkin import Checkin
from app.models.user import User
from app.repositories.achievement_repository import AchievementRepository
from app.repositories.analytics_snapshot_repository import AnalyticsSnapshotRepository
from app.repositories.checkin_repository import CheckinRepository
from app.repositories.goal_repository import GoalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.checkin import CheckinCreate, CheckinUpdate
from app.services.cycle_service import cycle_service
from app.services.rbac_service import rbac_service


logger = get_logger(__name__)


_MIN_COMMENT_LENGTH = 20


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


@dataclass
class _UpdateDiff:
	"""Captured before/after values for a checkin update."""

	old_comment: str
	new_comment: str
	old_comment_type: Any
	new_comment_type: Any
	old_sentiment: Any
	new_sentiment: Any
	old_goals_discussed: Optional[list[UUID]]
	new_goals_discussed: Optional[list[UUID]]
	edit_reason: str


class CheckinService:
	"""Stateless. Every method receives an ``AsyncSession`` and owns its commit."""

	# ------------------------------------------------------------------
	# Guards
	# ------------------------------------------------------------------

	def _assert_comment_length(self, comment: str | None) -> None:
		"""Defensive — Pydantic enforces min_length=20 but the service must
		never trust the schema layer for a ledger invariant."""
		if comment is None or len(comment.strip()) < _MIN_COMMENT_LENGTH:
			raise InvalidCheckinCommentError()

	async def _assert_employee_is_direct_report(
		self,
		manager_id: UUID,
		employee_id: UUID,
		db: AsyncSession,
	) -> None:
		user_repo = UserRepository(db)
		ok = await user_repo.is_in_team(manager_id, employee_id)
		if not ok:
			raise NotInTeamError()

	async def _load_checkin(self, db: AsyncSession, checkin_id: UUID) -> Checkin:
		repo = CheckinRepository(db)
		checkin = await repo.get(checkin_id)
		if checkin is None:
			raise CheckinNotFoundError()
		return checkin

	# ------------------------------------------------------------------
	# Create
	# ------------------------------------------------------------------

	async def create_checkin(
		self,
		current_user: User,
		data: CheckinCreate,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> Checkin:
		"""Manager creates a quarterly check-in for one of their direct reports.

		Order of checks: cycle window → RBAC → team membership → comment length →
		duplicate. ``UNIQUE(manager_id, employee_id, quarter, cycle_id)`` makes
		duplicates a 409 — we check explicitly so the client gets a clean error
		instead of an IntegrityError.
		"""
		await cycle_service.require_open_window(db)
		rbac_service.require_permission(current_user.role, Permission.CONDUCT_CHECKIN)
		await self._assert_employee_is_direct_report(
			current_user.id, data.employee_id, db
		)
		self._assert_comment_length(data.comment)

		repo = CheckinRepository(db)
		existing = await repo.get_by_manager_employee_quarter(
			current_user.id, data.employee_id, data.quarter, data.cycle_id
		)
		if existing is not None:
			raise DuplicateCheckinError()

		now = datetime.now(timezone.utc)
		checkin = await repo.create(
			{
				"manager_id": current_user.id,
				"employee_id": data.employee_id,
				"quarter": data.quarter,
				"cycle_id": data.cycle_id,
				"comment": data.comment,
				"comment_type": data.comment_type,
				"goals_discussed": data.goals_discussed,
				"overall_rating_sentiment": data.overall_rating_sentiment,
				"completed_at": now,
				"is_acknowledged_by_employee": False,
			}
		)

		# Append-only ledger row — mirrors the achievement-version pattern.
		await repo.create_event(
			checkin_id=checkin.id,
			event_type=CheckinEventType.CREATED,
			actor_id=current_user.id,
			payload={
				"comment_type": data.comment_type.value if data.comment_type else None,
				"sentiment": (
					data.overall_rating_sentiment.value
					if data.overall_rating_sentiment
					else None
				),
			},
		)

		await event_bus.publish(
			ce.CHECKIN_COMPLETED,
			{
				"checkin_id": checkin.id,
				"manager_id": current_user.id,
				"employee_id": data.employee_id,
				"quarter": data.quarter,
				"cycle_id": data.cycle_id,
				"comment_type": data.comment_type,
				"sentiment": data.overall_rating_sentiment,
				"occurred_at": now,
				"actor_id": current_user.id,
				"actor_role": current_user.role,
				"request_id": request_id,
			},
			db,
		)

		await db.commit()
		await db.refresh(checkin)
		logger.info(
			"checkin_created",
			checkin_id=str(checkin.id),
			manager_id=str(current_user.id),
			employee_id=str(data.employee_id),
			quarter=data.quarter.value,
		)
		return checkin

	# ------------------------------------------------------------------
	# Update
	# ------------------------------------------------------------------

	async def update_checkin(
		self,
		current_user: User,
		checkin_id: UUID,
		data: CheckinUpdate,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> Checkin:
		"""Manager amends an existing check-in inside the same cycle window.

		Only the original manager may edit. Writes an immutable ``UPDATED``
		row to ``checkin_events`` whose JSONB payload captures
		``old_comment`` / ``new_comment`` for the audit trail.
		"""
		await cycle_service.require_open_window(db)
		rbac_service.require_permission(current_user.role, Permission.EDIT_CHECKIN)

		checkin = await self._load_checkin(db, checkin_id)
		if checkin.manager_id != current_user.id:
			raise ForbiddenError()

		# Snapshot BEFORE mutation.
		diff = _UpdateDiff(
			old_comment=checkin.comment,
			new_comment=data.comment if data.comment is not None else checkin.comment,
			old_comment_type=checkin.comment_type,
			new_comment_type=(
				data.comment_type
				if data.comment_type is not None
				else checkin.comment_type
			),
			old_sentiment=checkin.overall_rating_sentiment,
			new_sentiment=(
				data.overall_rating_sentiment
				if data.overall_rating_sentiment is not None
				else checkin.overall_rating_sentiment
			),
			old_goals_discussed=checkin.goals_discussed,
			new_goals_discussed=(
				data.goals_discussed
				if data.goals_discussed is not None
				else checkin.goals_discussed
			),
			edit_reason=data.edit_reason,
		)
		# Service-layer guard: still must be >= 20 chars after merge.
		self._assert_comment_length(diff.new_comment)

		repo = CheckinRepository(db)
		updated = await repo.update(
			checkin,
			{
				"comment": diff.new_comment,
				"comment_type": diff.new_comment_type,
				"overall_rating_sentiment": diff.new_sentiment,
				"goals_discussed": diff.new_goals_discussed,
			},
		)

		now = datetime.now(timezone.utc)
		await repo.create_event(
			checkin_id=checkin.id,
			event_type=CheckinEventType.UPDATED,
			actor_id=current_user.id,
			payload={
				"old_comment": diff.old_comment,
				"new_comment": diff.new_comment,
				"edit_reason": diff.edit_reason,
			},
		)

		await event_bus.publish(
			ce.CHECKIN_UPDATED,
			{
				"checkin_id": checkin.id,
				"manager_id": checkin.manager_id,
				"employee_id": checkin.employee_id,
				"quarter": checkin.quarter,
				"cycle_id": checkin.cycle_id,
				"old_comment": diff.old_comment,
				"new_comment": diff.new_comment,
				"edit_reason": diff.edit_reason,
				"occurred_at": now,
				"actor_id": current_user.id,
				"actor_role": current_user.role,
				"request_id": request_id,
			},
			db,
		)

		await db.commit()
		await db.refresh(updated)
		return updated

	# ------------------------------------------------------------------
	# Acknowledge
	# ------------------------------------------------------------------

	async def acknowledge(
		self,
		current_user: User,
		checkin_id: UUID,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> Checkin:
		"""Employee acknowledges receipt of the check-in.

		RBAC restricts the permission to ``EMPLOYEE`` (+ ``ADMIN``); on top of
		that, only the *target* employee may acknowledge their own row — no
		acknowledging on someone else's behalf.
		"""
		rbac_service.require_permission(
			current_user.role, Permission.ACKNOWLEDGE_CHECKIN
		)

		checkin = await self._load_checkin(db, checkin_id)
		if checkin.employee_id != current_user.id:
			raise ForbiddenError()

		now = datetime.now(timezone.utc)
		repo = CheckinRepository(db)
		updated = await repo.update(
			checkin,
			{"is_acknowledged_by_employee": True, "acknowledged_at": now},
		)

		await repo.create_event(
			checkin_id=checkin.id,
			event_type=CheckinEventType.ACKNOWLEDGED,
			actor_id=current_user.id,
			payload={"acknowledged_at": now.isoformat()},
		)

		await event_bus.publish(
			ce.CHECKIN_ACKNOWLEDGED,
			{
				"checkin_id": checkin.id,
				"manager_id": checkin.manager_id,
				"employee_id": checkin.employee_id,
				"quarter": checkin.quarter,
				"cycle_id": checkin.cycle_id,
				"acknowledged_at": now,
				"actor_id": current_user.id,
				"actor_role": current_user.role,
				"request_id": request_id,
			},
			db,
		)

		await db.commit()
		await db.refresh(updated)
		return updated

	# ------------------------------------------------------------------
	# Reads
	# ------------------------------------------------------------------

	async def get_team_status(
		self,
		current_user: User,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> list[dict[str, Any]]:
		"""Manager dashboard. Reads ``analytics_snapshots`` — NOT live tables.

		The snapshot table is maintained by ``SnapshotUpdateHandler``. We sort
		rows with ``checkin_done=False`` at the top so the manager sees the
		work-still-to-do first.
		"""
		rbac_service.require_permission(current_user.role, Permission.CONDUCT_CHECKIN)
		snap_repo = AnalyticsSnapshotRepository(db)
		snapshots = await snap_repo.get_team_snapshots(
			current_user.id, quarter, cycle_id
		)

		rows: list[dict[str, Any]] = [
			{
				"employee_id": snap.user_id,
				"quarter": snap.quarter,
				"cycle_id": snap.cycle_id,
				"weighted_score": snap.weighted_score,
				"goals_total": snap.goals_total,
				"goals_submitted": snap.goals_submitted,
				"goals_completed": snap.goals_completed,
				"achievement_submitted": snap.achievement_submitted,
				"checkin_done": snap.checkin_done,
				"snapshot_generated_at": snap.snapshot_generated_at,
			}
			for snap in snapshots
		]
		# Pending check-ins surface at the top.
		rows.sort(key=lambda r: (r["checkin_done"], r["employee_id"]))
		return rows

	async def get_employee_detail(
		self,
		current_user: User,
		employee_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> dict[str, Any]:
		"""Detailed view for one direct report — reads live tables.

		Hierarchy check: only the employee's direct manager (or admin) may
		open this view. Returns goals + achievements + the existing check-in
		(if any) so the manager can fill the form with full context.
		"""
		rbac_service.require_permission(current_user.role, Permission.CONDUCT_CHECKIN)
		await self._assert_employee_is_direct_report(
			current_user.id, employee_id, db
		)

		user_repo = UserRepository(db)
		employee = await user_repo.get(employee_id)
		if employee is None:
			raise NotInTeamError()

		goal_repo = GoalRepository(db)
		goals = await goal_repo.get_by_user_and_cycle(employee_id, cycle_id)

		ach_repo = AchievementRepository(db)
		achievements = await ach_repo.get_by_user_quarter(
			employee_id, quarter, cycle_id
		)
		ach_by_goal = {a.goal_id: a for a in achievements}

		checkin_repo = CheckinRepository(db)
		existing = await checkin_repo.get_by_manager_employee_quarter(
			current_user.id, employee_id, quarter, cycle_id
		)

		return {
			"employee": {
				"id": employee.id,
				"full_name": employee.full_name,
				"email": employee.email,
				"role": employee.role,
				"manager_id": employee.manager_id,
			},
			"quarter": quarter,
			"cycle_id": cycle_id,
			"goals": [
				{
					"id": g.id,
					"title": g.title,
					"thrust_area": g.thrust_area,
					"uom_type": g.uom_type,
					"target_value": g.target_value,
					"target_date": g.target_date,
					"weightage": g.weightage,
					"status": g.status,
					"achievement": ach_by_goal.get(g.id),
				}
				for g in goals
			],
			"existing_checkin": existing,
		}


checkin_service = CheckinService()


__all__ = ["CheckinService", "checkin_service"]
