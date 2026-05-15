from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
	model_config = ConfigDict(from_attributes=True)


class ErrorDetail(BaseSchema):
	code: str
	message: str
	field: Optional[str] = None


T = TypeVar("T")


class APIResponse(BaseSchema, Generic[T]):
	success: bool
	data: Optional[T] = None
	error: Optional[ErrorDetail] = None
	meta: Optional[dict[str, Any]] = None

	@classmethod
	def ok(cls, data: T) -> "APIResponse[T]":
		return cls(success=True, data=data, error=None, meta=None)

	@classmethod
	def fail(cls, code: str, message: str, field: Optional[str] = None) -> "APIResponse[T]":
		return cls(
			success=False,
			data=None,
			error=ErrorDetail(code=code, message=message, field=field),
			meta=None,
		)


class PaginationMeta(BaseSchema):
	total: int
	page: int
	page_size: int
	total_pages: int


class PaginatedData(BaseSchema, Generic[T]):
	items: list[T]
	meta: PaginationMeta
