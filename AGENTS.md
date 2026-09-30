# StreamFlow v2 — Agent Guide

## Workspace Structure

```
streamflow-v2/
├── apps/api/          # Fastify API (Node.js, ESM, TypeScript)
├── worker/            # BullMQ job worker (FFmpeg transcoding)
├── frontend/          # Next.js 15 frontend
└── docker-compose.yml # Postgres 16, Redis, SeaweedFS, API, Worker, Frontend
```

Note: the `packages/*` workspace was removed because that directory does not exist. Database scripts run against `apps/api`.

## Key Commands

```bash
# Development (run multiple in separate terminals)
npm run dev:api        # Fastify API on :3001
npm run dev:worker     # BullMQ worker
npm run dev:frontend   # Next.js on :3000

# Docker (full stack)
docker compose up -d

# Database (run from apps/api directly, not from packages/db)
npm run db:generate --workspace=apps/api  # Drizzle: generate migrations
npm run db:migrate --workspace=apps/api  # Drizzle: apply migrations
npm run db:push     --workspace=apps/api  # Drizzle: push schema (dev)

# Build
npm run build:api      # compiles to apps/api/dist/
npm run build:worker   # compiles to worker/dist/
npm run build:frontend # Next.js build

# Lint / typecheck
npm run lint           # all workspaces
npm run typecheck      # all workspaces (no test command exists at root)
```

## Architecture Notes

- **API entrypoint**: `apps/api/src/app.ts` — Fastify with plugins (auth, db, redis, s3)
- **Worker entrypoint**: `worker/src/index.ts` — BullMQ worker; processes `transcode` and `generate-thumbnails` jobs
- **ORM**: Drizzle ORM, schema in `apps/api/src/db/schema.ts` (NOT init.sql — init.sql is raw SQL for reference only)
- **Queue**: BullMQ + Redis; `VIDEO_QUEUE_NAME` constant from `worker/src/types`
- **Storage**: SeaweedFS (S3-compatible); upload via the API (streaming), not presigned URLs (SeaweedFS presigned PUT is buggy).
- **Database**: PostgreSQL 16 via `docker-compose.yml`; `DATABASE_URL` env var required

## DB Schema Management

Drizzle config is in `apps/api/`. Schema lives in `apps/api/src/db/schema.ts`. Use commands above to generate and apply migrations. The `init.sql` file is not used by the application — it only documents the raw PostgreSQL schema.

## No Test Suite

There is no test framework configured. Do not run or look for `npm test`.

## Idioma

Todos los mensajes de commit, títulos y descripciones de PR, issues y comentarios de revisión deben ser en español.

## Environment Variables

Copy `.env.example` to `.env` before local dev. Key vars: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `JWT_SECRET`, `PORT`. API runs on port 3001 by default (or `PORT` env var).