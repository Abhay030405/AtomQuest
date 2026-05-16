from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_pagination
from app.core.exceptions import AtomQuestException
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services.notification_service import notification_service
from app.utils.pagination import build_pagination_meta


router = APIRouter()


def _build_notification_response(notification) -> NotificationResponse:
	return NotificationResponse.model_validate(
		{
			"id": notification.id,
			"notification_type": notification.notification_type,
			"title": notification.title,
			"body": notification.body,
			"is_read": notification.is_read,
			"read_at": notification.read_at,
			"deep_link": notification.deep_link,
			"related_goal_id": notification.related_goal_id,
			"created_at": notification.created_at,
		}
	)


@router.get("/", response_model=APIResponse[PaginatedData[NotificationResponse]])
async def list_notifications(
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[PaginatedData[NotificationResponse]]:
	notifications = await notification_service.get_for_user(
		current_user.id, skip=pagination.skip, limit=pagination.limit, db=db
	)
	items = [_build_notification_response(n) for n in notifications]
	# Total count requires a separate query; use len(items) as approximation for pagination
	meta = build_pagination_meta(total=len(items) + pagination.skip, page=pagination.page, page_size=pagination.page_size)
	return APIResponse.ok(PaginatedData(items=items, meta=meta))


@router.get("/unread-count", response_model=APIResponse[UnreadCountResponse])
async def get_unread_count(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[UnreadCountResponse]:
	count = await notification_service.get_unread_count(current_user.id, db)
	return APIResponse.ok(UnreadCountResponse(count=count))


@router.patch("/{notification_id}/read", response_model=APIResponse[NotificationResponse])
async def mark_notification_read(
	notification_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[NotificationResponse]:
	try:
		notification = await notification_service.mark_read(notification_id, current_user.id, db)
	except ValueError:
		raise AtomQuestException("NOTIFICATION_NOT_FOUND", "Notification not found", 404)
	await db.commit()
	await db.refresh(notification)
	return APIResponse.ok(_build_notification_response(notification))


@router.post("/mark-all-read", response_model=APIResponse[dict])
async def mark_all_notifications_read(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_user),
) -> APIResponse[dict]:
	count = await notification_service.mark_all_read(current_user.id, db)
	await db.commit()
	return APIResponse.ok({"marked_read": count})
