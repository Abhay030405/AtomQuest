"""Integration tests for AchievementService — the ledger.

These tests exercise the real DB, real EventBus, and real ORM session. The
production handlers are detached (event_bus.clear()) and replaced with a
recording handler so each test asserts the exact event payload.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select

from app.core.constants import (
	AchievementStatus,
	GoalStatus,
	Quarter,
	UoMType,
	UserRole,
)
from app.core.database import AsyncSessionLocal
from app.core.exceptions import (
	BulkValidationFailedError,
	DuplicateAchievementError,
	ForbiddenError,
	GoalNotLockedError,
	SharedGoalAchievementError,
	WindowClosedError,
)
from app.events import achievement_events as ae
from app.events.event_bus import event_bus
from app.models.achievement import Achievement
from app.models.achievement_version import AchievementVersion
from app.models.cycle_config import CycleConfig
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.schemas.achievement import (
	AchievementBulkCreate,
	AchievementCreate,
	AchievementResubmit,
)
from app.services.achievement_service import achievement_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _record() -> tuple[list[dict[str, Any]], Any, Any]:
	"""Reset bus and install recorders for LOGGED + RESUBMITTED."""
	event_bus.clear()
	logged: list[dict[str, Any]] = []
	resubmitted: list[dict[str, Any]] = []

	async def on_logged(data, db):
		logged.append(dict(data))

	async def on_resubmitted(data, db):
		resubmitted.append(dict(data))

	event_bus.subscribe(ae.ACHIEVEMENT_LOGGED, on_logged)
	event_bus.subscribe(ae.ACHIEVEMENT_RESUBMITTED, on_resubmitted)
	return logged, resubmitted, (on_logged, on_resubmitted)


async def _make_user(db, role: UserRole = UserRole.EMPLOYEE) -> User:
	user = User(
		email=f"ach_test_{uuid.uuid4().hex[:8]}@test.local",
		full_name="Achievement Test User",
		hashed_password="!",
		role=role,
		is_active=True,
	)
	db.add(user)
	await db.flush()
	return user


async def _make_open_cycle(db) -> CycleConfig:
	cycle = CycleConfig(
		cycle_name=f"AchTestCycle-{uuid.uuid4().hex[:6]}",
		phase="goal_setting",
		window_open=datetime.now(timezone.utc) - timedelta(days=1),
		window_close=datetime.now(timezone.utc) + timedelta(days=14),
		is_active=True,
	)
	# Only one active cycle allowed — deactivate any existing active one first.
	rows = (await db.execute(select(CycleConfig).where(CycleConfig.is_active.is_(True)))).scalars().all()
	for existing in rows:
		existing.is_active = False
	db.add(cycle)
	await db.flush()
	return cycle


async def _make_locked_goal(
	db,
	*,
	user: User,
	cycle: CycleConfig,
	sheet: GoalSheet,
	uom: UoMType = UoMType.MIN,
	target_value: Decimal | None = Decimal("100"),
	target_date: date | None = None,
	source_shared_goal_id=None,
) -> Goal:
	goal = Goal(
		user_id=user.id,
		goal_sheet_id=sheet.id,
		cycle_id=cycle.id,
		title="Achievement Test Goal",
		description="x",
		thrust_area="revenue_growth",
		uom_type=uom,
		target_value=target_value,
		target_date=target_date,
		weightage=Decimal("100"),
		status=GoalStatus.LOCKED,
		is_shared=False,
		source_shared_goal_id=source_shared_goal_id,
	)
	db.add(goal)
	await db.flush()
	return goal


async def _make_sheet(db, user: User, cycle: CycleConfig) -> GoalSheet:
	sheet = GoalSheet(user_id=user.id, cycle_id=cycle.id)
	db.add(sheet)
	await db.flush()
	return sheet


async def _cleanup(db, *, user: User, cycle: CycleConfig | None = None) -> None:
	"""Best-effort cleanup. Tests must not leak rows across runs."""
	await db.execute(
		AchievementVersion.__table__.delete().where(
			AchievementVersion.achievement_id.in_(
				select(Achievement.id).join(Goal).where(Goal.user_id == user.id)
			)
		)
	)
	await db.execute(
		Achievement.__table__.delete().where(
			Achievement.goal_id.in_(select(Goal.id).where(Goal.user_id == user.id))
		)
	)
	await db.execute(Goal.__table__.delete().where(Goal.user_id == user.id))
	await db.execute(GoalSheet.__table__.delete().where(GoalSheet.user_id == user.id))
	await db.execute(User.__table__.delete().where(User.id == user.id))
	if cycle is not None:
		await db.execute(CycleConfig.__table__.delete().where(CycleConfig.id == cycle.id))
	await db.commit()


# ---------------------------------------------------------------------------
# 1. Full happy path — log → score → event
# ---------------------------------------------------------------------------


async def test_log_achievement_full_flow():
	logged, _, _ = _record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		await db.commit()

		data = AchievementCreate(
			goal_id=goal.id,
			quarter=Quarter.Q1,
			actual_value=Decimal("85"),
			status=AchievementStatus.ON_TRACK,
		)
		result = await achievement_service.log_achievement(user, data, db)

		assert result.computed_score == Decimal("0.85")
		assert result.score_formula_used == "score = actual_value / target_value"
		assert result.submitted_by == user.id
		assert result.is_synced_from_shared is False
		assert len(logged) == 1
		ev = logged[0]
		assert ev["achievement_id"] == result.id
		assert ev["goal_id"] == goal.id
		assert ev["user_id"] == user.id
		assert ev["computed_score"] == Decimal("0.85")
		assert ev["formula_used"] == "score = actual_value / target_value"
		assert ev["actor_id"] == user.id
		assert ev["actor_role"] == UserRole.EMPLOYEE
		assert ev["request_id"] is None

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 2. Resubmit — version row appended, score recomputed, event fired
# ---------------------------------------------------------------------------


async def test_resubmit_appends_version_and_recomputes():
	logged, resubmitted, _ = _record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		await db.commit()

		initial = await achievement_service.log_achievement(
			user,
			AchievementCreate(
				goal_id=goal.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("50"),
				status=AchievementStatus.ON_TRACK,
			),
			db,
		)
		assert initial.computed_score == Decimal("0.5")

		updated = await achievement_service.resubmit(
			user,
			initial.id,
			AchievementResubmit(
				actual_value=Decimal("120"),
				status=AchievementStatus.COMPLETED,
				edit_reason="Corrected reporting period totals",
			),
			db,
			request_id="req-abc",
		)

		assert updated.id == initial.id
		assert updated.actual_value == Decimal("120")
		assert updated.computed_score == Decimal("1.20")
		assert updated.status == AchievementStatus.COMPLETED

		# Append-only version ledger has exactly one row capturing the OLD state.
		versions = (
			await db.execute(
				select(AchievementVersion).where(
					AchievementVersion.achievement_id == updated.id
				)
			)
		).scalars().all()
		assert len(versions) == 1
		v = versions[0]
		assert v.version_number == 1
		assert v.actual_value == Decimal("50.0000")
		assert v.computed_score == Decimal("0.5000")
		assert v.edit_reason == "Corrected reporting period totals"

		assert len(logged) == 1  # only the original log
		assert len(resubmitted) == 1
		ev = resubmitted[0]
		assert ev["version_number"] == 1
		assert ev["old_score"] == Decimal("0.5")
		assert ev["computed_score"] == Decimal("1.20")
		assert ev["request_id"] == "req-abc"

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 3. Window closed → 403 WindowClosedError
# ---------------------------------------------------------------------------


async def test_window_closed_blocks_log():
	_record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		# Slam the window shut.
		cycle.window_close = datetime.now(timezone.utc) - timedelta(hours=1)
		cycle.window_open = datetime.now(timezone.utc) - timedelta(days=10)
		await db.commit()

		with pytest.raises(WindowClosedError) as excinfo:
			await achievement_service.log_achievement(
				user,
				AchievementCreate(
					goal_id=goal.id,
					quarter=Quarter.Q1,
					actual_value=Decimal("50"),
					status=AchievementStatus.ON_TRACK,
				),
				db,
			)
		assert excinfo.value.code == "WINDOW_CLOSED"
		assert excinfo.value.status_code == 403

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 4. Received shared goal → 403 MANAGED_BY_GOAL_OWNER
# ---------------------------------------------------------------------------


async def test_shared_goal_receiver_cannot_log():
	_record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		# Source goal owned by anyone — only its id matters for the FK.
		source_goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		# Received copy: source_shared_goal_id points at the upstream.
		received = await _make_locked_goal(
			db,
			user=user,
			cycle=cycle,
			sheet=sheet,
			source_shared_goal_id=source_goal.id,
		)
		await db.commit()

		with pytest.raises(SharedGoalAchievementError) as excinfo:
			await achievement_service.log_achievement(
				user,
				AchievementCreate(
					goal_id=received.id,
					quarter=Quarter.Q1,
					actual_value=Decimal("10"),
					status=AchievementStatus.ON_TRACK,
				),
				db,
			)
		assert excinfo.value.code == "MANAGED_BY_GOAL_OWNER"
		assert excinfo.value.status_code == 403

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 5. Bulk all valid — atomic success, 3 rows + 3 events
# ---------------------------------------------------------------------------


async def test_bulk_all_valid_atomic_success():
	logged, _, _ = _record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		g1 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		g2 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		g3 = await _make_locked_goal(
			db, user=user, cycle=cycle, sheet=sheet,
			uom=UoMType.ZERO, target_value=Decimal("0"),
		)
		await db.commit()

		bulk = AchievementBulkCreate(
			achievements=[
				AchievementCreate(
					goal_id=g1.id, quarter=Quarter.Q1,
					actual_value=Decimal("100"),
					status=AchievementStatus.COMPLETED,
				),
				AchievementCreate(
					goal_id=g2.id, quarter=Quarter.Q1,
					actual_value=Decimal("75"),
					status=AchievementStatus.ON_TRACK,
				),
				AchievementCreate(
					goal_id=g3.id, quarter=Quarter.Q1,
					actual_value=Decimal("0"),
					status=AchievementStatus.COMPLETED,
				),
			]
		)
		results = await achievement_service.bulk_log(user, bulk, db)
		assert len(results) == 3
		assert {r.goal_id for r in results} == {g1.id, g2.id, g3.id}
		assert len(logged) == 3

		# Confirm rows are persisted (commit happened).
		count = (
			await db.execute(
				select(Achievement).where(Achievement.goal_id.in_([g1.id, g2.id, g3.id]))
			)
		).scalars().all()
		assert len(count) == 3

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 6. Bulk with one invalid row — full rollback, zero rows persisted
# ---------------------------------------------------------------------------


async def test_bulk_one_invalid_rolls_back_all():
	logged, _, _ = _record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		g1 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		g2 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		# Third goal belongs to a DIFFERENT user → ownership check fails.
		stranger = await _make_user(db)
		stranger_sheet = await _make_sheet(db, stranger, cycle)
		g_stranger = await _make_locked_goal(
			db, user=stranger, cycle=cycle, sheet=stranger_sheet
		)
		await db.commit()
		# Capture IDs BEFORE any rollback so we can query post-failure without
		# tripping lazy-attribute reloads on expired ORM objects.
		g1_id, g2_id, g_stranger_id = g1.id, g2.id, g_stranger.id
		user_id, stranger_id, cycle_id = user.id, stranger.id, cycle.id

		bulk = AchievementBulkCreate(
			achievements=[
				AchievementCreate(
					goal_id=g1_id, quarter=Quarter.Q1,
					actual_value=Decimal("90"),
					status=AchievementStatus.COMPLETED,
				),
				AchievementCreate(
					goal_id=g2_id, quarter=Quarter.Q1,
					actual_value=Decimal("60"),
					status=AchievementStatus.ON_TRACK,
				),
				AchievementCreate(
					goal_id=g_stranger_id, quarter=Quarter.Q1,
					actual_value=Decimal("10"),
					status=AchievementStatus.ON_TRACK,
				),
			]
		)
		with pytest.raises(BulkValidationFailedError) as excinfo:
			await achievement_service.bulk_log(user, bulk, db)

		# Error list points at the offending row.
		errs = excinfo.value.errors
		assert any(e["code"] == "GOAL_NOT_FOUND" and e["index"] == 2 for e in errs)
		# NOTHING was persisted.
		surviving = (
			await db.execute(
				select(Achievement).where(
					Achievement.goal_id.in_([g1_id, g2_id, g_stranger_id])
				)
			)
		).scalars().all()
		assert surviving == []
		assert logged == []

		# After the service's rollback, all ORM objects are expired. Use a
		# fresh session for cleanup so we can re-resolve by captured IDs.
		await db.close()
		async with AsyncSessionLocal() as db2:
			user = (await db2.execute(select(User).where(User.id == user_id))).scalar_one()
			stranger = (await db2.execute(select(User).where(User.id == stranger_id))).scalar_one()
			cycle = (await db2.execute(select(CycleConfig).where(CycleConfig.id == cycle_id))).scalar_one()
			# Both users share the cycle — clean stranger first WITHOUT the cycle,
			# then clean owner WITH the cycle.
			await _cleanup(db2, user=stranger)
			await _cleanup(db2, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 7. Duplicate (goal_id, quarter) — second log_achievement raises 409
# ---------------------------------------------------------------------------


async def test_duplicate_log_raises_409():
	_record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		await db.commit()

		data = AchievementCreate(
			goal_id=goal.id,
			quarter=Quarter.Q1,
			actual_value=Decimal("50"),
			status=AchievementStatus.ON_TRACK,
		)
		await achievement_service.log_achievement(user, data, db)

		with pytest.raises(DuplicateAchievementError) as excinfo:
			await achievement_service.log_achievement(user, data, db)
		assert excinfo.value.status_code == 409
		assert excinfo.value.code == "DUPLICATE_ACHIEVEMENT"

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 8. Resubmit missing edit_reason is rejected at schema layer (422)
# ---------------------------------------------------------------------------


async def test_resubmit_without_reason_is_pydantic_error():
	from pydantic import ValidationError

	with pytest.raises(ValidationError):
		AchievementResubmit(actual_value=Decimal("10"))  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# 9. Goal not locked — defensive guard at the service layer
# ---------------------------------------------------------------------------


async def test_unlocked_goal_rejected():
	_record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		goal = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		goal.status = GoalStatus.DRAFT
		await db.commit()

		with pytest.raises(GoalNotLockedError):
			await achievement_service.log_achievement(
				user,
				AchievementCreate(
					goal_id=goal.id,
					quarter=Quarter.Q1,
					actual_value=Decimal("10"),
					status=AchievementStatus.ON_TRACK,
				),
				db,
			)

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 10. get_my_quarter returns goal/achievement pairs + window status
# ---------------------------------------------------------------------------


async def test_get_my_quarter_pairs_goals_with_achievements():
	_record()
	async with AsyncSessionLocal() as db:
		user = await _make_user(db)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, user, cycle)
		g1 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		g2 = await _make_locked_goal(db, user=user, cycle=cycle, sheet=sheet)
		await db.commit()

		# Log achievement for g1 only.
		await achievement_service.log_achievement(
			user,
			AchievementCreate(
				goal_id=g1.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("80"),
				status=AchievementStatus.ON_TRACK,
			),
			db,
		)

		view = await achievement_service.get_my_quarter(user.id, Quarter.Q1, cycle.id, db)
		assert view["quarter"] == Quarter.Q1
		assert view["cycle_id"] == cycle.id
		assert view["window"]["is_open"] is True
		pairs = {row["goal"].id: row["achievement"] for row in view["goals"]}
		assert pairs[g1.id] is not None
		assert pairs[g1.id].computed_score == Decimal("0.8")
		assert pairs[g2.id] is None

		await _cleanup(db, user=user, cycle=cycle)


# ---------------------------------------------------------------------------
# 11. RBAC — manager lacks LOG_ACHIEVEMENT → ForbiddenError
# ---------------------------------------------------------------------------


async def test_manager_cannot_log_achievement():
	_record()
	async with AsyncSessionLocal() as db:
		employee = await _make_user(db)
		manager = await _make_user(db, role=UserRole.MANAGER)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, employee, cycle)
		goal = await _make_locked_goal(db, user=employee, cycle=cycle, sheet=sheet)
		await db.commit()

		with pytest.raises(ForbiddenError):
			await achievement_service.log_achievement(
				manager,
				AchievementCreate(
					goal_id=goal.id,
					quarter=Quarter.Q1,
					actual_value=Decimal("10"),
					status=AchievementStatus.ON_TRACK,
				),
				db,
			)

		await _cleanup(db, user=employee, cycle=cycle)
		await _cleanup(db, user=manager)
