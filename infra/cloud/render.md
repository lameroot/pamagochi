# Render — деплой `apps/api`

`apps/api` развёртывается в Render как **Web Service** с рантаймом **Docker**, собираемым из существующего `infra/cloud/api.Dockerfile`. Никакой отдельный Docker-контур для Render не создаётся — используется тот же Dockerfile, что и раньше.

## Настройки сервиса

| Параметр                       | Значение                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Name                           | `pamagochi-api`                                                                                                                  |
| Runtime                        | Docker                                                                                                                           |
| Repository                     | этот GitHub-репозиторий                                                                                                          |
| Branch                         | `main`                                                                                                                           |
| Root Directory                 | _(не задан)_ — корень монорепозитория                                                                                            |
| Dockerfile Path                | `infra/cloud/api.Dockerfile`                                                                                                     |
| Docker Build Context Directory | `.` (корень монорепозитория)                                                                                                     |
| Region                         | Frankfurt (или ближайший доступный европейский), согласован с регионом Supabase                                                  |
| Instance Type                  | Starter (минимальный достаточный план)                                                                                           |
| Health Check Path              | `/api/health/ready`                                                                                                              |
| Auto-Deploy                    | **выключен** для прямого push — деплой запускается через Deploy Hook после того, как GitHub Actions CI прошёл успешно (см. ниже) |

## Почему build context — корень репозитория

`apps/api` зависит от `packages/contracts`, `packages/database` и `packages/game-core` через pnpm workspace-протокол (`workspace:*`). Если Render соберёт образ только из `apps/api`, эти пакеты будут недоступны и `pnpm install` завершится ошибкой. Поэтому:

- Docker Build Context Directory = корень репозитория (`.`);
- Dockerfile Path = `infra/cloud/api.Dockerfile` (путь указывается relative к корню репозитория, а не к build context);
- Dockerfile НЕ устанавливает `WORKDIR` в `apps/api` до момента копирования всех нужных workspace-пакетов (см. `infra/cloud/api.Dockerfile`) — это не менялось при переходе с Koyeb на Render.

## Порт и health check

Render передаёт порт через переменную окружения `PORT` (аналогично Koyeb) — API уже слушает `process.env.PORT ?? process.env.API_PORT ?? 3000`, изменений в коде не требуется. Health Check Path — `/api/health/ready`; Render не переключает трафик на новый инстанс, пока health check не станет успешным (2xx), и автоматически откатывает неудачный деплой, оставляя предыдущую рабочую версию в проде.

## Переменные окружения (Render → Environment)

Добавляются только через Render Dashboard → Service → Environment (Environment Variables/Secret Files) — никогда не через открытые GitHub repository variables:

```
APP_PROFILE=cloud
NODE_ENV=production
AUTH_PROVIDER=supabase
STORAGE_PROVIDER=supabase-s3
JOB_PROVIDER=inline
WEB_ORIGINS=https://pamagochi-web.pages.dev
SUPABASE_URL=...
SUPABASE_PROJECT_REF=...
SUPABASE_JWT_ISSUER=...
SUPABASE_JWKS_URL=...
SUPABASE_JWT_AUDIENCE=authenticated
DATABASE_URL=...
DIRECT_DATABASE_URL=...
SUPABASE_STORAGE_BUCKET=pamagochi-assets
SUPABASE_S3_ENDPOINT=...
SUPABASE_S3_REGION=...
SUPABASE_S3_ACCESS_KEY=...
SUPABASE_S3_SECRET_KEY=...
```

## Автодеплой только после успешного GitHub CI

Render поддерживает автодеплой на каждый push, но это не гарантирует, что задеплоенный код прошёл `.github/workflows/ci.yml`. Чтобы деплой запускался **только после зелёного CI**, используется штатный механизм Render — [Deploy Hook](https://render.com/docs/deploy-hooks):

1. В Render Dashboard → Service `pamagochi-api` → Settings → Deploy Hook — скопировать одноразовый секретный URL (`https://api.render.com/deploy/srv-...?key=...`).
2. Сохранить его в GitHub Secrets репозитория под именем `RENDER_DEPLOY_HOOK_URL` (Settings → Secrets and variables → Actions).
3. В самом Render-сервисе выключить _Auto-Deploy_ (Settings → Build & Deploy → Auto-Deploy → No), чтобы push в `main` сам по себе не триггерил деплой.
4. Деплой запускается новым job'ом `deploy-render` в `.github/workflows/ci.yml`, который выполняется только при push в `main` и только после успешного завершения существующего job'а `ci` (`needs: ci`) — существующие шаги проверки (`format`, `lint`, `typecheck`, `test`, `build`, integration-тесты, Playwright) не изменены и не пропускаются.

Таким образом каждая новая версия в Render — это ровно тот коммит, который уже прошёл весь quality gate.

## Проверка после деплоя

```bash
curl https://<render-service>.onrender.com/api/health/live
curl https://<render-service>.onrender.com/api/health/ready
curl https://<render-service>.onrender.com/api/meta/version
```

Все три должны вернуть `200 OK` и не содержать секретов в теле ответа.

## Обновление после получения Cloudflare Pages URL

1. Добавить Cloudflare URL в `WEB_ORIGINS` (Render Environment).
2. Добавить Cloudflare URL в Supabase Auth redirect URLs.
3. Выполнить redeploy API в Render (Manual Deploy → Deploy latest commit, либо повторно дёрнуть Deploy Hook).

## Rollback

У каждого успешного деплоя в Render сохраняется предыдущий рабочий образ. Откат — Render Dashboard → Service → Deploys → выбрать предыдущий успешный деплой → _Rollback to this deploy_. Откат не требует пересборки образа и происходит за секунды.
