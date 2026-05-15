from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import uuid4

from fastapi import HTTPException, status
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
	return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
	return pwd_context.verify(plain, hashed)


def _build_token_payload(data: Dict[str, Any], token_type: str, expires_delta: timedelta) -> Dict[str, Any]:
	now = datetime.now(timezone.utc)
	payload = dict(data)
	payload.update(
		{
			"type": token_type,
			"iat": int(now.timestamp()),
			"exp": int((now + expires_delta).timestamp()),
			"jti": str(uuid4()),
		}
	)
	return payload


def create_access_token(data: Dict[str, Any]) -> str:
	expires = timedelta(minutes=settings.access_token_expire_minutes)
	payload = _build_token_payload(data, "access", expires)
	return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: Dict[str, Any]) -> str:
	expires = timedelta(days=settings.refresh_token_expire_days)
	payload = _build_token_payload(data, "refresh", expires)
	return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Dict[str, Any]:
	try:
		payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
		token_type = payload.get("type")
		if token_type not in {"access", "refresh"}:
			raise HTTPException(
				status_code=status.HTTP_401_UNAUTHORIZED,
				detail="Invalid token type",
			)
		return payload
	except ExpiredSignatureError as exc:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Token has expired",
		) from exc
	except JWTError as exc:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token",
		) from exc
