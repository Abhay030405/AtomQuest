from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from app.core.constants import AuditAction, UserRole
from app.schemas.common import BaseSchema


class AuditLogResponse(BaseSchema):
	id: UUID
	table_name: str
	record_id: UUID
	action: AuditAction
	field_name: Optional[str] = None
	old_value: Optional[str] = None
	new_value: Optional[str] = None
	actor_id: UUID
	actor_name: str
	actor_role: UserRole
	changed_at: datetime


class AuditFilter(BaseSchema):
	date_from: Optional[datetime] = None
	date_to: Optional[datetime] = None
	actor_id: Optional[UUID] = None
	table_name: Optional[str] = None
	action: Optional[AuditAction] = None
	post_lock_only: bool = False
