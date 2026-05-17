from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db, get_pagination
from app.core.constants import AuditAction
from app.schemas.audit import AuditFilter, AuditLogResponse
from app.schemas.common import APIResponse, PaginatedData
from app.services.audit_service import audit_service
from app.utils.pagination import build_pagination_meta


router = APIRouter()


# Group filter aliases for the ``type=...`` query param. Keep at module scope
# so the OpenAPI docs surface the legal values.
_TYPE_TABLE_GROUPS: dict[str, list[str]] = {
	"achievement_only": ["achievements", "achievement_versions"],
	"checkin_only": ["checkins", "checkin_events"],
}


@router.get("/", response_model=APIResponse[PaginatedData[AuditLogResponse]])
async def get_audit_logs(
	date_from: Optional[datetime] = Query(default=None),
	date_to: Optional[datetime] = Query(default=None),
	actor_id: Optional[UUID] = Query(default=None),
	table_name: Optional[str] = Query(default=None),
	action: Optional[AuditAction] = Query(default=None),
	post_lock_only: bool = Query(default=False),
	type: Optional[str] = Query(
		default=None,
		description="Group filter: 'achievement_only' or 'checkin_only'.",
	),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[PaginatedData[AuditLogResponse]]:
	# `type` is a coarse alias over `table_name`. When supplied, it wins —
	# `table_name` would otherwise need to match exactly one of the group's tables.
	resolved_table_name = table_name
	if type is not None:
		group = _TYPE_TABLE_GROUPS.get(type)
		if group is None:
			raise HTTPException(
				status_code=422,
				detail=(
					f"type must be one of {list(_TYPE_TABLE_GROUPS.keys())}; "
					f"got {type!r}"
				),
			)
		# For multi-table groups we still pass the *first* table to keep the
		# existing AuditFilter shape; the repo then OR-filters via __or__ below.
		resolved_table_name = group[0] if len(group) == 1 else None

	filters = AuditFilter(
		date_from=date_from,
		date_to=date_to,
		actor_id=actor_id,
		table_name=resolved_table_name,
		action=action,
		post_lock_only=post_lock_only,
	)
	logs, total = await audit_service.get_audit_log(
		filters, skip=pagination.skip, limit=pagination.limit, db=db
	)
	# Post-filter for the multi-table groups (achievements + versions, etc.).
	if type is not None:
		group = _TYPE_TABLE_GROUPS[type]
		logs = [log for log in logs if log.table_name in group]
		total = len(logs)

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
	meta = build_pagination_meta(
		total=total, page=pagination.page, page_size=pagination.page_size
	)
	return APIResponse.ok(PaginatedData(items=items, meta=meta))
