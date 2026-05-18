# ---------------------------------------------------------------------------
# AtomQuest backend — production image (used by Railway)
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base

# - PYTHONUNBUFFERED: stream logs straight to stdout (Railway log capture)
# - PYTHONDONTWRITEBYTECODE: no .pyc clutter in the image
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so this layer is cached unless requirements change.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code (respect .dockerignore — .env / tests are excluded).
COPY . .

# Run as an unprivileged user.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

# Local default; Railway injects its own $PORT at runtime.
EXPOSE 8000

# Container-level healthcheck (Railway also uses healthcheckPath in railway.json).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import os,urllib.request,sys; \
url='http://127.0.0.1:%s/health' % os.environ.get('PORT','8000'); \
sys.exit(0 if urllib.request.urlopen(url, timeout=4).status == 200 else 1)"

# start.sh runs DB migrations, then launches uvicorn bound to $PORT.
CMD ["sh", "./start.sh"]
