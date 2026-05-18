# AtomQuest — Deployment Guide

End-to-end instructions to take AtomQuest from local code to a live URL.

- **Database** → Neon (managed Postgres)
- **Backend** → Railway (Docker image)
- **Frontend** → Vercel (static Vite build)

This guide goes from the absolute basics to advanced tuning. If you have
never deployed anything before, just follow the parts in order.

---

## 0. Architecture at a glance

```
                 HTTPS                         HTTPS / asyncpg (SSL)
  ┌──────────┐  ───────►  ┌─────────────────┐  ───────►  ┌──────────────┐
  │ Browser  │            │ Backend (API)   │            │  Neon         │
  │ Vercel   │  ◄───────  │ Railway (Docker)│  ◄───────  │  Postgres     │
  │ React SPA│   JSON     │ FastAPI/uvicorn │   rows     │  (serverless) │
  └──────────┘            └─────────────────┘            └──────────────┘
   VITE_API_URL ───────────────► /api/v1/...
```

Key facts about *this* codebase you must know before deploying:

1. **The frontend talks to the backend via one env var: `VITE_API_URL`.**
   It is read at **build time** by Vite and **must end in `/api`** because the
   API client appends `/v1/...` to it
   (`frontend/src/services/api-client.ts`). Final calls look like
   `https://<backend>/api/v1/auth/login`.
2. **Migrations do NOT run automatically in production.** The app only
   auto-creates tables when `ENVIRONMENT=development`. The backend container's
   `start.sh` runs `alembic upgrade head` on every boot to fix this. Migrations
   also seed the RBAC permission rows the app verifies at startup — so this is
   mandatory, not optional.
3. **CORS is driven by the `CORS_ORIGINS` env var** and must be a **JSON
   array string**, e.g. `["https://app.vercel.app"]`. If the frontend origin
   is missing here, every browser request fails with a CORS error.
4. **Neon connection strings work as-is.** The config layer
   (`backend/app/core/config.py`) converts `postgresql://` → `asyncpg` and
   strips Neon-only params (`sslmode`, `channel_binding`). Keep `DB_SSL=true`.

---

## 1. Prerequisites

| You need | Where | Notes |
|---|---|---|
| GitHub repo | github.com | Code must be pushed; Railway & Vercel deploy from Git. |
| Neon account | https://neon.tech | Free tier is fine. |
| Railway account | https://railway.app | Free trial / Hobby plan. |
| Vercel account | https://vercel.com | Free Hobby plan. |
| (Optional) Docker Desktop | local | Only for local `docker compose` testing. |
| (Optional) Railway CLI | `npm i -g @railway/cli` | For seeding / logs from terminal. |

Push your latest code first:

```powershell
git add .
git commit -m "Add deployment config (Docker, Railway, Vercel)"
git push origin master
```

---

## 2. Database — Neon

> You already have a working Neon database. If so, skip to step 2.3 and just
> copy the connection string. Steps 2.1–2.2 are for creating a fresh one
> (recommended for a clean production DB separate from dev/testing).

### 2.1 Create the project
1. Log in at https://console.neon.tech.
2. **New Project** → name it `atomquest-prod` → pick a region close to your
   Railway region (e.g. AWS `us-east-1`) → **Create**.

### 2.2 Create the database
Neon creates a default DB (often `neondb`). That's fine — no extra step
needed. You can rename or add one under **Branches → Tables** if you prefer.

### 2.3 Get the connection string
1. Project dashboard → **Connect** (or **Connection Details**).
2. Choose the **Pooled connection** (recommended for serverless backends —
   it tolerates many short-lived connections).
