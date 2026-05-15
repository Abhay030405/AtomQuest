from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NotificationType
from app.core.logging import get_logger
from app.models.notification import Notification


logger = get_logger(__name__)


class NotificationService:
	async def create_in_app(
		self,
		recipient_id: UUID,
		notification_type: NotificationType,
		title: str,
		body: str,
		db: AsyncSession,
		deep_link: str | None = None,
		related_goal_id: UUID | None = None,
	) -> Notification | None:
		try:
			notification = Notification(
				recipient_id=recipient_id,
				notification_type=notification_type,
				title=title,
				body=body,
				deep_link=deep_link,
				related_goal_id=related_goal_id,
			)
			db.add(notification)
			await db.flush()
			return notification
		except Exception as exc:  # pragma: no cover
			logger.error("notification_create_failed", error=str(exc))
			return None

	async def get_for_user(self, user_id: UUID, skip: int, limit: int, db: AsyncSession) -> list[Notification]:
		stmt = (
			select(Notification)
			.where(Notification.recipient_id == user_id)
			.order_by(Notification.created_at.desc())
			.offset(skip)
			.limit(limit)
		)
		result = await db.execute(stmt)
		return list(result.scalars().all())

	async def get_unread_count(self, user_id: UUID, db: AsyncSession) -> int:
		stmt = select(func.count()).select_from(Notification).where(
			Notification.recipient_id == user_id, Notification.is_read.is_(False)
		)
		result = await db.execute(stmt)
		return int(result.scalar_one())

	async def mark_read(self, notification_id: UUID, user_id: UUID, db: AsyncSession) -> Notification:
		stmt = select(Notification).where(Notification.id == notification_id, Notification.recipient_id == user_id)
		result = await db.execute(stmt)
		notification = result.scalar_one_or_none()
		if notification is None:
			raise ValueError("Notification not found")
		notification.is_read = True
		notification.read_at = datetime.now(timezone.utc)
		await db.flush()
		return notification

	async def mark_all_read(self, user_id: UUID, db: AsyncSession) -> int:
		stmt = select(Notification).where(Notification.recipient_id == user_id, Notification.is_read.is_(False))
		result = await db.execute(stmt)
		notifications = list(result.scalars().all())
		for notification in notifications:
			notification.is_read = True
			notification.read_at = datetime.now(timezone.utc)
		await db.flush()
		return len(notifications)


notification_service = NotificationService()
