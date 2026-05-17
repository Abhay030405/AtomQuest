from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.exceptions import atomquest_exception_handler, validation_exception_handler, AtomQuestException
from app.core.logging import configure_logging
from app.events import setup_handlers
from app.middleware import LoggingMiddleware, RequestIdMiddleware
from app.services.rbac_service import rbac_service


def create_app() -> FastAPI:
	docs_url = "/docs" if settings.environment != "production" else None
	openapi_url = "/openapi.json" if settings.environment != "production" else None

	app = FastAPI(
		title="AtomQuest Goal Portal API",
		version="1.0.0",
		description="Goal management and review platform for AtomQuest.",
		docs_url=docs_url,
		openapi_url=openapi_url,
	)

	app.add_exception_handler(AtomQuestException, atomquest_exception_handler)
	app.add_exception_handler(RequestValidationError, validation_exception_handler)

	app.add_middleware(RequestIdMiddleware)
	app.add_middleware(LoggingMiddleware)
	app.add_middleware(
		CORSMiddleware,
		allow_origins=settings.cors_origins,
		allow_credentials=True,
		allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allow_headers=["*"],
	)

	@app.on_event("startup")
	async def on_startup() -> None:
		configure_logging()
		if settings.environment == "development":
			await init_db()
		setup_handlers()
		async with AsyncSessionLocal() as db:
			await rbac_service.verify_db_consistency(db)

	@app.get("/health")
	async def health() -> dict[str, str]:
		return {
			"status": "healthy",
			"version": settings.app_version,
			"environment": settings.environment,
		}

	app.include_router(api_router, prefix="/api/v1")
	return app


app = create_app()
