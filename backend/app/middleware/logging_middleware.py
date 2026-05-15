from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger


logger = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next) -> Response:
		request_id = getattr(request.state, "request_id", None)
		user_agent = request.headers.get("user-agent")
		start = time.perf_counter()

		logger.info(
			"request_started",
			method=request.method,
			path=request.url.path,
			user_agent=user_agent,
			request_id=request_id,
		)

		response = await call_next(request)
		duration_ms = int((time.perf_counter() - start) * 1000)
		user_id = getattr(request.state, "user_id", None)

		log_level = "info"
		if response.status_code >= 500:
			log_level = "error"
		elif response.status_code >= 400:
			log_level = "warning"

		getattr(logger, log_level)(
			"request_completed",
			method=request.method,
			path=request.url.path,
			status_code=response.status_code,
			duration_ms=duration_ms,
			user_id=user_id,
			request_id=request_id,
		)

		return response
