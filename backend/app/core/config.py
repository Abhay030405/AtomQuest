from __future__ import annotations

from typing import List
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Params that asyncpg does not accept as connection kwargs
_ASYNCPG_INCOMPATIBLE_PARAMS = {"sslmode", "channel_binding", "ssl", "options"}


class Settings(BaseSettings):
	app_name: str = "AtomQuest"
	app_version: str = "0.1.0"
	environment: str = "development"

	database_url: str = Field(..., validation_alias="DATABASE_URL")
	secret_key: str = Field(..., validation_alias="SECRET_KEY")

	algorithm: str = "HS256"
	access_token_expire_minutes: int = 480
	refresh_token_expire_days: int = 7

	cors_origins: List[str] = []
	db_ssl: bool = Field(default=True, validation_alias="DB_SSL")
	debug: bool | None = None
	log_level: str = "INFO"

	# Azure AD / Microsoft SSO
	azure_client_id: str | None = Field(default=None, validation_alias="AZURE_CLIENT_ID")
	azure_tenant_id: str | None = Field(default=None, validation_alias="AZURE_TENANT_ID")
	azure_client_secret: str | None = Field(default=None, validation_alias="AZURE_CLIENT_SECRET")
	azure_redirect_uri: str = Field(
		default="http://localhost:8080/api/v1/auth/azure/callback",
		validation_alias="AZURE_REDIRECT_URI",
	)
	frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")
	# Role assigned to new users auto-provisioned via SSO. "admin" is the default for hackathon
	# demos; set to "employee" in production.
	azure_sso_default_role: str = Field(default="admin", validation_alias="AZURE_SSO_DEFAULT_ROLE")

	model_config = SettingsConfigDict(env_file=".env", extra="ignore")

	@property
	def async_database_url(self) -> str:
		url = self.database_url
		for prefix in ("postgresql://", "postgres://"):
			if url.startswith(prefix):
				url = "postgresql+asyncpg://" + url[len(prefix):]
				break
		parsed = urlparse(url)
		params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
		for p in _ASYNCPG_INCOMPATIBLE_PARAMS:
			params.pop(p, None)
		clean_query = urlencode(params) if params else ""
		return urlunparse(parsed._replace(query=clean_query))

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