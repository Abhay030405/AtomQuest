from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NotificationType
from app.core.logging import get_logger
from app.events.event_bus import EventBus
from app.models.user import User
from app.services.notification_service import notification_service


logger = get_logger(__name__)


class NotificationHandler:
	def register(self, event_bus: EventBus) -> None:
		event_bus.subscribe("goal_submitted", self.handle_goal_submitted)
		event_bus.subscribe("goal_approved", self.handle_goal_approved)
		event_bus.subscribe("goal_returned", self.handle_goal_returned)
		event_bus.subscribe("goal_unlocked", self.handle_goal_unlocked)
		event_bus.subscribe("shared_goal_pushed", self.handle_shared_goal_pushed)

	async def handle_goal_submitted(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			await notification_service.create_in_app(
				event_data["manager_id"],
				NotificationType.GOAL_SUBMITTED,
				"Goal sheet submitted",
				f"{event_data['user_name']} has submitted their goal sheet for review.",
				db,
			)
		except Exception as exc:  # pragma: no cover
			logger.error("notification_handler_failed", error=str(exc))

	async def handle_goal_approved(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			await notification_service.create_in_app(
				event_data["employee_id"],
				NotificationType.GOAL_APPROVED,
				"Goal sheet approved",
				f"Your goal sheet has been approved by {event_data['manager_name']}.",
				db,
			)
		except Exception as exc:  # pragma: no cover
			logger.error("notification_handler_failed", error=str(exc))

	async def handle_goal_returned(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			await notification_service.create_in_app(
				event_data["employee_id"],
				NotificationType.GOAL_RETURNED,
				"Goal sheet returned for rework",
				event_data["reason"],
				db,
			)
		except Exception as exc:  # pragma: no cover
			logger.error("notification_handler_failed", error=str(exc))

	async def handle_goal_unlocked(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			await notification_service.create_in_app(
				event_data["user_id"],
				NotificationType.GOAL_UNLOCKED,
				"Goal unlocked",
				f"Your goal has been unlocked: {event_data.get('reason', '')}",
				db,
			)
			stmt = select(User.manager_id).where(User.id == event_data["user_id"])
			manager_id = (await db.execute(stmt)).scalar_one_or_none()
			if manager_id:
				await notification_service.create_in_app(
					manager_id,
					NotificationType.GOAL_UNLOCKED,
					"Team member goal unlocked",
					f"A goal for your team member has been unlocked: {event_data.get('reason', '')}",
					db,
				)
		except Exception as exc:  # pragma: no cover
			logger.error("notification_handler_failed", error=str(exc))

	async def handle_shared_goal_pushed(self, event_data: dict[str, Any], db: AsyncSession) -> None:
		try:
			for recipient_id in event_data.get("recipient_ids", []):
				await notification_service.create_in_app(
					recipient_id,
					NotificationType.SHARED_GOAL_RECEIVED,
					"Shared KPI added",
					"A shared departmental KPI has been added to your goal sheet.",
					db,
				)
		except Exception as exc:  # pragma: no cover
			logger.error("notification_handler_failed", error=str(exc))


notification_handler = NotificationHandler()
