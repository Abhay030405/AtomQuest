"""Integration tests for Phase 2 event handlers.

The four required scenarios from Build plan §6.2 – §6.5:

  1. ACHIEVEMENT_LOGGED → SnapshotUpdateHandler writes correct
     ``weighted_score`` into ``analytics_snapshots``.
  2. ACHIEVEMENT_LOGGED on a shared *source* goal → SharedGoalSyncHandler
     propagates: every recipient gets an Achievement row with
     ``is_synced_from_shared = True``, each recipient's snapshot is
     refreshed, and ``audit_log`` carries an INSERT per recipient.
  3. CHECKIN_COMPLETED → recipient snapshot's ``checkin_done`` flips True
     AND a Notification row exists for the employee.
  4. Resubmission on a shared source → recipients receive an
     ``achievement_versions`` row (i.e. the prior recipient state is
     snapshotted, not silently overwritten).

These tests use the REAL production handlers via ``setup_handlers()``.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.constants import (
	AchievementStatus,
	AuditAction,
	CheckinCommentType,
	CheckinRatingSentiment,
	GoalStatus,
	NotificationType,
	Quarter,
	UoMType,
	UserRole,
)
from app.core.database import AsyncSessionLocal
from app.events.event_bus import event_bus
from app.events.handlers import setup_handlers
from app.models.achievement import Achievement
from app.models.achievement_version import AchievementVersion
from app.models.analytics_snapshot import AnalyticsSnapshot
from app.models.audit_log import AuditLog
from app.models.checkin import Checkin
from app.models.checkin_event import CheckinEvent
from app.models.cycle_config import CycleConfig
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.notification import Notification
from app.models.user import User
from app.schemas.achievement import AchievementCreate, AchievementResubmit
from app.schemas.checkin import CheckinCreate
from app.services.achievement_service import achievement_service
from app.services.checkin_service import checkin_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_user(
	db,
	role: UserRole = UserRole.EMPLOYEE,
	manager_id=None,
) -> User:
	user = User(
		email=f"evt_test_{uuid.uuid4().hex[:8]}@test.local",
		full_name="Event Handler Test User",
		hashed_password="!",
		role=role,
		manager_id=manager_id,
		is_active=True,
	)
	db.add(user)
	await db.flush()
	return user


async def _make_open_cycle(db) -> CycleConfig:
	rows = (
		await db.execute(select(CycleConfig).where(CycleConfig.is_active.is_(True)))
	).scalars().all()
	for existing in rows:
		existing.is_active = False
	cycle = CycleConfig(
		cycle_name=f"EvtCycle-{uuid.uuid4().hex[:6]}",
		phase="goal_setting",
		window_open=datetime.now(timezone.utc) - timedelta(days=1),
		window_close=datetime.now(timezone.utc) + timedelta(days=14),
		is_active=True,
	)
	db.add(cycle)
	await db.flush()
	return cycle


async def _make_sheet(db, user: User, cycle: CycleConfig) -> GoalSheet:
	sheet = GoalSheet(user_id=user.id, cycle_id=cycle.id)
	db.add(sheet)
	await db.flush()
	return sheet


async def _make_locked_goal(
	db,
	*,
	user: User,
	cycle: CycleConfig,
	sheet: GoalSheet,
	uom: UoMType = UoMType.MIN,
	target_value: Decimal | None = Decimal("100"),
	target_date: date | None = None,
	weightage: Decimal = Decimal("100"),
	is_shared: bool = False,
	source_shared_goal_id=None,
) -> Goal:
	goal = Goal(
		user_id=user.id,
		goal_sheet_id=sheet.id,
		cycle_id=cycle.id,
		title="Evt Handler Goal",
		description="x",
		thrust_area="revenue_growth",
		uom_type=uom,
		target_value=target_value,
		target_date=target_date,
		weightage=weightage,
		status=GoalStatus.LOCKED,
		is_shared=is_shared,
		source_shared_goal_id=source_shared_goal_id,
	)
	db.add(goal)
	await db.flush()
	return goal


async def _cleanup_users(db, users: list[User], cycle: CycleConfig | None = None) -> None:
	user_ids = [u.id for u in users]
	goal_id_stmt = select(Goal.id).where(Goal.user_id.in_(user_ids))
	achievement_id_stmt = select(Achievement.id).where(
		Achievement.goal_id.in_(goal_id_stmt)
	)

	await db.execute(
		AchievementVersion.__table__.delete().where(
			AchievementVersion.achievement_id.in_(achievement_id_stmt)
		)
	)
	await db.execute(
		Achievement.__table__.delete().where(Achievement.goal_id.in_(goal_id_stmt))
	)
	await db.execute(
		AnalyticsSnapshot.__table__.delete().where(
			AnalyticsSnapshot.user_id.in_(user_ids)
		)
	)
	await db.execute(
		Notification.__table__.delete().where(Notification.recipient_id.in_(user_ids))
	)
	await db.execute(
		CheckinEvent.__table__.delete().where(
			CheckinEvent.checkin_id.in_(
				select(Checkin.id).where(
					(Checkin.manager_id.in_(user_ids))
					| (Checkin.employee_id.in_(user_ids))
				)
			)
		)
	)
	await db.execute(
		Checkin.__table__.delete().where(
			(Checkin.manager_id.in_(user_ids))
			| (Checkin.employee_id.in_(user_ids))
		)
	)
	await db.execute(
		AuditLog.__table__.delete().where(AuditLog.actor_id.in_(user_ids))
	)
	# Recipient goals (linked via source_shared_goal_id) may already be in user_ids; cascade
	await db.execute(
		Goal.__table__.delete().where(
			Goal.source_shared_goal_id.in_(select(Goal.id).where(Goal.user_id.in_(user_ids)))
		)
	)
	await db.execute(Goal.__table__.delete().where(Goal.user_id.in_(user_ids)))
	await db.execute(GoalSheet.__table__.delete().where(GoalSheet.user_id.in_(user_ids)))
	if cycle is not None:
		# Defensive: any leftover sheet/goal/snapshot/checkin pinned to this
		# cycle from a prior failed test must go before the cycle row itself.
		await db.execute(
			AnalyticsSnapshot.__table__.delete().where(
				AnalyticsSnapshot.cycle_id == cycle.id
			)
		)
		await db.execute(
			Checkin.__table__.delete().where(Checkin.cycle_id == cycle.id)
		)
		await db.execute(Goal.__table__.delete().where(Goal.cycle_id == cycle.id))
		await db.execute(
			GoalSheet.__table__.delete().where(GoalSheet.cycle_id == cycle.id)
		)
	# Clear manager_id pointers first to avoid FK issues.
	for u in users:
		await db.execute(
			User.__table__.update()
			.where(User.manager_id == u.id)
			.values(manager_id=None)
		)
	await db.execute(User.__table__.delete().where(User.id.in_(user_ids)))
	if cycle is not None:
		await db.execute(CycleConfig.__table__.delete().where(CycleConfig.id == cycle.id))
	await db.commit()


_VALID_COMMENT = (
	"Quarterly check-in: discussed goal progress and blockers in detail."
)


# ---------------------------------------------------------------------------
# 1. ACHIEVEMENT_LOGGED → SnapshotUpdateHandler updates weighted_score
# ---------------------------------------------------------------------------


async def test_achievement_logged_updates_snapshot():
	setup_handlers()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)
		cycle = await _make_open_cycle(db)
		sheet = await _make_sheet(db, employee, cycle)
		# Two locked goals: 60% weight scored 0.80; 40% weight scored 0.50.
		# Expected weighted_score = (0.80*60 + 0.50*40) / 100 = 0.68
		goal_a = await _make_locked_goal(
			db,
			user=employee,
			cycle=cycle,
			sheet=sheet,
			target_value=Decimal("100"),
			weightage=Decimal("60"),
		)
		goal_b = await _make_locked_goal(
			db,
			user=employee,
			cycle=cycle,
			sheet=sheet,
			target_value=Decimal("100"),
			weightage=Decimal("40"),
		)
		await db.commit()

		await achievement_service.log_achievement(
			employee,
			AchievementCreate(
				goal_id=goal_a.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("80"),
				status=AchievementStatus.COMPLETED,
			),
			db,
		)
		await achievement_service.log_achievement(
			employee,
			AchievementCreate(
				goal_id=goal_b.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("50"),
				status=AchievementStatus.ON_TRACK,
			),
			db,
		)
		await db.commit()

		snap = (
			await db.execute(
				select(AnalyticsSnapshot)
				.where(AnalyticsSnapshot.user_id == employee.id)
				.where(AnalyticsSnapshot.quarter == Quarter.Q1)
				.where(AnalyticsSnapshot.cycle_id == cycle.id)
			)
		).scalar_one()

		assert snap.goals_total == 2
		assert snap.goals_submitted == 2
		assert snap.goals_completed == 1
		assert snap.achievement_submitted is True
		assert snap.weighted_score is not None
		# (0.80*60 + 0.50*40) / 100 = 0.68
		assert snap.weighted_score == Decimal("0.6800")
		assert snap.manager_id == manager.id

		await _cleanup_users(db, [employee, manager], cycle=cycle)


# ---------------------------------------------------------------------------
# 2. Shared goal propagation: source LOG → all recipients sync + audit
# ---------------------------------------------------------------------------


async def test_shared_goal_log_propagates_to_recipients():
	setup_handlers()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		source_user = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)
		recipient_a = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)
		recipient_b = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)

		cycle = await _make_open_cycle(db)
		source_sheet = await _make_sheet(db, source_user, cycle)
		sheet_a = await _make_sheet(db, recipient_a, cycle)
		sheet_b = await _make_sheet(db, recipient_b, cycle)

		source_goal = await _make_locked_goal(
			db,
			user=source_user,
			cycle=cycle,
			sheet=source_sheet,
			target_value=Decimal("200"),
			is_shared=True,
		)
		recipient_goal_a = await _make_locked_goal(
			db,
			user=recipient_a,
			cycle=cycle,
			sheet=sheet_a,
			target_value=Decimal("200"),
			source_shared_goal_id=source_goal.id,
		)
		recipient_goal_b = await _make_locked_goal(
			db,
			user=recipient_b,
			cycle=cycle,
			sheet=sheet_b,
			target_value=Decimal("200"),
			source_shared_goal_id=source_goal.id,
		)
		await db.commit()

		# Source user logs achievement → handler propagates.
		source_ach = await achievement_service.log_achievement(
			source_user,
			AchievementCreate(
				goal_id=source_goal.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("160"),
				status=AchievementStatus.ON_TRACK,
			),
			db,
		)
		await db.commit()

		# Each recipient gets a synced achievement row.
		for recipient, recipient_goal in (
			(recipient_a, recipient_goal_a),
			(recipient_b, recipient_goal_b),
		):
			ach = (
				await db.execute(
					select(Achievement)
					.where(Achievement.goal_id == recipient_goal.id)
					.where(Achievement.quarter == Quarter.Q1)
				)
			).scalar_one()
			assert ach.is_synced_from_shared is True
			assert ach.actual_value == Decimal("160")
			assert ach.computed_score == Decimal("0.8000")

			# Recipient's snapshot is rebuilt.
			snap = (
				await db.execute(
					select(AnalyticsSnapshot)
					.where(AnalyticsSnapshot.user_id == recipient.id)
					.where(AnalyticsSnapshot.quarter == Quarter.Q1)
					.where(AnalyticsSnapshot.cycle_id == cycle.id)
				)
			).scalar_one()
			assert snap.goals_submitted == 1
			assert snap.achievement_submitted is True

			# Audit log carries the INSERT for the recipient's achievement.
			audit_rows = (
				await db.execute(
					select(AuditLog)
					.where(AuditLog.table_name == "achievements")
					.where(AuditLog.record_id == ach.id)
				)
			).scalars().all()
			assert any(
				row.action == AuditAction.INSERT for row in audit_rows
			), f"expected INSERT audit row for recipient achievement {ach.id}"

		# Sanity: source achievement was created normally too.
		assert source_ach.is_synced_from_shared is False

		await _cleanup_users(
			db,
			[recipient_a, recipient_b, source_user, manager],
			cycle=cycle,
		)


# ---------------------------------------------------------------------------
# 3. CHECKIN_COMPLETED → snapshot.checkin_done flips + employee notified
# ---------------------------------------------------------------------------


async def test_checkin_completed_updates_snapshot_and_notifies():
	setup_handlers()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)
		cycle = await _make_open_cycle(db)
		# Need a goal so a snapshot row makes business sense — but the test
		# only asserts checkin_done so any locked goal works.
		sheet = await _make_sheet(db, employee, cycle)
		await _make_locked_goal(db, user=employee, cycle=cycle, sheet=sheet)
		await db.commit()

		await checkin_service.create_checkin(
			manager,
			CheckinCreate(
				employee_id=employee.id,
				cycle_id=cycle.id,
				quarter=Quarter.Q1,
				comment=_VALID_COMMENT,
				comment_type=CheckinCommentType.FREEFORM,
				goals_discussed=None,
				overall_rating_sentiment=CheckinRatingSentiment.POSITIVE,
			),
			db,
		)
		await db.commit()

		snap = (
			await db.execute(
				select(AnalyticsSnapshot)
				.where(AnalyticsSnapshot.user_id == employee.id)
				.where(AnalyticsSnapshot.quarter == Quarter.Q1)
				.where(AnalyticsSnapshot.cycle_id == cycle.id)
			)
		).scalar_one()
		assert snap.checkin_done is True

		notif = (
			await db.execute(
				select(Notification)
				.where(Notification.recipient_id == employee.id)
				.where(
					Notification.notification_type
					== NotificationType.CHECKIN_COMPLETED
				)
			)
		).scalar_one()
		assert notif.deep_link is not None
		assert "/checkins/" in notif.deep_link

		await _cleanup_users(db, [employee, manager], cycle=cycle)


# ---------------------------------------------------------------------------
# 4. Resubmission on shared source → recipients get AchievementVersion row
# ---------------------------------------------------------------------------


async def test_shared_goal_resubmit_creates_recipient_versions():
	setup_handlers()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		source_user = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)
		recipient = await _make_user(
			db, role=UserRole.EMPLOYEE, manager_id=manager.id
		)

		cycle = await _make_open_cycle(db)
		source_sheet = await _make_sheet(db, source_user, cycle)
		recipient_sheet = await _make_sheet(db, recipient, cycle)

		source_goal = await _make_locked_goal(
			db,
			user=source_user,
			cycle=cycle,
			sheet=source_sheet,
			target_value=Decimal("200"),
			is_shared=True,
		)
		recipient_goal = await _make_locked_goal(
			db,
			user=recipient,
			cycle=cycle,
			sheet=recipient_sheet,
			target_value=Decimal("200"),
			source_shared_goal_id=source_goal.id,
		)
		await db.commit()

		# Initial source log → recipient gets sync'd insert (no version yet).
		await achievement_service.log_achievement(
			source_user,
			AchievementCreate(
				goal_id=source_goal.id,
				quarter=Quarter.Q1,
				actual_value=Decimal("150"),
				status=AchievementStatus.ON_TRACK,
			),
			db,
		)
		await db.commit()

		recipient_ach_first = (
			await db.execute(
				select(Achievement)
				.where(Achievement.goal_id == recipient_goal.id)
				.where(Achievement.quarter == Quarter.Q1)
			)
		).scalar_one()
		# No prior state → no version row from initial insert.
		first_versions = (
			await db.execute(
				select(AchievementVersion).where(
					AchievementVersion.achievement_id == recipient_ach_first.id
				)
			)
		).scalars().all()
		assert first_versions == []

		# Source resubmits → recipient must get a version row capturing prior state.
		source_ach = (
			await db.execute(
				select(Achievement)
				.where(Achievement.goal_id == source_goal.id)
				.where(Achievement.quarter == Quarter.Q1)
			)
		).scalar_one()
		await achievement_service.resubmit(
			source_user,
			source_ach.id,
			AchievementResubmit(
				actual_value=Decimal("180"),
				status=AchievementStatus.ON_TRACK,
				edit_reason="Updated mid-quarter figures",
			),
			db,
		)
		await db.commit()

		versions = (
			await db.execute(
				select(AchievementVersion)
				.where(
					AchievementVersion.achievement_id == recipient_ach_first.id
				)
				.order_by(AchievementVersion.version_number.asc())
			)
		).scalars().all()
		assert len(versions) >= 1
		# Version row captures the PRIOR value, not the new one.
		assert versions[0].actual_value == Decimal("150")
		# Achievement row itself now carries the new value.
		recipient_ach_now = (
			await db.execute(
				select(Achievement).where(Achievement.id == recipient_ach_first.id)
			)
		).scalar_one()
		assert recipient_ach_now.actual_value == Decimal("180")
		assert recipient_ach_now.is_synced_from_shared is True

		await _cleanup_users(db, [recipient, source_user, manager], cycle=cycle)
