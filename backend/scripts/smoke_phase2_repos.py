"""Smoke test for Phase 2 repositories — read-only.

Verifies that the three new repositories and the extended AuditRepository
can be instantiated, that their query construction is syntactically valid
against the live database, and that they return the expected types.

Run from the backend/ directory:
	python scripts/smoke_phase2_repos.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.constants import Quarter  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.cycle_config import CycleConfig  # noqa: E402
from app.models.goal import Goal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.repositories import (  # noqa: E402
	AchievementRepository,
	AnalyticsSnapshotRepository,
	AuditRepository,
	CheckinRepository,
)


_PLACEHOLDER_UUID = UUID("00000000-0000-0000-0000-000000000000")


async def main() -> int:
	async with AsyncSessionLocal() as session:
		# Resolve real IDs from the seeded DB; fall back to placeholders so
		# the queries still execute (returning empty results) on a fresh DB.
		any_goal = (await session.execute(select(Goal).limit(1))).scalar_one_or_none()
		any_user = (await session.execute(select(User).limit(1))).scalar_one_or_none()
		any_cycle = (await session.execute(select(CycleConfig).limit(1))).scalar_one_or_none()

		goal_id = any_goal.id if any_goal else _PLACEHOLDER_UUID
		user_id = any_user.id if any_user else _PLACEHOLDER_UUID
		manager_id = any_user.id if any_user else _PLACEHOLDER_UUID
		cycle_id = any_cycle.id if any_cycle else _PLACEHOLDER_UUID
		quarter = Quarter.Q1

		print(
			f"[setup] goal_id={goal_id} user_id={user_id} "
			f"cycle_id={cycle_id} quarter={quarter.value}"
		)

		# ── AchievementRepository ─────────────────────────────────────────
		ach_repo = AchievementRepository(session)
		one = await ach_repo.get_by_goal_and_quarter(goal_id, quarter)
		hist = await ach_repo.get_user_history(user_id)
		by_q = await ach_repo.get_by_user_quarter(user_id, quarter, cycle_id)
		print(
			f"[achievement] get_by_goal_and_quarter -> {one!r}, "
			f"history rows={len(hist)}, by_user_quarter rows={len(by_q)}"
		)

		# ── CheckinRepository ─────────────────────────────────────────────
		chk_repo = CheckinRepository(session)
		team = await chk_repo.get_team_checkins(manager_id, quarter, cycle_id)
		done, total = await chk_repo.get_completion_rate(manager_id, quarter, cycle_id)
		overdue = await chk_repo.get_overdue(quarter, cycle_id)
		print(
			f"[checkin] team rows={len(team)}, completion_rate={done}/{total}, "
			f"overdue rows={len(overdue)}"
		)

		# ── AnalyticsSnapshotRepository ───────────────────────────────────
		snap_repo = AnalyticsSnapshotRepository(session)
		snap = await snap_repo.get_by_user_quarter(user_id, quarter, cycle_id)
		team_snaps = await snap_repo.get_team_snapshots(manager_id, quarter, cycle_id)
		heatmap = await snap_repo.get_completion_heatmap(cycle_id)
		overdue_snaps = await snap_repo.get_overdue_users(quarter, cycle_id)
		print(
			f"[analytics] by_user_quarter -> {snap!r}, team rows={len(team_snaps)}, "
			f"heatmap rows={len(heatmap)}, overdue snaps={len(overdue_snaps)}"
		)

		# ── AuditRepository extension ─────────────────────────────────────
		audit_repo = AuditRepository(session)
		rows, total = await audit_repo.get_achievement_changes(
			user_id=user_id, quarter=quarter, skip=0, limit=10
		)
		all_rows, all_total = await audit_repo.get_achievement_changes(skip=0, limit=10)
		print(
			f"[audit] scoped rows={len(rows)}/{total}, "
			f"unscoped rows={len(all_rows)}/{all_total}"
		)

		print("ALL REPOS OK")
		return 0


if __name__ == "__main__":
	raise SystemExit(asyncio.run(main()))
