# Ghost backend

Fastify + PostgreSQL + Prisma API for live workflow persistence, Screenpipe-answer formatting, processing plans, contracts, and recording input backups. Browser execution runs in Electron. Prepared NOVA/Forma workflows are stored locally and do not require this API.

Follow the [root setup guide](../README.md#3-optional-backend-and-live-screenpipe-discovery) for the complete system. From the repository root:

```sh
docker compose up -d --wait postgres
npm --prefix backend ci
cp backend/.env.example backend/.env
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:deploy
npm --prefix backend run dev
```

Copy the environment example only for a fresh checkout. Set `DATABASE_URL` and, for AI features, `OPENAI_API_KEY` in `backend/.env`. Containerized API configuration comes from root `.env` instead.

## API

- Health/database: `GET http://127.0.0.1:3001/health`
- Interactive OpenAPI: `http://127.0.0.1:3001/docs/`
- Machine-readable specification: `http://127.0.0.1:3001/docs/json`
- Workflow CRUD: `/api/workflows` and `/api/workflows/:id`
- Final Screenpipe answer formatting: `POST /api/workflow-discovery/format`

Swagger describes the current routes and schemas. The API does not provide general account authentication; use it locally. Development mock discovery endpoints are test facilities, not recorded evidence.

## Build, migrations, checks

```sh
npm --prefix backend run prisma:status
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend test
# Run the compiled API instead of the development watcher:
npm --prefix backend start
```

Tests require a reachable database and a role allowed to create/drop isolated test schemas. They do not reset the application schema. Use `prisma:deploy` to apply checked-in migrations; `prisma:migrate` is for developing new migrations.

Source lives under `src/`, database definitions under `prisma/`, and API tests under `tests/`. Generated Prisma code and `dist/` are ignored. Do not commit `.env` or credentials.
