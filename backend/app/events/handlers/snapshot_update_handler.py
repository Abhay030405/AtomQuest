"""SnapshotUpdateHandler — the CQRS read-model updater.

Build plan §6.2 + §6.5. Subscribes to every write-side event that affects an
employee's quarterly snapshot:

  * ACHIEVEMENT_LOGGED        — new achievement row
  * ACHIEVEMENT_RESUBMITTED   — score / status may have moved
  * CHECKIN_COMPLETED         — flips ``checkin_done`` to True
  * SHARED_ACHIEVEMENT_SYNCED — recipient inherited a value from the source

For each event we recompute the (user, quarter, cycle) snapshot from the live
write-side tables and UPSERT into ``analytics_snapshots``. Execution is
**synchronous on the publisher's session** — the read model must be coherent
before the HTTP response returns.

Repos flush only; this handler must not commit.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AchievementStatus, GoalStatus, Quarter
from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events import checkin_events as ce
from app.events.event_bus import EventBus
from app.models.achievement import Achievement
from app.models.checkin import Checkin
from app.models.goal import Goal
from app.models.user import User
from app.repositories.analytics_snapshot_repository import AnalyticsSnapshotRepository
from app.utils.weighted_score_aggregator import WeightedScoreAggregator


logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Core recompute
# ---------------------------------------------------------------------------


async def _recompute_snapshot(
	db: AsyncSession,
	*,
	user_id: UUID,
	quarter: Quarter,
	cycle_id: UUID,
) -> None:
	"""Rebuild the snapshot row for one (user, quarter, cycle) from live tables."""
	# Resolve the user's manager + department for denormalised lookup columns.
	user_row = (
		await db.execute(
			select(User.manager_id, User.department_id).where(User.id == user_id)
		)
	).one_or_none()
	manager_id = user_row.manager_id if user_row else None
	department_id = user_row.department_id if user_row else None

	# All LOCKED goals for this user in this cycle.
	goals_stmt = (
		select(Goal)
		.where(Goal.user_id == user_id)
		.where(Goal.cycle_id == cycle_id)
		.where(Goal.status == GoalStatus.LOCKED)
		.where(Goal.is_deleted.is_(False))
	)
	goals = list((await db.execute(goals_stmt)).scalars().all())
	goals_total = len(goals)

	# Pull every achievement keyed by goal_id for this quarter, in one query.
	achievements: dict[UUID, Achievement] = {}
	if goals:
		ach_stmt = (
			select(Achievement)
			.where(Achievement.goal_id.in_([g.id for g in goals]))
			.where(Achievement.quarter == quarter)
			.where(Achievement.is_deleted.is_(False))
		)
		for ach in (await db.execute(ach_stmt)).scalars().all():
			achievements[ach.goal_id] = ach

	goals_submitted = len(achievements)
	goals_completed = sum(
		1
		for a in achievements.values()
		if a.status == AchievementStatus.COMPLETED
	)

	aggregator = WeightedScoreAggregator()
	for goal in goals:
		ach = achievements.get(goal.id)
		score = ach.computed_score if ach is not None else None
		aggregator.add(score, goal.weightage or Decimal("0"))

	weighted_score = aggregator.compute()

	# Check-in presence — only the manager↔employee pairing for this quarter.
	checkin_done = False
	if manager_id is not None:
		checkin_stmt = (
			select(Checkin.id)
			.where(Checkin.manager_id == manager_id)
			.where(Checkin.employee_id == user_id)
			.where(Checkin.quarter == quarter)
			.where(Checkin.cycle_id == cycle_id)
			.where(Checkin.is_deleted.is_(False))
		)
		checkin_done = (
			await db.execute(checkin_stmt)
		).scalar_one_or_none() is not None

	achievement_submitted = goals_submitted > 0

	repo = AnalyticsSnapshotRepository(db)
	await repo.upsert(
		{
			"user_id": user_id,
			"quarter": quarter,
			"cycle_id": cycle_id,
			"manager_id": manager_id,
			"department_id": department_id,
			"weighted_score": weighted_score,
			"goals_total": goals_total,
			"goals_submitted": goals_submitted,
			"goals_completed": goals_completed,
			"checkin_done": checkin_done,
			"achievement_submitted": achievement_submitted,
		}
	)


# ---------------------------------------------------------------------------
# Subscribers
# ---------------------------------------------------------------------------


async def on_achievement_logged(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _recompute_snapshot(
		db,
		user_id=event_data["user_id"],
		quarter=event_data["quarter"],
		cycle_id=event_data["cycle_id"],
	)


async def on_achievement_resubmitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _recompute_snapshot(
		db,
		user_id=event_data["user_id"],
		quarter=event_data["quarter"],
		cycle_id=event_data["cycle_id"],
	)


async def on_checkin_completed(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Snapshot is keyed on the EMPLOYEE — the manager's row is unaffected.
	await _recompute_snapshot(
		db,
		user_id=event_data["employee_id"],
		quarter=event_data["quarter"],
		cycle_id=event_data["cycle_id"],
	)


async def on_shared_achievement_synced(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Recipient user's snapshot must reflect their inherited achievement.
	await _recompute_snapshot(
		db,
		user_id=event_data["user_id"],
		quarter=event_data["quarter"],
		cycle_id=event_data["cycle_id"],
	)


def register(bus: EventBus) -> None:
	bus.subscribe(ae.ACHIEVEMENT_LOGGED, on_achievement_logged)
	bus.subscribe(ae.ACHIEVEMENT_RESUBMITTED, on_achievement_resubmitted)
	bus.subscribe(ce.CHECKIN_COMPLETED, on_checkin_completed)
	bus.subscribe(ae.SHARED_ACHIEVEMENT_SYNCED, on_shared_achievement_synced)
