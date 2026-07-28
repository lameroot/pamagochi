# Koyeb — деплой `apps/api`

## Настройки сервиса

| Параметр          | Значение                                                                        |
| ----------------- | ------------------------------------------------------------------------------- |
| App               | `pamagochi`                                                                     |
| Service           | `pamagochi-api`                                                                 |
| Region            | Frankfurt (или ближайший доступный европейский), согласован с регионом Supabase |
| Builder           | Dockerfile                                                                      |
| Dockerfile path   | `infra/cloud/api.Dockerfile`                                                    |
| Build context     | корень монорепозитория (`/`)                                                    |
| Port              | значение переменной `PORT` (Koyeb сам её прокидывает)                           |
| Health check path | `/api/health/ready`                                                             |
| Branch            | `main`                                                                          |
| Auto deploy       | enabled                                                                         |

## Почему build context — корень репозитория

`apps/api` зависит от `packages/contracts`, `packages/database` и `packages/game-core` через pnpm workspace-протокол (`workspace:*`). Если Koyeb соберёт образ только из `apps/api`, эти пакеты будут недоступны и `pnpm install` завершится ошибкой. Поэтому:

- build context = корень репозитория;
- Dockerfile НЕ устанавливает `WORKDIR` в `apps/api` до момента копирования всех нужных workspace-пакетов (см. `infra/cloud/api.Dockerfile`).

## Переменные окружения (Koyeb Secrets / Environment Variables)

Добавляются только через Koyeb Secrets/Environment Variables — никогда не через открытые GitHub repository variables:

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

## Проверка после деплоя

```bash
curl https://<koyeb-app>.koyeb.app/api/health/live
curl https://<koyeb-app>.koyeb.app/api/health/ready
curl https://<koyeb-app>.koyeb.app/api/meta/version
```

Все три должны вернуть `200 OK` и не содержать секретов в теле ответа.

## Обновление после получения Cloudflare Pages URL

1. Добавить Cloudflare URL в `WEB_ORIGINS`.
2. Добавить Cloudflare URL в Supabase Auth redirect URLs.
3. Выполнить redeploy API в Koyeb.