3. Copy the URL. It looks like:

   ```
   postgresql://neondb_owner:XXXX@ep-something-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

Save this — it becomes the `DATABASE_URL` env var on Railway. You do **not**
need to strip the `?sslmode=...` part; the app handles it.

> **Migrations:** you do **not** run migrations manually against Neon. The
> backend container runs `alembic upgrade head` automatically on first boot
> (see Part 3). The schema is created for you on the first successful deploy.

---

## 3. Backend — Railway (Docker)

The backend deploys from `backend/Dockerfile`. Railway will build that image,
inject env vars, run migrations, and start uvicorn on its `$PORT`.

### 3.1 Create the service
1. Log in at https://railway.app → **New Project** → **Deploy from GitHub
   repo** → authorize and select your AtomQuest repo.
2. Railway creates a service from the repo. Open the service → **Settings**.
3. **Root Directory**: set to `backend`.
   *(Critical — this is a monorepo. Railway must build from `backend/`, where
   the `Dockerfile` and `railway.json` live.)*
4. **Build**: Railway auto-detects the `Dockerfile`. `backend/railway.json`
   already configures the builder, the start command, and the
   `/health` healthcheck — no manual build settings needed.

### 3.2 Set environment variables
Service → **Variables** → add each of these (Raw editor is fastest):

| Variable | Value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | *Neon pooled URL from 2.3* | ✅ | Paste exactly, including `?sslmode=require...`. |
| `DB_SSL` | `true` | ✅ | Neon requires SSL. |
| `SECRET_KEY` | *a 64-hex random string* | ✅ | See generator below. **Do not reuse the dev key.** |
| `ENVIRONMENT` | `production` | ✅ | Disables `/docs` & `/openapi.json`. Use `staging` if you want docs exposed. |
| `CORS_ORIGINS` | `["https://YOUR-APP.vercel.app"]` | ✅ | JSON array string. Add your Vercel domain here (fill in after Part 4). |
| `ALGORITHM` | `HS256` | ⬜ | Default is already `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | ⬜ | Default `480`. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | ⬜ | Default `7`. |
| `RUN_MIGRATIONS` | `true` | ⬜ | Default `true`. Set `false` only to skip the boot-time `alembic upgrade head`. |
| `WEB_CONCURRENCY` | `1` | ⬜ | uvicorn worker count. Raise for more CPU (see Advanced). |
| `LOG_LEVEL` | `INFO` | ⬜ | |

Do **not** set `PORT` — Railway injects it automatically and `start.sh`
reads it.

Generate a strong `SECRET_KEY`:

```powershell
# PowerShell
python -c "import secrets; print(secrets.token_hex(32))"
```

> Chicken-and-egg with `CORS_ORIGINS`: you won't know your Vercel URL until
> Part 4. For now set it to a placeholder like `["http://localhost:5173"]`
> and update it after the frontend is live (Part 5).

### 3.3 Generate a public domain
Service → **Settings → Networking → Generate Domain**. Railway gives you
something like:

```
https://atomquest-backend-production.up.railway.app
```

Copy it — this is your backend base URL.

### 3.4 Deploy & verify
Railway auto-deploys on the first save and on every push to `master`.
Watch **Deployments → View Logs**. A healthy boot prints:

```
[start] Applying database migrations (alembic upgrade head)...
INFO  [alembic.runtime.migration] Running upgrade ... -> 016_...
[start] Starting AtomQuest API on 0.0.0.0:XXXX ...
INFO:     Uvicorn running on http://0.0.0.0:XXXX
INFO:     Application startup complete.
```

Then test the health endpoint in a browser or terminal:

```powershell
curl https://atomquest-backend-production.up.railway.app/health
# -> {"status":"healthy","version":"...","environment":"production"}
```

