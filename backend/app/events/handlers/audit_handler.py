from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events import checkin_events as ce
from app.events import goal_events as ge
from app.events.event_bus import EventBus
from app.repositories.audit_repository import AuditRepository


logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _log(
	db: AsyncSession,
	*,
	table_name: str,
	record_id: UUID,
	action: AuditAction,
	actor_id: UUID,
	actor_role: Any,
	field_name: str | None = None,
	old_value: Any = None,
	new_value: Any = None,
	request_id: str | None = None,
) -> None:
	repo = AuditRepository(db)
	await repo.log(
		table_name,
		record_id,
		action,
		actor_id,
		actor_role,
		field_name=field_name,
		old_value=str(old_value) if old_value is not None else None,
		new_value=str(new_value) if new_value is not None else None,
		request_id=request_id,
	)


# ---------------------------------------------------------------------------
# Goal lifecycle handlers
# ---------------------------------------------------------------------------


async def on_goal_created(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.INSERT,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		request_id=event_data.get("request_id"),
	)


async def on_goal_updated(event_data: dict[str, Any], db: AsyncSession) -> None:
	"""Diff old_snapshot vs new_snapshot and emit one UPDATE row per changed field."""
	old_snapshot: dict[str, Any] = event_data["old_snapshot"]
	new_snapshot: dict[str, Any] = event_data["new_snapshot"]
	record_id = event_data["goal_id"]
	for field, old_value in old_snapshot.items():
		if field not in new_snapshot:
			continue
		new_value = new_snapshot[field]
		if old_value != new_value:
			await _log(
				db,
				table_name="goals",
				record_id=record_id,
				action=AuditAction.UPDATE,
				actor_id=event_data["actor_id"],
				actor_role=event_data["actor_role"],
				field_name=field,
				old_value=old_value,
				new_value=new_value,
				request_id=event_data.get("request_id"),
			)


async def on_goal_deleted(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="is_deleted",
		old_value=False,
		new_value=True,
		request_id=event_data.get("request_id"),
	)


async def on_goal_submitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="draft",
		new_value="submitted",
		request_id=event_data.get("request_id"),
	)


async def on_goal_approved(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Goals are locked immediately on approval; record the status transition once.
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="submitted",
		new_value="locked",
		request_id=event_data.get("request_id"),
	)


async def on_goal_returned(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="submitted",
		new_value="draft",
		request_id=event_data.get("request_id"),
	)


