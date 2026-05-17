from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NotificationType
from app.core.logging import get_logger
from app.events import achievement_events as ae
from app.events import checkin_events as ce
from app.events import goal_events as ge
from app.events.event_bus import EventBus
from app.models.notification import Notification
from app.models.user import User


logger = get_logger(__name__)


async def _create_notification(
	db: AsyncSession,
	*,
	recipient_id: Any,
	notification_type: NotificationType,
	title: str,
	body: str,
	related_goal_id: Any | None = None,
	deep_link: str | None = None,
) -> None:
	notification = Notification(
		recipient_id=recipient_id,
		notification_type=notification_type,
		title=title,
		body=body,
		related_goal_id=related_goal_id,
		deep_link=deep_link,
	)
	db.add(notification)
	await db.flush()


# ---------------------------------------------------------------------------
# Goal lifecycle
# ---------------------------------------------------------------------------


async def on_goal_created(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Inform the employee that a goal was added to their sheet.
	await _create_notification(
		db,
		recipient_id=event_data["user_id"],
		notification_type=NotificationType.WINDOW_OPENING,
		title="Goal added to your sheet",
		body="A new goal has been added to your sheet.",
		related_goal_id=event_data["goal_id"],
	)


async def on_goal_submitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	manager_id = event_data.get("manager_id")
	if not manager_id:
		return
	await _create_notification(
		db,
		recipient_id=manager_id,
		notification_type=NotificationType.GOAL_SUBMITTED,
		title="Goal submitted",
		body=f"{event_data['user_name']} has submitted a goal for review.",
	)


async def on_sheet_submitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	manager_id = event_data.get("manager_id")
	if not manager_id:
		return
	await _create_notification(
		db,
		recipient_id=manager_id,
		notification_type=NotificationType.GOAL_SUBMITTED,
		title="Goal sheet submitted",
		body=f"{event_data['user_name']} has submitted their goal sheet for review.",
	)


async def on_sheet_approved(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _create_notification(
		db,
		recipient_id=event_data["employee_id"],
		notification_type=NotificationType.GOAL_APPROVED,
		title="Goal sheet approved",
		body=(
			f"Your goal sheet has been approved by {event_data['manager_name']}. "
			"All goals are now locked."
		),
	)


async def on_sheet_returned(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _create_notification(
		db,
		recipient_id=event_data["employee_id"],
		notification_type=NotificationType.GOAL_RETURNED,
		title="Goal sheet returned for rework",
		body=event_data.get("reason", ""),
	)


async def on_goal_unlocked(event_data: dict[str, Any], db: AsyncSession) -> None:
	user_id = event_data["user_id"]
	reason = event_data.get("reason", "")
	admin_name = event_data.get("admin_name", "an admin")
	await _create_notification(
		db,
		recipient_id=user_id,
		notification_type=NotificationType.GOAL_UNLOCKED,
		title="Goal unlocked",
		body=f"Your goal was unlocked by {admin_name}: {reason}",
		related_goal_id=event_data.get("goal_id"),
	)
	# Also notify the employee's manager so they know the goal is being revised.
	manager_id = (await db.execute(select(User.manager_id).where(User.id == user_id))).scalar_one_or_none()
	if manager_id:
		user_name = event_data.get("user_name", "A team member")
		await _create_notification(
			db,
			recipient_id=manager_id,
			notification_type=NotificationType.GOAL_UNLOCKED,
			title="Team member goal unlocked",
			body=f"{user_name}'s goal was unlocked by {admin_name}: {reason}",
			related_goal_id=event_data.get("goal_id"),
		)


async def on_shared_goal_received(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _create_notification(
		db,
		recipient_id=event_data["recipient_id"],
		notification_type=NotificationType.SHARED_GOAL_RECEIVED,
		title="Shared KPI added",
		body="A shared departmental KPI has been added to your goal sheet.",
		related_goal_id=event_data.get("goal_id"),
	)


# ---------------------------------------------------------------------------
# Phase 2 — achievements + check-ins
# ---------------------------------------------------------------------------


async def on_checkin_completed(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _create_notification(
		db,
		recipient_id=event_data["employee_id"],
		notification_type=NotificationType.CHECKIN_COMPLETED,
		title="Check-in recorded by your manager",
		body="Your manager has logged a check-in for this quarter.",
		deep_link=f"/employee/checkins/{event_data['checkin_id']}",
	)


async def on_checkin_acknowledged(event_data: dict[str, Any], db: AsyncSession) -> None:
	await _create_notification(
		db,
		recipient_id=event_data["manager_id"],
		notification_type=NotificationType.CHECKIN_COMPLETED,
		title="Check-in acknowledged",
		body="Your team member acknowledged the check-in.",
		deep_link=f"/manager/checkins/{event_data['checkin_id']}",
	)


async def on_achievement_resubmitted(event_data: dict[str, Any], db: AsyncSession) -> None:
	# Notify the employee's manager that an achievement was edited mid-quarter.
	user_id = event_data["user_id"]
	manager_id = (
		await db.execute(select(User.manager_id).where(User.id == user_id))
	).scalar_one_or_none()
	if not manager_id:
		return
	await _create_notification(
		db,
		recipient_id=manager_id,
		notification_type=NotificationType.GOAL_SUBMITTED,
		title="Achievement resubmitted",
		body="A team member updated their achievement for the current quarter.",
		related_goal_id=event_data.get("goal_id"),
		deep_link=f"/manager/achievements/{event_data['achievement_id']}",
	)


def register(bus: EventBus) -> None:
	bus.subscribe(ge.GOAL_CREATED, on_goal_created)
	bus.subscribe(ge.GOAL_SUBMITTED, on_goal_submitted)
	bus.subscribe(ge.GOAL_SHEET_SUBMITTED, on_sheet_submitted)
	bus.subscribe(ge.GOAL_SHEET_APPROVED, on_sheet_approved)
	bus.subscribe(ge.GOAL_SHEET_RETURNED, on_sheet_returned)
	bus.subscribe(ge.GOAL_UNLOCKED, on_goal_unlocked)
	bus.subscribe(ge.SHARED_GOAL_RECEIVED, on_shared_goal_received)
	# Phase 2
	bus.subscribe(ce.CHECKIN_COMPLETED, on_checkin_completed)
	bus.subscribe(ce.CHECKIN_ACKNOWLEDGED, on_checkin_acknowledged)
	bus.subscribe(ae.ACHIEVEMENT_RESUBMITTED, on_achievement_resubmitted)