If the healthcheck fails, see [Troubleshooting](#8-troubleshooting).

### 3.5 (Optional) Seed demo data
The repo includes a seed script with demo users. Run it once, from your
machine, against the production DB using the Railway CLI:

```powershell
npm i -g @railway/cli
railway login
railway link        # pick the project + backend service
railway run python scripts/seed_data.py
```

`railway run` injects the service's env vars (including `DATABASE_URL`) into
your local shell, so the script writes to the Neon DB. Only do this on a
fresh database — re-running may create duplicates.

---

## 4. Frontend — Vercel

The frontend is a static Vite build. Vercel builds it natively (it does
**not** use `frontend/Dockerfile`).

### 4.1 Import the project
1. Log in at https://vercel.com → **Add New… → Project**.
2. Import your AtomQuest GitHub repo.
3. **Root Directory**: click **Edit** → select `frontend`. *(Critical — same
   monorepo reason as Railway.)*
4. **Framework Preset**: Vercel detects **Vite** automatically. Build command
   `npm run build` and output dir `dist` are already declared in
   `frontend/vercel.json` along with the SPA rewrite (so React Router deep
   links like `/admin/personnel` don't 404 on refresh).

### 4.2 Set the environment variable
Before the first build, expand **Environment Variables** and add:

| Key | Value | Environments |
|---|---|---|
| `VITE_API_URL` | `https://atomquest-backend-production.up.railway.app/api` | Production (and Preview if you want) |

> ⚠️ **Must end with `/api`.** Use the Railway domain from step 3.3 + `/api`.
> No trailing slash after `api`. Wrong value here = every API call 404s.

### 4.3 Deploy
Click **Deploy**. Vercel installs (`npm ci`), builds (`tsc -b && vite build`),
and publishes. You get a URL like:

```
https://atomquest.vercel.app
```

Vercel auto-redeploys on every push to `master`.

> If the build fails on a Node version error, Vercel honors `.nvmrc`
> (Node `22`) and the `engines` field in `package.json`. Confirm the Project
> → Settings → **Node.js Version** is 20.x or newer.

---

## 5. Wire the two together (the part everyone forgets)

After both are live you must close the loop:

1. **Tell the backend about the frontend (CORS).**
   Railway → backend service → **Variables** → set:

   ```
   CORS_ORIGINS=["https://atomquest.vercel.app"]
   ```

   Add every origin that will call the API (custom domain, preview URLs),
   comma-separated inside the JSON array:

   ```
   CORS_ORIGINS=["https://atomquest.vercel.app","https://app.yourdomain.com"]
   ```

   Saving a variable triggers a redeploy. Wait for it to go green.

2. **Confirm the frontend points at the backend.**
   It already does if `VITE_API_URL` was set in 4.2. If you change it later,
   you must **redeploy the frontend** (Vite bakes env vars at build time —
   Vercel → Deployments → ⋯ → **Redeploy**).

---

## 6. Verify the full stack

1. Open `https://atomquest.vercel.app`.
2. Open browser DevTools → **Network** tab.
3. Log in. You should see a request to
   `https://<backend>.up.railway.app/api/v1/auth/login` returning **200**.
4. Navigate around, then hard-refresh on a deep route (e.g.
   `/admin/personnel`) — it should load, not 404 (SPA rewrite working).

Checklist if something is red:

- **CORS error in console** → frontend origin not in backend `CORS_ORIGINS`
  (must be exact, `https://`, no trailing slash), or backend not redeployed.
- **All API calls 404** → `VITE_API_URL` missing `/api`, or frontend not
  rebuilt after setting it.
- **401 immediately** → expected before login; after login check the token
  is stored (DevTools → Application → Local Storage → `atomquest-auth`).
- **500 on first call** → migrations didn't run; check Railway logs for the
  `alembic upgrade head` block.

---

## 7. Local full-stack test with Docker (optional)

To validate the exact production images before pushing, use the root
`docker-compose.yml`. It runs a **local** Postgres so you don't touch Neon.

```powershell
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:8000  (docs at http://localhost:8000/docs)
- Postgres → localhost:5432

If those host ports clash with another local project, override them (the
frontend's API URL and CORS adjust automatically):

```powershell
$env:BACKEND_PORT=8080; $env:FRONTEND_PORT=5174; docker compose up --build
```

Stop and wipe the local DB volume:

```powershell
docker compose down -v
```

> The Postgres password and `SECRET_KEY` in `docker-compose.yml` are
> intentional **local-only throwaway values** (a static-analysis tool will
> flag the password — that is expected and safe for local dev). Never reuse
> them anywhere real; production secrets live only in Railway's Variables.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Railway healthcheck fails / deploy keeps restarting | App crashed on startup — usually bad `DATABASE_URL` or missing `SECRET_KEY` | Open deploy logs; verify both vars; ensure Neon URL copied fully. |
| `alembic upgrade head` errors | DB unreachable or migrations conflict | Check `DATABASE_URL`, that Neon project is active (not suspended), and `DB_SSL=true`. |
| CORS error in browser | Frontend origin not allowed | Add exact Vercel URL to backend `CORS_ORIGINS` JSON array; wait for redeploy. |
| Every request → 404 | `VITE_API_URL` wrong (missing `/api` or stale) | Fix the var in Vercel and **Redeploy** the frontend. |
| Deep-link refresh → 404 | SPA rewrite missing | Confirm `frontend/vercel.json` exists and Root Directory = `frontend`. |
| Vercel build fails: Node engine | Node too old | `.nvmrc`=22 / set Node ≥20 in Vercel project settings. |
| Railway builds wrong service / no Dockerfile found | Root Directory not set | Settings → Root Directory = `backend`. |
| `/docs` returns 404 in prod | Intentional — disabled when `ENVIRONMENT=production` | Set `ENVIRONMENT=staging` if you need Swagger exposed. |
| DB "No active cycle" / goal creation fails | Cycle config not seeded/active | Run the seed script (3.5) or activate a cycle in admin. |

View logs anytime:

```powershell
railway logs            # backend (Railway CLI, after `railway link`)
# Frontend build logs: Vercel dashboard -> Deployments -> a deployment -> Logs
```

---

## 9. Advanced

### 9.1 Custom domains
- **Backend (Railway):** Service → Settings → Networking → **Custom Domain**
  → add `api.yourdomain.com` → create the shown CNAME at your DNS provider.
  Then add it to `CORS_ORIGINS` is *not* needed (that's for browser origins),
  but **do** update Vercel `VITE_API_URL` to `https://api.yourdomain.com/api`
  and redeploy the frontend.
- **Frontend (Vercel):** Project → Settings → Domains → add
  `app.yourdomain.com`. Then add `https://app.yourdomain.com` to the backend
  `CORS_ORIGINS` array and let Railway redeploy.

### 9.2 Scaling the backend
`start.sh` runs uvicorn with `--workers ${WEB_CONCURRENCY:-1}`. To use more
CPU on a larger Railway plan, set `WEB_CONCURRENCY=2` (rule of thumb:
`2 × vCPU`). Each worker re-runs the startup hook (RBAC consistency check),
which is safe and idempotent. For heavier production loads, switch
`start.sh` to gunicorn with the uvicorn worker class:

```sh
exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:"${PORT}" \
  --workers "${WEB_CONCURRENCY:-2}"
```

(Add `gunicorn` to `requirements.txt` if you do this.)

### 9.3 Reproducible builds
`requirements.txt` is currently unpinned. For deterministic production
images, pin versions (`pip freeze > requirements.txt` from a known-good
virtualenv) so a rebuild can't pull a breaking transitive update.

### 9.4 Migrations strategy
Boot-time migrations are simple and correct for a single replica. With
multiple replicas, two containers could run `alembic upgrade head`
concurrently. To avoid that, set `RUN_MIGRATIONS=false` on the service and
run migrations as a separate one-off step before promoting a release:

```powershell
railway run alembic upgrade head
```

### 9.5 Disable boot migrations for fast restarts
Once the schema is stable and you migrate out-of-band (9.4), keeping
`RUN_MIGRATIONS=false` shaves a few seconds off every cold start.

### 9.6 Auto-deploy & branches
Both platforms deploy from Git automatically:
- Railway → every push to the connected branch (`master`) redeploys backend.
- Vercel → every push to `master` = Production; every PR = a Preview URL.
  Add `VITE_API_URL` to the **Preview** environment too if you want previews
  to hit the live backend (and add the preview origin to `CORS_ORIGINS`, or
  use a wildcard-friendly staging origin).

### 9.7 Security checklist before going live
- [ ] `SECRET_KEY` is a fresh 64-hex value, **not** the dev key in `.env`.
- [ ] `ENVIRONMENT=production` (Swagger/openapi disabled).
- [ ] `CORS_ORIGINS` lists only domains you control (no `*`).
- [ ] Neon connection uses the **pooled** endpoint + `DB_SSL=true`.
- [ ] No real secrets committed to git (`backend/.env` is gitignored;
      `.dockerignore` excludes it from the image).
- [ ] Rotate the dev `SECRET_KEY`/DB password that already exist in
      `backend/.env` if that file was ever shared.

---

## 10. Quick reference

| Thing | Value / Location |
|---|---|
| Backend Dockerfile | `backend/Dockerfile` |
| Backend entrypoint | `backend/start.sh` (migrations → uvicorn on `$PORT`) |
| Railway config | `backend/railway.json` (Root Dir = `backend`) |
| Frontend Vercel config | `frontend/vercel.json` (Root Dir = `frontend`) |
| Frontend API var | `VITE_API_URL` = `https://<backend>/api` |
| Backend health | `GET /health` |
| API base path | `/api/v1` |
| Local full stack | `docker compose up --build` |
| Seed demo data | `railway run python scripts/seed_data.py` |
