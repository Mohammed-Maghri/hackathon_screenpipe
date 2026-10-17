# Ghost Docker setup

## What runs where

The root `compose.yaml` starts PostgreSQL, a one-shot Prisma migration job, the Fastify backend, an Nginx-hosted Ghost renderer preview, and the Forma/NOVA Next.js websites.

**The full native Ghost app still runs on the host.** Its frontend needs Electron's preload/IPC bridge for backend workflow management, browser recording, replay, local credentials and processing. The containerized frontend is explicitly labeled **web preview**; it is not a replacement for Electron and does not silently simulate native capabilities. It exposes the backend API and Swagger through the same origin for inspection.

This is a local hackathon setup. Ports bind to `127.0.0.1`; workflow APIs do not yet implement general authentication. Discovery defaults to development mode so the explicitly simulated generation endpoints remain available.

## Start from a fresh checkout

Prerequisites: Docker Engine/Desktop with Compose v2. Node 22.12+ is needed on the host for Electron and the optional smoke script.

Run from the repository root:

```sh
# Only if a root .env does not already exist:
cp .env.example .env
# Edit .env and supply OPENAI_API_KEY if you want AI discovery.
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
```

The root `.env` is separate from `backend/.env`. Compose does not automatically read `backend/.env`. No real credentials are copied into images; the API key is passed to the backend at runtime. Build contexts exclude environment files, local dependencies and generated outputs.

Defaults:

| Service | URL |
| --- | --- |
| Frontend **preview** | http://127.0.0.1:8080 |
| Backend | http://127.0.0.1:3001 |
| API/database health | http://127.0.0.1:3001/health |
| Swagger | http://127.0.0.1:3001/docs/ or http://127.0.0.1:8080/docs/ |
| Forma | http://127.0.0.1:3100/login |
| NOVA | http://127.0.0.1:3100/nova/login |
| PostgreSQL host connection | 127.0.0.1:5433 |

The migration container exiting with code 0 is expected. The backend waits for that successful exit; migrations wait for a healthy database. A migration failure prevents API startup.

## Start the actual desktop frontend

From another terminal at the repository root:

```sh
npm ci
npm run dev
```

The Electron main process defaults to the API on port 3001. Teach a node using `http://127.0.0.1:3100/login` or `/nova/login`. Inside Ghost, use host URLs, not Compose service names like `fixtures` or `backend`.

If you change BACKEND_PORT in the root `.env`, also set the desktop variable explicitly:

```sh
GHOST_BACKEND_URL=http://127.0.0.1:3002 npm run dev
```

PowerShell: `$env:GHOST_BACKEND_URL = 'http://127.0.0.1:3002'`, then `npm run dev`.

## Verify the stack

```sh
docker compose ps -a
docker compose logs --tail=80 migrate backend
node scripts/check-docker.mjs
```

The smoke script reads root `.env` port settings, verifies frontend labeling/proxy, API/database CRUD, Swagger, fixture login routes and NOVA artwork. It creates a uniquely named disposable workflow and deletes it afterward. It does not call AI, send messages, or run browser actions.

For manual persistence verification, create a demo workflow in Electron, restart the stack, and confirm that the same workflow is still listed. Record/replay acceptance must be run through Electron separately; HTTP smoke checks do not establish automation reliability.

## Configuration

`.env.example` lists host ports, local database credentials, development mode and OpenAI settings. The backend uses the internal `postgres:5432` address regardless of the published host PostgreSQL port.

For the local preset, keep POSTGRES_USER/POSTGRES_DB to simple identifiers and use a URL-safe password: Compose interpolates them into DATABASE_URL. If you need arbitrary password characters, configure an appropriately URL-encoded database connection separately instead of entering a raw reserved character in the URL. Changing credentials after a volume is initialized does not change the PostgreSQL user's existing password.

`GHOST_API_ENV=production` disables development mock discovery; it does not add authentication or make this stack production-ready. Custom FRONTEND_PORT users should update CORS_ORIGINS if making direct browser API calls. The built renderer uses the existing native bridge, so a different CORS setting alone does not enable web workflow management.

Do not run the old `backend/compose.yaml` database and the root stack on the same default port simultaneously. The root project uses its own named database volume and does **not** automatically import the old database or a remote development database. Stop the previous local stack or choose unused host ports. Existing data requires a deliberate backup/restore.

## Updates and shutdown

```sh
# Apply code/image changes and pending migrations:
docker compose up --build -d --wait --wait-timeout 180
# After changing only environment configuration:
docker compose up -d --wait
# Stop services and retain the database volume:
docker compose down
# Start again:
docker compose up -d --wait
```

Do not use `down --volumes` unless you intend to delete this stack's database. Never use a database reset to fix a failed migration without first inspecting it. Local Electron recordings, browser cookies, keys and artifacts are not stored in the Compose database volume.

## Implementation details

- `backend/Dockerfile`: Node 24/Debian, OpenSSL, dependency/build stages, migration target, and a non-root API runtime with production dependencies.
- `Dockerfile`: builds the existing renderer without installing Electron binaries, then serves it through Nginx on port 8080. The two shared backend contract modules are included in the frontend build context.
- `docker/nginx.conf`: static preview plus `/api`, `/health` and `/docs` reverse proxy. No Electron IPC implementation is injected.
- `tests/Dockerfile`: standalone Next.js runtime, static/public assets and non-root execution. The server binds to all container interfaces; published host ports remain loopback-only.
- `.dockerignore` files: keep private configuration and host build/dependency directories out of images.
- `vite.web.config.ts`: preview-only notice; the Electron Vite configuration is unchanged.
- `tests/next.config.ts`: standalone build output for the fixture container; normal npm development remains available.

Startup dependency handling follows [Docker Compose service conditions](https://docs.docker.com/reference/compose-file/services/). The backend image follows [Prisma's Docker deployment guidance](https://www.prisma.io/docs/guides/deployment/docker).

## Verification status

Local renderer build and root TypeScript check passed. The backend build including Prisma generation passed. The Next.js standalone build passed. Compose YAML parsing and dependency/port configuration checks passed. The standalone Next.js server served Forma login, NOVA login and NOVA artwork successfully. A renderer build using only the Docker source inputs plus existing root dependencies also passed. The smoke script passed JavaScript syntax checking; its full container checks remain unrun.

**Docker is not installed in the implementation environment.** Image builds, Nginx runtime, migration ordering and the full container smoke script have not been executed there. Validate them with the commands above on a Docker-capable machine before calling the deployment verified. The laptop also has limited free disk space; no Docker installation or large image downloads were performed as part of this change.
