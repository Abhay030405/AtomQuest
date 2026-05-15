from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Select

from app.schemas.common import PaginationMeta


@dataclass
class PaginationParams:
	skip: int
	limit: int
	page: int
	page_size: int


def paginate_query(query: Select, skip: int, limit: int) -> Select:
	return query.offset(skip).limit(limit)


def build_pagination_meta(total: int, page: int, page_size: int) -> PaginationMeta:
	total_pages = (total + page_size - 1) // page_size if page_size else 0
	return PaginationMeta(total=total, page=page, page_size=page_size, total_pages=total_pages)
