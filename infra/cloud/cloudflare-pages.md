# Cloudflare Pages — деплой `apps/web`

> **Статус:** проект реально создан и работает — `pamagochi-web`, https://pamagochi-web.pages.dev.
>
> ⚠️ Привязать Pages-проект к GitHub-репозиторию **только через API-токен невозможно** — Cloudflare требует одноразовой интерактивной OAuth-авторизации GitHub App в браузере (`Workers & Pages → Create application → Pages → Connect to Git`). Попытка создать git-connected проект через API без этой авторизации возвращает `8000011: internal issue with your Cloudflare Pages Git installation`. Обходной путь (даёт идентичный результат, кроме автотриггера на push): собрать `apps/web` локально/в CI с нужными `VITE_*` переменными и задеплоить через `wrangler pages deploy apps/web/dist --project-name=pamagochi-web`. Чтобы получить полноценный git-based автодеплой на push, кто-то с доступом к аккаунту должен один раз пройти OAuth-привязку в Dashboard.

## Настройки проекта

| Параметр          | Значение                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Project name      | `pamagochi-web`                                                                              |
| Production branch | `main`                                                                                       |
| Root directory    | `/`                                                                                          |
| Build command     | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pamagochi/web... build` |
| Output directory  | `apps/web/dist`                                                                              |

## Почему root directory — корень репозитория

`apps/web` зависит от `packages/contracts`, `packages/game-core` и `packages/ui` через workspace-протокол. Сборка должна видеть весь монорепозиторий, поэтому root directory не сужается до `apps/web`.

## Переменные окружения

```
VITE_APP_PROFILE=cloud
VITE_API_URL=<Render API URL>
VITE_SUPABASE_URL=<Supabase URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon key>
```

Никогда не добавлять:

```
VITE_SUPABASE_SERVICE_ROLE_KEY
VITE_DATABASE_URL
VITE_SUPABASE_S3_SECRET_KEY
VITE_DIRECT_DATABASE_URL
```

## Build watch paths

Включить пересборку только при изменении:

```
apps/web/**
packages/contracts/**
packages/game-core/**
packages/ui/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
```

## После получения Cloudflare URL

1. Добавить URL в `WEB_ORIGINS` в Render Environment.
2. Добавить URL в Supabase Auth redirect URLs.
3. Выполнить redeploy API.
4. Выполнить `pnpm verify:cloud`.
