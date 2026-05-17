"""Integration tests for CheckinService and CheckinCompletionTracker.

Real DB, real EventBus, real ORM session. Production handlers are detached
(``event_bus.clear()``) and replaced with recording handlers so each test
asserts the exact event payload.

Spec: Build plan §4.2 + §6.4.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import select

from app.core.constants import (
	CheckinCommentType,
	CheckinEventType,
	CheckinRatingSentiment,
	Quarter,
	UserRole,
)
from app.core.database import AsyncSessionLocal
from app.core.exceptions import (
	DuplicateCheckinError,
	ForbiddenError,
	InvalidCheckinCommentError,
	NotInTeamError,
	WindowClosedError,
)
from app.events import checkin_events as ce
from app.events.event_bus import event_bus
from app.models.checkin import Checkin
from app.models.checkin_event import CheckinEvent
from app.models.cycle_config import CycleConfig
from app.models.user import User
from app.schemas.checkin import CheckinCreate, CheckinUpdate
from app.services.checkin_service import checkin_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _record() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
	"""Reset bus and install recorders for COMPLETED / UPDATED / ACKNOWLEDGED."""
	event_bus.clear()
	completed: list[dict[str, Any]] = []
	updated: list[dict[str, Any]] = []
	acknowledged: list[dict[str, Any]] = []

	async def on_completed(data, db):
		completed.append(dict(data))

	async def on_updated(data, db):
		updated.append(dict(data))

	async def on_acknowledged(data, db):
		acknowledged.append(dict(data))

	event_bus.subscribe(ce.CHECKIN_COMPLETED, on_completed)
	event_bus.subscribe(ce.CHECKIN_UPDATED, on_updated)
	event_bus.subscribe(ce.CHECKIN_ACKNOWLEDGED, on_acknowledged)
	return completed, updated, acknowledged


async def _make_user(
	db,
	role: UserRole = UserRole.EMPLOYEE,
	manager_id=None,
) -> User:
	user = User(
		email=f"chk_test_{uuid.uuid4().hex[:8]}@test.local",
		full_name="Checkin Test User",
		hashed_password="!",
		role=role,
		manager_id=manager_id,
		is_active=True,
	)
	db.add(user)
	await db.flush()
	return user


async def _make_open_cycle(db) -> CycleConfig:
	cycle = CycleConfig(
		cycle_name=f"ChkTestCycle-{uuid.uuid4().hex[:6]}",
		phase="goal_setting",
		window_open=datetime.now(timezone.utc) - timedelta(days=1),
		window_close=datetime.now(timezone.utc) + timedelta(days=14),
		is_active=True,
	)
	rows = (
		await db.execute(select(CycleConfig).where(CycleConfig.is_active.is_(True)))
	).scalars().all()
	for existing in rows:
		existing.is_active = False
	db.add(cycle)
	await db.flush()
	return cycle


async def _make_closed_cycle(db) -> CycleConfig:
	cycle = CycleConfig(
		cycle_name=f"ChkClosedCycle-{uuid.uuid4().hex[:6]}",
		phase="closed",
		window_open=datetime.now(timezone.utc) - timedelta(days=30),
		window_close=datetime.now(timezone.utc) - timedelta(days=1),
		is_active=True,
	)
	rows = (
		await db.execute(select(CycleConfig).where(CycleConfig.is_active.is_(True)))
	).scalars().all()
	for existing in rows:
		existing.is_active = False
	db.add(cycle)
	await db.flush()
	return cycle


async def _cleanup_user(db, *, user: User) -> None:
	"""Delete every check-in row this user participates in plus the user row."""
	# Events referring to checkins involving this user.
	await db.execute(
		CheckinEvent.__table__.delete().where(
			CheckinEvent.checkin_id.in_(
				select(Checkin.id).where(
					(Checkin.manager_id == user.id) | (Checkin.employee_id == user.id)
				)
			)
		)
	)
	# Checkins where the user is either side.
	await db.execute(
		Checkin.__table__.delete().where(
			(Checkin.manager_id == user.id) | (Checkin.employee_id == user.id)
		)
	)
	await db.execute(User.__table__.delete().where(User.id == user.id))


async def _cleanup(
	db,
	*,
	manager: User,
	employee: User,
	cycle: CycleConfig | None = None,
) -> None:
	# Order matters: child rows first, then employee (whose manager_id FKs
	# manager), then manager, then cycle.
	await _cleanup_user(db, user=employee)
	await _cleanup_user(db, user=manager)
	if cycle is not None:
		await db.execute(CycleConfig.__table__.delete().where(CycleConfig.id == cycle.id))
	await db.commit()


_VALID_COMMENT = "This is a substantial check-in comment that exceeds twenty chars."


# ---------------------------------------------------------------------------
# 1. Manager creates check-in for direct report — event fires, row exists
# ---------------------------------------------------------------------------


async def test_create_checkin_full_flow():
	completed, _, _ = _record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		data = CheckinCreate(
			employee_id=employee.id,
			cycle_id=cycle.id,
			quarter=Quarter.Q1,
			comment=_VALID_COMMENT,
			comment_type=CheckinCommentType.FREEFORM,
			goals_discussed=None,
			overall_rating_sentiment=CheckinRatingSentiment.POSITIVE,
		)
		result = await checkin_service.create_checkin(manager, data, db)

		assert result.manager_id == manager.id
		assert result.employee_id == employee.id
		assert result.quarter == Quarter.Q1
		assert result.is_acknowledged_by_employee is False
		assert result.completed_at is not None

		# CREATED event row in the immutable ledger.
		events = (
			await db.execute(
				select(CheckinEvent).where(CheckinEvent.checkin_id == result.id)
			)
		).scalars().all()
		assert len(events) == 1
		assert events[0].event_type == CheckinEventType.CREATED
		assert events[0].actor_id == manager.id

		# Bus event fired exactly once with the right payload.
		assert len(completed) == 1
		ev = completed[0]
		assert ev["checkin_id"] == result.id
		assert ev["manager_id"] == manager.id
		assert ev["employee_id"] == employee.id
		assert ev["quarter"] == Quarter.Q1
		assert ev["cycle_id"] == cycle.id
		assert ev["actor_id"] == manager.id
		assert ev["actor_role"] == UserRole.MANAGER

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 2. Manager attempts check-in for non-report → 403 (NotInTeamError)
# ---------------------------------------------------------------------------


async def test_checkin_for_non_report_rejected():
	_record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		stranger = await _make_user(db, role=UserRole.EMPLOYEE)  # no manager_id
		cycle = await _make_open_cycle(db)
		await db.commit()

		data = CheckinCreate(
			employee_id=stranger.id,
			cycle_id=cycle.id,
			quarter=Quarter.Q1,
			comment=_VALID_COMMENT,
		)
		with pytest.raises(NotInTeamError):
			await checkin_service.create_checkin(manager, data, db)

		await _cleanup(db, manager=manager, employee=stranger, cycle=cycle)


# ---------------------------------------------------------------------------
# 3. Comment < 20 chars at service layer → 400
#
# Bypass Pydantic via ``model_construct`` to prove the service has its own guard.
# ---------------------------------------------------------------------------


async def test_short_comment_rejected_at_service_layer():
	_record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		bad = CheckinCreate.model_construct(
			employee_id=employee.id,
			cycle_id=cycle.id,
			quarter=Quarter.Q1,
			comment="too short",
			comment_type=CheckinCommentType.FREEFORM,
			goals_discussed=None,
			overall_rating_sentiment=None,
		)
		with pytest.raises(InvalidCheckinCommentError) as excinfo:
			await checkin_service.create_checkin(manager, bad, db)
		assert excinfo.value.status_code == 400

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 4. Duplicate (manager+employee+quarter+cycle) → 409
# ---------------------------------------------------------------------------


async def test_duplicate_checkin_raises_409():
	_record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		data = CheckinCreate(
			employee_id=employee.id,
			cycle_id=cycle.id,
			quarter=Quarter.Q1,
			comment=_VALID_COMMENT,
		)
		await checkin_service.create_checkin(manager, data, db)

		with pytest.raises(DuplicateCheckinError) as excinfo:
			await checkin_service.create_checkin(manager, data, db)
		assert excinfo.value.status_code == 409

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 5. Employee acknowledges → flag set + bus event
# ---------------------------------------------------------------------------


async def test_employee_acknowledges_checkin():
	_, _, acknowledged = _record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		created = await checkin_service.create_checkin(
			manager,
			CheckinCreate(
				employee_id=employee.id,
				cycle_id=cycle.id,
				quarter=Quarter.Q1,
				comment=_VALID_COMMENT,
			),
			db,
		)

		result = await checkin_service.acknowledge(employee, created.id, db)
		assert result.is_acknowledged_by_employee is True
		assert result.acknowledged_at is not None

		# Ledger gained an ACKNOWLEDGED row.
		events = (
			await db.execute(
				select(CheckinEvent)
				.where(CheckinEvent.checkin_id == created.id)
				.where(CheckinEvent.event_type == CheckinEventType.ACKNOWLEDGED)
			)
		).scalars().all()
		assert len(events) == 1
		assert events[0].actor_id == employee.id

		assert len(acknowledged) == 1
		assert acknowledged[0]["checkin_id"] == created.id
		assert acknowledged[0]["actor_id"] == employee.id
		assert acknowledged[0]["actor_role"] == UserRole.EMPLOYEE

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 6. Manager tries to acknowledge own check-in → 403 (RBAC catches it)
# ---------------------------------------------------------------------------


async def test_manager_cannot_self_acknowledge():
	_record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		created = await checkin_service.create_checkin(
			manager,
			CheckinCreate(
				employee_id=employee.id,
				cycle_id=cycle.id,
				quarter=Quarter.Q1,
				comment=_VALID_COMMENT,
			),
			db,
		)
		# Manager lacks ACKNOWLEDGE_CHECKIN — rbac_service raises ForbiddenError.
		with pytest.raises(ForbiddenError):
			await checkin_service.acknowledge(manager, created.id, db)

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 7. Update within window writes a CheckinEvent row with old/new comment
# ---------------------------------------------------------------------------


async def test_update_checkin_writes_event_with_diff():
	_, updated_events, _ = _record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		created = await checkin_service.create_checkin(
			manager,
			CheckinCreate(
				employee_id=employee.id,
				cycle_id=cycle.id,
				quarter=Quarter.Q1,
				comment=_VALID_COMMENT,
			),
			db,
		)
		new_comment = "Updated commentary covering Q1 progress and next-step actions."
		result = await checkin_service.update_checkin(
			manager,
			created.id,
			CheckinUpdate(
				comment=new_comment,
				edit_reason="Manager added clarifying context",
			),
			db,
		)
		assert result.comment == new_comment

		event_rows = (
			await db.execute(
				select(CheckinEvent)
				.where(CheckinEvent.checkin_id == created.id)
				.where(CheckinEvent.event_type == CheckinEventType.UPDATED)
			)
		).scalars().all()
		assert len(event_rows) == 1
		payload = event_rows[0].payload
		assert payload["old_comment"] == _VALID_COMMENT
		assert payload["new_comment"] == new_comment
		assert payload["edit_reason"] == "Manager added clarifying context"

		# Bus event mirrors the persisted diff.
		assert len(updated_events) == 1
		assert updated_events[0]["old_comment"] == _VALID_COMMENT
		assert updated_events[0]["new_comment"] == new_comment

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)


# ---------------------------------------------------------------------------
# 8. Update outside the cycle window → 403 (WindowClosedError)
# ---------------------------------------------------------------------------


async def test_update_outside_window_rejected():
	_record()
	async with AsyncSessionLocal() as db:
		manager = await _make_user(db, role=UserRole.MANAGER)
		employee = await _make_user(db, role=UserRole.EMPLOYEE, manager_id=manager.id)
		cycle = await _make_open_cycle(db)
		await db.commit()

		created = await checkin_service.create_checkin(
			manager,
			CheckinCreate(
				employee_id=employee.id,
				cycle_id=cycle.id,
				quarter=Quarter.Q1,
				comment=_VALID_COMMENT,
			),
			db,
		)
		# Slam the window shut in-place.
		cycle.window_open = datetime.now(timezone.utc) - timedelta(days=30)
		cycle.window_close = datetime.now(timezone.utc) - timedelta(days=1)
		await db.commit()

		with pytest.raises(WindowClosedError) as excinfo:
			await checkin_service.update_checkin(
				manager,
				created.id,
				CheckinUpdate(
					comment="Late edit attempt that should be rejected outright.",
					edit_reason="trying to amend after window",
				),
				db,
			)
		assert excinfo.value.status_code == 403

		await _cleanup(db, manager=manager, employee=employee, cycle=cycle)
