from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings


engine = create_async_engine(
	settings.database_url,
	echo=settings.debug is True,
)

AsyncSessionLocal = async_sessionmaker(
	bind=engine,
	class_=AsyncSession,
	expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
	session: AsyncSession = AsyncSessionLocal()
	try:
		yield session
	finally:
		await session.close()


async def init_db() -> None:
	if not settings.debug:
		return
	async with engine.begin() as connection:
		await connection.run_sync(Base.metadata.create_all)
