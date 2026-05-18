from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.department import Department
from app.schemas.common import APIResponse, BaseSchema


router = APIRouter()


class DepartmentResponse(BaseSchema):
	id: UUID
	name: str


@router.get("/", response_model=APIResponse[list[DepartmentResponse]])
async def list_departments(
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_user),
) -> APIResponse[list[DepartmentResponse]]:
	"""List all departments. Available to any authenticated user so admins can
	wire up create-personnel form dropdowns without needing extra permissions."""
	stmt = select(Department).where(Department.is_deleted.is_(False)).order_by(Department.name)
	result = await db.execute(stmt)
	departments = list(result.scalars().all())
	return APIResponse.ok(
		[DepartmentResponse.model_validate({"id": d.id, "name": d.name}) for d in departments]
	)
