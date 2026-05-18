#!/bin/sh
# ---------------------------------------------------------------------------
# Container entrypoint for the AtomQuest backend.
#
# Production startup does NOT auto-create tables (app only does that in
# development), so we apply Alembic migrations here before the API boots.
# Migrations also seed the RBAC permission rows that the app verifies on
# startup, so this step is required, not optional.
# ---------------------------------------------------------------------------
set -e

PORT="${PORT:-8000}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[start] Applying database migrations (alembic upgrade head)..."
  alembic upgrade head
else
  echo "[start] RUN_MIGRATIONS=false — skipping migrations."
fi

echo "[start] Starting AtomQuest API on 0.0.0.0:${PORT} ..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --proxy-headers \
  --forwarded-allow-ips '*' \
  --workers "${WEB_CONCURRENCY:-1}"
