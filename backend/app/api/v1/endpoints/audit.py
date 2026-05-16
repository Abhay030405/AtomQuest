from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db, get_pagination
from app.core.constants import AuditAction
from app.schemas.audit import AuditFilter, AuditLogResponse
from app.schemas.common import APIResponse, PaginatedData
from app.services.audit_service import audit_service
from app.utils.pagination import build_pagination_meta


router = APIRouter()


@router.get("/", response_model=APIResponse[PaginatedData[AuditLogResponse]])
async def get_audit_logs(
	date_from: Optional[datetime] = Query(default=None),
	date_to: Optional[datetime] = Query(default=None),
	actor_id: Optional[UUID] = Query(default=None),
	table_name: Optional[str] = Query(default=None),
	action: Optional[AuditAction] = Query(default=None),
	post_lock_only: bool = Query(default=False),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[PaginatedData[AuditLogResponse]]:
	filters = AuditFilter(
		date_from=date_from,
		date_to=date_to,
		actor_id=actor_id,
		table_name=table_name,
		action=action,
		post_lock_only=post_lock_only,
	)
	logs, total = await audit_service.get_audit_log(filters, skip=pagination.skip, limit=pagination.limit, db=db)
	items = [
		AuditLogResponse.model_validate(
			{
				"id": log.id,
				"table_name": log.table_name,
				"record_id": log.record_id,
				"action": log.action,
				"field_name": log.field_name,
				"old_value": log.old_value,
				"new_value": log.new_value,
				"actor_id": log.actor_id,
				"actor_name": log.actor.full_name if getattr(log, "actor", None) else "",
				"actor_role": log.actor_role,
				"changed_at": log.changed_at,
			}
		)
		for log in logs
	]
	meta = build_pagination_meta(total=total, page=pagination.page, page_size=pagination.page_size)
	return APIResponse.ok(PaginatedData(items=items, meta=meta))
