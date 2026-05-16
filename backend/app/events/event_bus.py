from __future__ import annotations

import inspect
from collections import defaultdict
from typing import Any, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger


logger = get_logger(__name__)


class EventBus:
	def __init__(self) -> None:
		self.handlers: dict[str, list[Callable[..., None]]] = defaultdict(list)

	def subscribe(self, event_type: str, handler: Callable[..., None]) -> None:
		self.handlers[event_type].append(handler)

	def publish(self, event_type: str, event_data: dict[str, Any]) -> None:
		for handler in self.handlers.get(event_type, []):
			try:
				if inspect.iscoroutinefunction(handler):
					raise RuntimeError("Async handler used with publish")
				handler(event_data)
			except Exception as exc:  # pragma: no cover
				logger.error("event_handler_failed", event_type=event_type, error=str(exc))

	async def publish_async(self, event_type: str, event_data: dict[str, Any], db: AsyncSession) -> None:
		for handler in self.handlers.get(event_type, []):
			try:
				result = handler(event_data, db)
				if inspect.isawaitable(result):
					await result
			except Exception as exc:  # pragma: no cover
				logger.error("event_handler_failed", event_type=event_type, error=str(exc))


event_bus = EventBus()
