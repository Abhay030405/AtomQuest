"""Achievement service — the ledger.

Treat this module like a financial system. Every state-changing path follows
the same recipe:

  1. Cycle guard          — `cycle_service.require_open_window(db)`
  2. RBAC guard           — `rbac_service.require_permission(role, perm)`
  3. Domain validation    — goal exists, owned by user, locked, not shared-from
  4. Score computation    — `scoring_service.compute(...)` (pure, deterministic)
  5. Persistence          — repo flush only (no commit inside repos)
  6. Event publication    — `event_bus.publish(...)` shares the same session
  7. Transaction commit   — service owns the commit at the end

Repos flush but never commit. EventBus handlers run on the publisher's session
and must not commit either. If any handler raises, the caller's commit never
happens and the whole unit of work rolls back.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import (
	AchievementStatus,
	GoalStatus,
	Permission,
	Quarter,
	UoMType,
)
from app.core.exceptions import (
	AchievementNotFoundError,
	BulkValidationFailedError,
	DuplicateAchievementError,
	GoalNotFoundError,
	GoalNotLockedError,
	SharedGoalAchievementError,
)
from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events.event_bus import event_bus
from app.models.achievement import Achievement
from app.models.goal import Goal
from app.models.user import User
from app.repositories.achievement_repository import AchievementRepository
from app.schemas.achievement import (
	AchievementBulkCreate,
	AchievementCreate,
	AchievementResubmit,
)
from app.services.cycle_service import cycle_service
from app.services.rbac_service import rbac_service
from app.services.scoring_service import scoring_service


logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Bulk validation result types
# ---------------------------------------------------------------------------


@dataclass
class BulkRowError:
	"""Single failed row inside an atomic bulk submission."""

	index: int
	goal_id: Optional[UUID]
	code: str
	message: str

	def to_dict(self) -> dict[str, Any]:
		return {
			"index": self.index,
			"goal_id": str(self.goal_id) if self.goal_id else None,
			"code": self.code,
			"message": self.message,
		}


@dataclass
class ValidationResult:
	"""Outcome of validating a bulk submission before any writes.

	`is_valid` is True only when *all* rows pass. The service refuses to write
	anything unless `is_valid` is True — this is the atomic guarantee.
	"""

	is_valid: bool
	errors: list[BulkRowError] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class AchievementService:
	"""Stateless service. All state lives in the DB session passed per call."""

	# -- internals ----------------------------------------------------------

	async def _load_goal(self, db: AsyncSession, goal_id: UUID) -> Goal:
		stmt = (
			select(Goal)
			.where(Goal.id == goal_id)
			.where(Goal.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		goal = result.scalar_one_or_none()
		if goal is None:
			raise GoalNotFoundError()
		return goal

	def _assert_owner_can_log(self, goal: Goal, user: User) -> None:
		"""Ownership + lifecycle guard. Runs after the RBAC check."""
		if goal.user_id != user.id:
			raise GoalNotFoundError()  # don't leak existence
		if goal.status != GoalStatus.LOCKED:
			raise GoalNotLockedError()
		# Goals received via shared-goal cascade are managed by the upstream
		# owner; the receiver never logs achievements directly.
		if goal.source_shared_goal_id is not None:
			raise SharedGoalAchievementError()

	def _compute_score(
		self,
		goal: Goal,
		actual_value: Optional[Decimal],
		actual_date: Any,
		status: AchievementStatus,
	) -> tuple[Optional[Decimal], Optional[str]]:
		"""Return (computed_score, formula_used) or (None, None) if N/A.

		NOT_STARTED rows are placeholders — no score is recorded.
		"""
		if status == AchievementStatus.NOT_STARTED:
			return None, None

		if goal.uom_type == UoMType.TIMELINE:
			if goal.target_date is None:
				# Schema invariant violation; we'd rather not score than crash.
				return None, None
			result = scoring_service.compute(
				goal.uom_type, goal.target_date, actual_date
			)
		else:
			if actual_value is None or goal.target_value is None:
				return None, None
			result = scoring_service.compute(
				goal.uom_type, goal.target_value, actual_value
			)

		return result.score, result.formula_used

	def _snapshot_for_version(self, achievement: Achievement, edit_reason: str) -> dict[str, Any]:
		"""Capture the CURRENT row state before mutation (append-only history)."""
		return {
			"actual_value": achievement.actual_value,
			"actual_date": achievement.actual_date,
			"status": achievement.status,
			"computed_score": achievement.computed_score,
			"score_formula_used": achievement.score_formula_used,
			"submitted_at": achievement.submitted_at,
			"submitted_by": achievement.submitted_by,
			"edit_reason": edit_reason,
		}

	# -- public API ---------------------------------------------------------

	async def log_achievement(
		self,
		current_user: User,
		data: AchievementCreate,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> Achievement:
		"""First submission for (goal, quarter). 409 if one already exists."""
		await cycle_service.require_open_window(db)
		rbac_service.require_permission(current_user.role, Permission.LOG_ACHIEVEMENT)

		goal = await self._load_goal(db, data.goal_id)
		self._assert_owner_can_log(goal, current_user)

		repo = AchievementRepository(db)
		existing = await repo.get_by_goal_and_quarter(data.goal_id, data.quarter)
		if existing is not None:
			raise DuplicateAchievementError()

		score, formula = self._compute_score(
			goal, data.actual_value, data.actual_date, data.status
		)

		now = datetime.now(timezone.utc)
		payload: dict[str, Any] = {
			"actual_value": data.actual_value,
			"actual_date": data.actual_date,
			"status": data.status,
			"computed_score": score,
			"score_formula_used": formula,
			"submitted_at": now,
			"submitted_by": current_user.id,
			"is_synced_from_shared": False,
		}

		try:
			achievement = await repo.upsert(data.goal_id, data.quarter, payload)
		except IntegrityError as exc:
			# Racing duplicate insert — UNIQUE(goal_id, quarter) collision.
			await db.rollback()
			raise DuplicateAchievementError() from exc

		await event_bus.publish(
			ae.ACHIEVEMENT_LOGGED,
			{
				"achievement_id": achievement.id,
				"goal_id": goal.id,
				"user_id": current_user.id,
				"quarter": data.quarter,
				"cycle_id": goal.cycle_id,
				"status": data.status,
				"computed_score": score,
				"formula_used": formula,
				"occurred_at": now,
				"actor_id": current_user.id,
				"actor_role": current_user.role,
				"request_id": request_id,
			},
			db,
		)
		await db.commit()
		await db.refresh(achievement)
		return achievement

	async def resubmit(
		self,
		current_user: User,
		achievement_id: UUID,
		new_data: AchievementResubmit,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> Achievement:
		"""Versioned re-submission.

		Sequence (append-only ledger):
		  1. Snapshot CURRENT state into achievement_versions
		  2. Re-score with the new inputs
		  3. Update the live row
		  4. Publish ACHIEVEMENT_RESUBMITTED
		  5. Commit
		"""
		await cycle_service.require_open_window(db)
		rbac_service.require_permission(
			current_user.role, Permission.RESUBMIT_ACHIEVEMENT
		)

		repo = AchievementRepository(db)
		existing = await repo.get(achievement_id)
		if existing is None or existing.is_deleted:
			raise AchievementNotFoundError()

		goal = await self._load_goal(db, existing.goal_id)
		self._assert_owner_can_log(goal, current_user)

		# Step 1 — append the prior state to the version ledger BEFORE mutating.
		old_score = existing.computed_score
		snapshot = self._snapshot_for_version(existing, new_data.edit_reason)
		version = await repo.create_version(existing.id, snapshot)

		# Step 2 — recompute. Missing fields fall back to the existing row so a
		# resubmission can target a single field without nulling the others.
		merged_value = (
			new_data.actual_value
			if new_data.actual_value is not None
			else existing.actual_value
		)
		merged_date = (
			new_data.actual_date
			if new_data.actual_date is not None
			else existing.actual_date
		)
		merged_status = new_data.status if new_data.status is not None else existing.status
		score, formula = self._compute_score(goal, merged_value, merged_date, merged_status)

		# Step 3 — update the live row.
		now = datetime.now(timezone.utc)
		updates: dict[str, Any] = {
			"actual_value": merged_value,
			"actual_date": merged_date,
			"status": merged_status,
			"computed_score": score,
			"score_formula_used": formula,
			"submitted_at": now,
			"submitted_by": current_user.id,
		}
		updated = await repo.upsert(existing.goal_id, existing.quarter, updates)

		# Step 4 — emit event.
		await event_bus.publish(
			ae.ACHIEVEMENT_RESUBMITTED,
			{
				"achievement_id": updated.id,
				"goal_id": goal.id,
				"user_id": current_user.id,
				"quarter": updated.quarter,
				"cycle_id": goal.cycle_id,
				"version_number": version.version_number,
				"edit_reason": new_data.edit_reason,
				"status": merged_status,
				"old_score": old_score,
				"computed_score": score,
				"formula_used": formula,
				"occurred_at": now,
				"actor_id": current_user.id,
				"actor_role": current_user.role,
				"request_id": request_id,
			},
			db,
		)

		# Step 5 — commit.
		await db.commit()
		await db.refresh(updated)
		return updated

	async def bulk_log(
		self,
		current_user: User,
		data: AchievementBulkCreate,
		db: AsyncSession,
		*,
		request_id: Optional[str] = None,
	) -> list[Achievement]:
		"""ATOMIC bulk submission.

		Either every row is written and every event fires, or nothing is
		written at all and a `BulkValidationFailedError` is raised carrying the
		full per-row error list.
		"""
		await cycle_service.require_open_window(db)
		rbac_service.require_permission(current_user.role, Permission.LOG_ACHIEVEMENT)

		repo = AchievementRepository(db)

		# ------------- Phase 1: collect errors without writing -------------
		errors: list[BulkRowError] = []
		# Resolve goals & validate every row up front so we can fail fast.
		validated: list[tuple[int, Goal, AchievementCreate]] = []
		seen_keys: set[tuple[UUID, Quarter]] = set()

		for idx, row in enumerate(data.achievements):
			key = (row.goal_id, row.quarter)
			if key in seen_keys:
				errors.append(
					BulkRowError(
						idx, row.goal_id, "DUPLICATE_IN_BATCH",
						"Same (goal, quarter) appears twice in the batch.",
					)
				)
				continue
			seen_keys.add(key)

			try:
				goal = await self._load_goal(db, row.goal_id)
			except GoalNotFoundError:
				errors.append(
					BulkRowError(idx, row.goal_id, "GOAL_NOT_FOUND", "Goal not found.")
				)
				continue

			try:
				self._assert_owner_can_log(goal, current_user)
			except GoalNotFoundError:
				errors.append(
					BulkRowError(idx, row.goal_id, "GOAL_NOT_FOUND", "Goal not found.")
				)
				continue
			except GoalNotLockedError:
				errors.append(
					BulkRowError(
						idx, row.goal_id, "GOAL_NOT_LOCKED",
						"Goal must be locked before achievements can be logged.",
					)
				)
				continue
			except SharedGoalAchievementError:
				errors.append(
					BulkRowError(
						idx, row.goal_id, "MANAGED_BY_GOAL_OWNER",
						"Managed by the goal owner.",
					)
				)
				continue

			existing = await repo.get_by_goal_and_quarter(row.goal_id, row.quarter)
			if existing is not None:
				errors.append(
					BulkRowError(
						idx, row.goal_id, "DUPLICATE_ACHIEVEMENT",
						"An achievement already exists for this goal and quarter.",
					)
				)
				continue

			validated.append((idx, goal, row))

		if errors:
			# Nothing has been written yet — but we still issue a rollback to
			# clear any session-level state from the read-side queries above.
			await db.rollback()
			raise BulkValidationFailedError([e.to_dict() for e in errors])

		# ------------- Phase 2: write rows + publish events ----------------
		results: list[Achievement] = []
		now = datetime.now(timezone.utc)
		event_payloads: list[dict[str, Any]] = []

		try:
			for idx, goal, row in validated:
				score, formula = self._compute_score(
					goal, row.actual_value, row.actual_date, row.status
				)
				payload = {
					"actual_value": row.actual_value,
					"actual_date": row.actual_date,
					"status": row.status,
					"computed_score": score,
					"score_formula_used": formula,
					"submitted_at": now,
					"submitted_by": current_user.id,
					"is_synced_from_shared": False,
				}
				achievement = await repo.upsert(row.goal_id, row.quarter, payload)
				results.append(achievement)
				event_payloads.append(
					{
						"achievement_id": achievement.id,
						"goal_id": goal.id,
						"user_id": current_user.id,
						"quarter": row.quarter,
						"cycle_id": goal.cycle_id,
						"status": row.status,
						"computed_score": score,
						"formula_used": formula,
						"occurred_at": now,
						"actor_id": current_user.id,
						"actor_role": current_user.role,
						"request_id": request_id,
					}
				)

			# Publish AFTER all rows inserted so handlers see consistent state.
			for payload in event_payloads:
				await event_bus.publish(ae.ACHIEVEMENT_LOGGED, payload, db)

			await db.commit()
		except Exception:
			# Any failure inside phase 2 (DB integrity, handler raising) must
			# wipe the whole batch — atomic guarantee.
			await db.rollback()
			raise

		for achievement in results:
			await db.refresh(achievement)
		return results

	async def get_my_quarter(
		self,
		user_id: UUID,
		quarter: Quarter,
		cycle_id: UUID,
		db: AsyncSession,
	) -> dict[str, Any]:
		"""Return everything the UI needs to render one employee's quarter view.

		Shape::

		    {
		        "quarter": Quarter,
		        "cycle_id": UUID,
		        "window": {...cycle_service.get_window_status()},
		        "goals": [
		            {
		                "goal": Goal,
		                "achievement": Achievement | None,
		            },
		            ...
		        ],
		    }
		"""
		# All locked goals owned by this user in this cycle.
		stmt = (
			select(Goal)
			.where(Goal.user_id == user_id)
			.where(Goal.cycle_id == cycle_id)
			.where(Goal.status == GoalStatus.LOCKED)
			.where(Goal.is_deleted.is_(False))
			.order_by(Goal.id.asc())
		)
		goal_result = await db.execute(stmt)
		goals = list(goal_result.scalars().all())

		repo = AchievementRepository(db)
		entries: list[dict[str, Any]] = []
		for goal in goals:
			achievement = await repo.get_by_goal_and_quarter(goal.id, quarter)
			entries.append({"goal": goal, "achievement": achievement})

		window = await cycle_service.get_window_status(db)
		return {
			"quarter": quarter,
			"cycle_id": cycle_id,
			"window": window,
			"goals": entries,
		}

	async def get_user_history(
		self, user_id: UUID, db: AsyncSession
	) -> list[Achievement]:
		"""All achievements across all quarters/cycles for a user (QoQ display)."""
		repo = AchievementRepository(db)
		return await repo.get_user_history(user_id)


achievement_service = AchievementService()


__all__ = [
	"AchievementService",
	"BulkRowError",
	"ValidationResult",
	"achievement_service",
]
