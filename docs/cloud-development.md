# Разработка с облачной инфраструктурой

## Как получить Supabase credentials

См. `infra/cloud/supabase.md` для полного порядка действий (создание проекта, database user для Prisma, Auth, Storage bucket). Ниже — сводка, что публично, а что нет.

### Публичные значения (можно передавать на frontend)

- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` (anon key рассчитан на публичное использование при включённом Row Level Security на стороне Supabase, но в этом проекте frontend вообще не обращается к Data API напрямую — только к Supabase Auth)
- `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUDIENCE` (используются backend'ом, не секретны)

### Только серверные значения (никогда не на frontend)

- `SUPABASE_SERVICE_ROLE_KEY` (в этом проекте не используется вовсе — JWT верифицируется через JWKS)
- `DATABASE_URL`, `DIRECT_DATABASE_URL`
- `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`

## Как применять миграции

```bash
cp .env.cloud.example .env.cloud.local
# заполнить DATABASE_URL / DIRECT_DATABASE_URL реальными значениями Supabase
pnpm db:migrate:cloud
```

Миграции идентичны локальным (`packages/database/prisma/migrations`) — Prisma всегда управляет только схемой `public`.

## Как запускать frontend и API локально против облака

```bash
cp .env.cloud.example .env.cloud.local
# заполнить реальные значения Supabase
pnpm dev:cloud
```

Docker для этого профиля не требуется — `apps/web` и `apps/api` работают на хосте и обращаются к облачному Supabase Postgres/Auth/Storage.

## Как выполнить smoke test

```bash
CLOUD_API_URL=... CLOUD_WEB_URL=... CLOUD_TEST_EMAIL=... CLOUD_TEST_PASSWORD=... \
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
pnpm verify:cloud
```

Либо запустить workflow `.github/workflows/cloud-smoke.yml` вручную (`workflow_dispatch`) — переменные берутся из GitHub Secrets.
