"""Integration test for the EventBus + handlers wiring.

Validates:
  * EventBus dispatches an event to multiple registered async handlers
  * Handler exceptions propagate to the publisher (no swallow)
  * Audit + Notification + GoalEvent handlers each write a row when a service
    publishes a real GOAL_CREATED event using a live DB session
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.constants import GoalStatus, UserRole
from app.core.database import AsyncSessionLocal
from app.events import goal_events as ge
from app.events.event_bus import event_bus
from app.events.handlers import setup_handlers
from app.models.audit_log import AuditLog
from app.models.cycle_config import CycleConfig
from app.models.goal import Goal
from app.models.goal_event import GoalEvent
from app.models.goal_sheet import GoalSheet
from app.models.notification import Notification
from app.models.user import User


# ---------------------------------------------------------------------------
# Bus contract tests (no DB)
# ---------------------------------------------------------------------------


async def test_publish_invokes_all_handlers():
	event_bus.clear()
	calls: list[str] = []

	async def h1(data, db):
		calls.append("h1")

	async def h2(data, db):
		calls.append("h2")

	event_bus.subscribe("test_event", h1)
	event_bus.subscribe("test_event", h2)

	await event_bus.publish("test_event", {"x": 1}, db=None)

	assert calls == ["h1", "h2"]


async def test_handler_exception_propagates():
	event_bus.clear()

	async def boom(data, db):
		raise RuntimeError("handler failed")

	event_bus.subscribe("test_event", boom)

	with pytest.raises(RuntimeError, match="handler failed"):
		await event_bus.publish("test_event", {}, db=None)


# ---------------------------------------------------------------------------
# End-to-end test against real DB
# ---------------------------------------------------------------------------


async def _ensure_test_user(db) -> User:
	email = f"eventbus_test_{uuid.uuid4().hex[:8]}@test.local"
	user = User(
		email=email,
		full_name="EventBus Test User",
		hashed_password="!",
		role=UserRole.EMPLOYEE,
		is_active=True,
	)
	db.add(user)
	await db.flush()
	return user


async def _ensure_cycle(db) -> CycleConfig:
	result = await db.execute(select(CycleConfig).limit(1))
	cycle = result.scalar_one_or_none()
	if cycle is not None:
		return cycle
	cycle = CycleConfig(
		cycle_name="Test Cycle",
		phase="goal_setting",
		window_open=datetime.now(timezone.utc),
		window_close=datetime.now(timezone.utc) + timedelta(days=14),
		is_active=True,
	)
	db.add(cycle)
	await db.flush()
	return cycle


async def test_goal_created_publishes_to_all_handlers():
	"""Publish GOAL_CREATED via event_bus and assert that audit_log,
	notifications, and goal_events each got a corresponding row."""

	setup_handlers()  # idempotent (clear() inside)

	async with AsyncSessionLocal() as db:
		user = await _ensure_test_user(db)
		cycle = await _ensure_cycle(db)

		sheet = GoalSheet(user_id=user.id, cycle_id=cycle.id)
		db.add(sheet)
		await db.flush()

		goal = Goal(
			user_id=user.id,
			goal_sheet_id=sheet.id,
			cycle_id=cycle.id,
			title="EventBus test goal",
			description="x",
			thrust_area="revenue_growth",
			uom_type="max",
			target_value=Decimal("100"),
			target_date=date.today() + timedelta(days=30),
			weightage=Decimal("100"),
			status=GoalStatus.DRAFT,
		)
		db.add(goal)
		await db.flush()

		await event_bus.publish(
			ge.GOAL_CREATED,
			{
				"goal_id": goal.id,
				"user_id": user.id,
				"user_name": user.full_name,
				"cycle_id": cycle.id,
				"actor_id": user.id,
				"actor_role": user.role,
				"payload": None,
			},
			db,
		)
		await db.commit()

		# Audit row
		audit_row = (
			await db.execute(
				select(AuditLog).where(AuditLog.table_name == "goals", AuditLog.record_id == goal.id)
			)
		).scalars().first()
		assert audit_row is not None, "audit_handler did not write a row"

		# Notification row (recipient is the employee themselves)
		notif_row = (
			await db.execute(
				select(Notification).where(Notification.recipient_id == user.id)
			)
		).scalars().first()
		assert notif_row is not None, "notification_handler did not write a row"

		# Goal event row
		ge_row = (
			await db.execute(
				select(GoalEvent).where(GoalEvent.goal_id == goal.id)
			)
		).scalars().first()
		assert ge_row is not None, "goal_event_handler did not write a row"

		# Cleanup
		await db.delete(ge_row)
		await db.delete(notif_row)
		await db.delete(audit_row)
		await db.delete(goal)
		await db.delete(sheet)
		await db.delete(user)
		await db.commit()
