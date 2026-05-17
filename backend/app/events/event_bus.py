from __future__ import annotations

import inspect
from collections import defaultdict
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger


logger = get_logger(__name__)


# Canonical handler signature: async (event_data, db) -> None.
# Handlers MAY be sync (returning None); the bus will detect coroutines and await them.
Handler = Callable[[dict[str, Any], AsyncSession], Awaitable[None] | None]


class EventBus:
	"""In-process async event dispatcher.

	Contract:
	  - All publishes go through ``publish(event_type, event_data, db)``.
	  - Handlers receive the SAME ``db`` session the publisher is using and MUST NOT
	    call ``db.commit()`` themselves. The publishing service owns the transaction.
	  - Handler exceptions propagate. A failed handler aborts the operation and the
	    caller's transaction rolls back. Silent-swallow behavior is deliberately gone.
	"""

	def __init__(self) -> None:
		self.handlers: dict[str, list[Handler]] = defaultdict(list)

	def subscribe(self, event_type: str, handler: Handler) -> None:
		self.handlers[event_type].append(handler)

	def clear(self) -> None:
		"""Drop all subscriptions. Used by tests."""
		self.handlers.clear()

	async def publish(
		self,
		event_type: str,
		event_data: dict[str, Any],
		db: AsyncSession,
	) -> None:
		for handler in self.handlers.get(event_type, []):
			logger.debug(
				"event_dispatch",
				event_type=event_type,
				handler=getattr(handler, "__qualname__", repr(handler)),
			)
			result = handler(event_data, db)
			if inspect.isawaitable(result):
				await result


event_bus = EventBus()

