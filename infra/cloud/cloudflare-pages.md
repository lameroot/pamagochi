# Cloudflare Pages — деплой `apps/web`

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
VITE_API_URL=<Koyeb API URL>
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

1. Добавить URL в `WEB_ORIGINS` Koyeb.
2. Добавить URL в Supabase Auth redirect URLs.
3. Выполнить redeploy API.
4. Выполнить `pnpm verify:cloud`.