async def on_goal_unlocked(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goals",
		record_id=event_data["goal_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="locked",
		new_value="under_review",
		request_id=event_data.get("request_id"),
	)


async def on_manager_inline_edit(event_data: dict[str, Any], db: AsyncSession) -> None:
	"""Manager edited target/weightage during review — diff old vs new snapshot."""
	await on_goal_updated(event_data, db)


# ---------------------------------------------------------------------------
# Goal-sheet lifecycle handlers
# ---------------------------------------------------------------------------


async def on_sheet_submitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goal_sheets",
		record_id=event_data["goal_sheet_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value=event_data.get("old_status", "draft"),
		new_value="submitted",
		request_id=event_data.get("request_id"),
	)


async def on_sheet_approved(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goal_sheets",
		record_id=event_data["goal_sheet_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="submitted",
		new_value="approved",
		request_id=event_data.get("request_id"),
	)


async def on_sheet_returned(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="goal_sheets",
		record_id=event_data["goal_sheet_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="status",
		old_value="submitted",
		new_value="draft",
		request_id=event_data.get("request_id"),
	)


async def on_shared_goal_pushed(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Audit the master goal creation; recipient-goal INSERTs flow through GOAL_CREATED.
	await _log(
		db,
		table_name="goals",
		record_id=event_data["source_goal_id"],
		action=AuditAction.INSERT,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		request_id=event_data.get("request_id"),
	)


# ---------------------------------------------------------------------------
# Phase 2 — achievements
# ---------------------------------------------------------------------------


async def on_achievement_logged(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="achievements",
		record_id=event_data["achievement_id"],
		action=AuditAction.INSERT,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		request_id=event_data.get("request_id"),
	)


async def on_achievement_resubmitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	"""One row per field that moved. Payload carries old_score + new score + status."""
	record_id = event_data["achievement_id"]
	actor_id = event_data["actor_id"]
	actor_role = event_data["actor_role"]
	request_id = event_data.get("request_id")
	# Score transition (always recorded — even when None → None for symmetry).
	await _log(
		db,
		table_name="achievements",
		record_id=record_id,
		action=AuditAction.UPDATE,
		actor_id=actor_id,
		actor_role=actor_role,
		field_name="computed_score",
		old_value=event_data.get("old_score"),
		new_value=event_data.get("computed_score"),
		request_id=request_id,
	)
	# Edit reason (always present on resubmissions).
	await _log(
		db,
		table_name="achievements",
		record_id=record_id,
		action=AuditAction.UPDATE,
		actor_id=actor_id,
		actor_role=actor_role,
		field_name="edit_reason",
		old_value=None,
		new_value=event_data.get("edit_reason"),
		request_id=request_id,
	)


async def on_shared_achievement_synced(event_data: dict[str, Any], db: AsyncSession) -> None:
	action = AuditAction.INSERT if event_data.get("is_new") else AuditAction.UPDATE
	await _log(
		db,
		table_name="achievements",
		record_id=event_data["achievement_id"],
		action=action,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="is_synced_from_shared",
		old_value=None,
		new_value=True,
		request_id=event_data.get("request_id"),
	)


# ---------------------------------------------------------------------------
# Phase 2 — check-ins
# ---------------------------------------------------------------------------


async def on_checkin_completed(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="checkins",
		record_id=event_data["checkin_id"],
		action=AuditAction.INSERT,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		request_id=event_data.get("request_id"),
	)


async def on_checkin_updated(event_data: dict[str, Any], db: AsyncSession) -> None:
	"""Payload carries old_comment / new_comment / edit_reason. Write one row each."""
	record_id = event_data["checkin_id"]
	actor_id = event_data["actor_id"]
	actor_role = event_data["actor_role"]
	request_id = event_data.get("request_id")
	if event_data.get("old_comment") != event_data.get("new_comment"):
		await _log(
			db,
			table_name="checkins",
			record_id=record_id,
			action=AuditAction.UPDATE,
			actor_id=actor_id,
			actor_role=actor_role,
			field_name="comment",
			old_value=event_data.get("old_comment"),
			new_value=event_data.get("new_comment"),
			request_id=request_id,
		)
	if event_data.get("edit_reason"):
		await _log(
			db,
			table_name="checkins",
			record_id=record_id,
			action=AuditAction.UPDATE,
			actor_id=actor_id,
			actor_role=actor_role,
			field_name="edit_reason",
			old_value=None,
			new_value=event_data.get("edit_reason"),
			request_id=request_id,
		)


async def on_checkin_acknowledged(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _log(
		db,
		table_name="checkins",
		record_id=event_data["checkin_id"],
		action=AuditAction.UPDATE,
		actor_id=event_data["actor_id"],
		actor_role=event_data["actor_role"],
		field_name="is_acknowledged_by_employee",
		old_value=False,
		new_value=True,
		request_id=event_data.get("request_id"),
	)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def register(bus: EventBus) -> None:
	bus.subscribe(ge.GOAL_CREATED, on_goal_created)
	bus.subscribe(ge.GOAL_UPDATED, on_goal_updated)
	bus.subscribe(ge.GOAL_DELETED, on_goal_deleted)
	bus.subscribe(ge.GOAL_SUBMITTED, on_goal_submitted)
	bus.subscribe(ge.GOAL_APPROVED, on_goal_approved)
	bus.subscribe(ge.GOAL_RETURNED_FOR_REWORK, on_goal_returned)
	bus.subscribe(ge.GOAL_UNLOCKED, on_goal_unlocked)
	bus.subscribe(ge.TARGET_EDITED_BY_MANAGER, on_manager_inline_edit)
	bus.subscribe(ge.WEIGHTAGE_EDITED_BY_MANAGER, on_manager_inline_edit)
	bus.subscribe(ge.GOAL_SHEET_SUBMITTED, on_sheet_submitted)
	bus.subscribe(ge.GOAL_SHEET_APPROVED, on_sheet_approved)
	bus.subscribe(ge.GOAL_SHEET_RETURNED, on_sheet_returned)
	bus.subscribe(ge.SHARED_GOAL_PUSHED, on_shared_goal_pushed)
	# Phase 2
	bus.subscribe(ae.ACHIEVEMENT_LOGGED, on_achievement_logged)
	bus.subscribe(ae.ACHIEVEMENT_RESUBMITTED, on_achievement_resubmitted)
	bus.subscribe(ae.SHARED_ACHIEVEMENT_SYNCED, on_shared_achievement_synced)
	bus.subscribe(ce.CHECKIN_COMPLETED, on_checkin_completed)
	bus.subscribe(ce.CHECKIN_UPDATED, on_checkin_updated)
	bus.subscribe(ce.CHECKIN_ACKNOWLEDGED, on_checkin_acknowledged)

