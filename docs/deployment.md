# Деплой

## Supabase

См. `infra/cloud/supabase.md`. Кратко: проект `pamagochi-dev`, европейский регион, отдельный database user для Prisma, email/password Auth, приватный bucket `pamagochi-assets` с server-only S3 credentials.

## Render

См. `infra/cloud/render.md`. API собирается из `infra/cloud/api.Dockerfile` (Render Web Service, runtime Docker) с build context = корень монорепозитория. Health check path — `/api/health/ready`. Auto-Deploy на прямой push выключен — деплой запускается Deploy Hook'ом из GitHub Actions только после успешного прохождения `ci.yml` (см. ниже).

## Cloudflare Pages

См. `infra/cloud/cloudflare-pages.md`. Frontend собирается командой `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pamagochi/web... build`, output — `apps/web/dist`, root directory — корень репозитория (нужен доступ к workspace-пакетам).

## GitHub Actions

- `.github/workflows/ci.yml` — на каждый PR/push в `main`: checkout, Node.js из `.node-version`, Corepack, `pnpm install --frozen-lockfile`, PostgreSQL как service container, Prisma generate/migrate, format/lint/typecheck, unit-тесты, build, seed, integration-тесты, Playwright smoke. Не зависит от Supabase. Дополнительный job `deploy-render` выполняется только при push в `main` и только после успешного завершения `ci` — вызывает Render Deploy Hook (`RENDER_DEPLOY_HOOK_URL`), тем самым гарантируя, что в Render разворачивается только код, прошедший весь quality gate.
- `.github/workflows/cloud-smoke.yml` — только `workflow_dispatch`, использует GitHub Secrets (`CLOUD_API_URL`, `CLOUD_WEB_URL`, `CLOUD_TEST_EMAIL`, `CLOUD_TEST_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`), выполняет `pnpm verify:cloud` и Playwright-проверку Cloudflare-фронтенда.

## Обновление секретов

- Render: Service → Environment — обновить значение, выполнить Manual Deploy (или дождаться следующего успешного CI на `main`, который дёрнет Deploy Hook автоматически).
- Cloudflare Pages: Settings → Environment variables — обновить, выполнить redeploy.
- GitHub Actions (cloud-smoke, deploy-render): Settings → Secrets and variables → Actions — обновить значение секрета.
- Supabase: Dashboard → Settings → API / Database — ротация service-side ключей (S3 access key, database user password) выполняется там же; после ротации обновить соответствующие значения в Render.

## Rollback

- **Render**: у каждого успешного деплоя сохраняется предыдущий рабочий образ — откат выполняется через Render Dashboard → Deploys → выбрать предыдущий успешный деплой → Rollback to this deploy.
- **Cloudflare Pages**: каждый деплой — отдельная неизменяемая ревизия; откат — Cloudflare Dashboard → Deployments → Rollback to this deployment.
- **База данных**: Prisma-миграции пишутся аддитивно там, где возможно; для отката схемы — применить обратную миграцию (написанную вручную) через `pnpm db:migrate:cloud`. Supabase также хранит point-in-time backups (в зависимости от плана) для восстановления на конкретный момент времени.
- **Приложение (код)**: откат — `git revert` соответствующего коммита в `main`; после того как CI на новом коммите станет зелёным, `deploy-render` job автоматически передеплоит предыдущую логику в Render (Cloudflare Pages передеплоится своим штатным auto-deploy).
