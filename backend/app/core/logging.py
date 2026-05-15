from __future__ import annotations

import logging

import structlog

from app.core.config import settings


def configure_logging() -> None:
	shared_processors: list[structlog.typing.Processor] = [
		structlog.processors.TimeStamper(fmt="iso"),
		structlog.processors.add_log_level,
	]

	if settings.debug:
		shared_processors.append(
			structlog.processors.CallsiteParameterAdder(
				[
					structlog.processors.CallsiteParameter.FILENAME,
					structlog.processors.CallsiteParameter.FUNC_NAME,
					structlog.processors.CallsiteParameter.LINENO,
				]
			)
		)

	renderer: structlog.typing.Processor
	if settings.debug:
		renderer = structlog.dev.ConsoleRenderer()
	else:
		renderer = structlog.processors.JSONRenderer()

	structlog.configure(
		processors=[
			*shared_processors,
			structlog.processors.format_exc_info,
			structlog.processors.UnicodeDecoder(),
			renderer,
		],
		wrapper_class=structlog.make_filtering_bound_logger(
			getattr(logging, settings.log_level.upper(), logging.INFO)
		),
		context_class=dict,
		logger_factory=structlog.PrintLoggerFactory(),
		cache_logger_on_first_use=True,
	)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
	return structlog.get_logger(name)
