from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from app.core.constants import NotificationType
from app.schemas.common import BaseSchema


class NotificationResponse(BaseSchema):
    id: UUID
    notification_type: NotificationType
    title: str
    body: str
    is_read: bool
    read_at: Optional[datetime] = None
    deep_link: Optional[str] = None
    related_goal_id: Optional[UUID] = None
    created_at: datetime


class UnreadCountResponse(BaseSchema):
    count: int
