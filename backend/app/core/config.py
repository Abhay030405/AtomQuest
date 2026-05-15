from __future__ import annotations

from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	app_name: str = "AtomQuest"
	app_version: str = "0.1.0"
	environment: str = "development"

	database_url: str = Field(..., validation_alias="DATABASE_URL")
	secret_key: str = Field(..., validation_alias="SECRET_KEY")

	algorithm: str = "HS256"
	access_token_expire_minutes: int = 15
	refresh_token_expire_days: int = 7

	cors_origins: List[str] = []
	debug: bool | None = None
	log_level: str = "INFO"

	model_config = SettingsConfigDict(env_file=".env", extra="ignore")

	@field_validator("cors_origins", mode="before")
	@classmethod
	def _parse_cors_origins(cls, value: object) -> List[str]:
		if value is None:
			return []
		if isinstance(value, str):
			return [item.strip() for item in value.split(",") if item.strip()]
		if isinstance(value, list):
			return value
		return []

	def model_post_init(self, __context: object) -> None:
		if self.debug is None:
			self.debug = self.environment == "development"


settings = Settings()
