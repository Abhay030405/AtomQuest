"""Integration-test isolation.

pytest-asyncio (mode=auto) gives every test its own event loop. Asyncpg
connections cached in the global engine pool are bound to the loop that
opened them, so a second test reusing a pooled connection trips
``RuntimeError: Event loop is closed``. Dispose the engine between tests
so each one starts with a fresh pool tied to its own loop.
"""

from __future__ import annotations

import pytest_asyncio

from app.core.database import engine


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_between_tests():
	yield
	await engine.dispose()
