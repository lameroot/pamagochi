# Деплой

## Supabase

См. `infra/cloud/supabase.md`. Кратко: проект `pamagochi-dev`, европейский регион, отдельный database user для Prisma, email/password Auth, приватный bucket `pamagochi-assets` с server-only S3 credentials.

## Koyeb

См. `infra/cloud/koyeb.md`. API собирается из `infra/cloud/api.Dockerfile` с build context = корень монорепозитория. Health check path — `/api/health/ready`.

## Cloudflare Pages

См. `infra/cloud/cloudflare-pages.md`. Frontend собирается командой `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pamagochi/web... build`, output — `apps/web/dist`, root directory — корень репозитория (нужен доступ к workspace-пакетам).

## GitHub Actions

- `.github/workflows/ci.yml` — на каждый PR/push в `main`: checkout, Node.js из `.node-version`, Corepack, `pnpm install --frozen-lockfile`, PostgreSQL как service container, Prisma generate/migrate, format/lint/typecheck, unit-тесты, build, seed, integration-тесты, Playwright smoke. Не зависит от Supabase.
- `.github/workflows/cloud-smoke.yml` — только `workflow_dispatch`, использует GitHub Secrets (`CLOUD_API_URL`, `CLOUD_WEB_URL`, `CLOUD_TEST_EMAIL`, `CLOUD_TEST_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`), выполняет `pnpm verify:cloud` и Playwright-проверку Cloudflare-фронтенда.

## Обновление секретов

- Koyeb: Service → Environment Variables/Secrets — обновить значение, выполнить redeploy.
- Cloudflare Pages: Settings → Environment variables — обновить, выполнить redeploy.
- GitHub Actions (cloud-smoke): Settings → Secrets and variables → Actions — обновить значение секрета.
- Supabase: Dashboard → Settings → API / Database — ротация service-side ключей (S3 access key, database user password) выполняется там же; после ротации обновить соответствующие значения в Koyeb.

## Rollback

- **Koyeb**: у каждого деплоя сохраняется предыдущая ревизия — откат выполняется через Koyeb Dashboard → Deployments → Redeploy previous.
- **Cloudflare Pages**: каждый деплой — отдельная неизменяемая ревизия; откат — Cloudflare Dashboard → Deployments → Rollback to this deployment.
- **База данных**: Prisma-миграции пишутся аддитивно там, где возможно; для отката схемы — применить обратную миграцию (написанную вручную) через `pnpm db:migrate:cloud`. Supabase также хранит point-in-time backups (в зависимости от плана) для восстановления на конкретный момент времени.
- **Приложение (код)**: откат — `git revert` соответствующего коммита в `main`, что через Auto Deploy автоматически передеплоит предыдущую логику на Koyeb/Cloudflare.
