"""SharedGoalSyncService — propagate a source achievement to every recipient.

Build plan §6.3. Triggered indirectly by ``SharedGoalSyncHandler`` after the
source owner logs / resubmits an achievement on a shared goal. For each
recipient goal we either:

  * INSERT a new ``achievements`` row mirroring the source, or
  * SNAPSHOT the existing row into ``achievement_versions`` and UPDATE it.

The recipient's score is recomputed against the recipient's own
``target_value`` / ``target_date`` and ``uom_type`` (which mirror the source
at goal-creation time, but may legitimately drift if an admin edits one side
mid-cycle — the score is always derived from the recipient row).

After each upsert we publish ``SHARED_ACHIEVEMENT_SYNCED`` so that
``SnapshotUpdateHandler`` rebuilds the recipient's analytics snapshot. No
notifications are sent — sync is silent per spec.

This service does NOT commit. It runs on the publisher's session and the
parent service (``AchievementService``) owns the commit.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AchievementStatus, Quarter, UoMType
from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events.event_bus import event_bus
from app.models.achievement import Achievement
from app.models.goal import Goal
from app.models.user import User
from app.repositories.achievement_repository import AchievementRepository
from app.services.scoring_service import scoring_service


logger = get_logger(__name__)


def _snapshot_for_version(achievement: Achievement, edit_reason: str) -> dict[str, Any]:
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


def _compute_recipient_score(
	recipient_goal: Goal,
	actual_value: Optional[Decimal],
	actual_date: Any,
	status: AchievementStatus,
) -> tuple[Optional[Decimal], Optional[str]]:
	if status == AchievementStatus.NOT_STARTED:
		return None, None
	if recipient_goal.uom_type == UoMType.TIMELINE:
		if recipient_goal.target_date is None:
			return None, None
		result = scoring_service.compute(
			recipient_goal.uom_type, recipient_goal.target_date, actual_date
		)
	else:
		if actual_value is None or recipient_goal.target_value is None:
			return None, None
		result = scoring_service.compute(
			recipient_goal.uom_type, recipient_goal.target_value, actual_value
		)
	return result.score, result.formula_used


class SharedGoalSyncService:
	"""Stateless. Caller owns the session and commit."""

	async def sync_achievement(
		self,
		*,
		source_goal_id: UUID,
		quarter: Quarter,
		actor_id: UUID,
		actor_role: Any,
		db: AsyncSession,
		request_id: str | None = None,
	) -> list[Achievement]:
		"""Mirror the source achievement onto every recipient goal.

		Returns the list of recipient achievement rows that were written
		(both newly inserted and updated). Empty list when the source has
		no recipients (defensive — handler already screens for this).
		"""
		repo = AchievementRepository(db)

		# 1. Source achievement must exist; without it there's nothing to mirror.
		source_ach = await repo.get_by_goal_and_quarter(source_goal_id, quarter)
		if source_ach is None:
			logger.warning(
				"shared_sync_no_source_achievement",
				source_goal_id=str(source_goal_id),
				quarter=quarter.value if hasattr(quarter, "value") else str(quarter),
			)
			return []

		# 2. Find every recipient goal — the inverse of source_shared_goal_id.
		recipient_stmt = (
			select(Goal)
			.where(Goal.source_shared_goal_id == source_goal_id)
			.where(Goal.is_deleted.is_(False))
		)
		recipients = list((await db.execute(recipient_stmt)).scalars().all())
		if not recipients:
			return []

		# 3. Resolve source user (for the event payload — actor may differ).
		source_user_id = (
			await db.execute(select(Goal.user_id).where(Goal.id == source_goal_id))
		).scalar_one()

		now = datetime.now(timezone.utc)
		written: list[Achievement] = []

		for recipient_goal in recipients:
			existing = await repo.get_by_goal_and_quarter(recipient_goal.id, quarter)
			is_new = existing is None

			# Snapshot prior recipient state into the version ledger BEFORE
			# mutating — preserves the append-only invariant.
			if existing is not None:
				snapshot = _snapshot_for_version(
					existing,
					f"Auto-synced from source goal {source_goal_id}",
				)
				await repo.create_version(existing.id, snapshot)

			score, formula = _compute_recipient_score(
				recipient_goal,
				source_ach.actual_value,
				source_ach.actual_date,
				source_ach.status,
			)
			payload: dict[str, Any] = {
				"actual_value": source_ach.actual_value,
				"actual_date": source_ach.actual_date,
				"status": source_ach.status,
				"computed_score": score,
				"score_formula_used": formula,
				"submitted_at": now,
				"submitted_by": actor_id,
				"is_synced_from_shared": True,
			}
			recipient_ach = await repo.upsert(recipient_goal.id, quarter, payload)
			written.append(recipient_ach)

			# Resolve recipient owner — needed for the event payload.
			recipient_user_id = (
				await db.execute(
					select(Goal.user_id).where(Goal.id == recipient_goal.id)
				)
			).scalar_one()

			await event_bus.publish(
				ae.SHARED_ACHIEVEMENT_SYNCED,
				{
					"achievement_id": recipient_ach.id,
					"goal_id": recipient_goal.id,
					"user_id": recipient_user_id,
					"quarter": quarter,
					"cycle_id": recipient_goal.cycle_id,
					"source_achievement_id": source_ach.id,
					"source_goal_id": source_goal_id,
					"source_user_id": source_user_id,
					"is_new": is_new,
					"status": source_ach.status,
					"computed_score": score,
					"formula_used": formula,
					"occurred_at": now,
					"actor_id": actor_id,
					"actor_role": actor_role,
					"request_id": request_id,
				},
				db,
			)

		return written


shared_goal_sync_service = SharedGoalSyncService()


__all__ = ["SharedGoalSyncService", "shared_goal_sync_service"]
