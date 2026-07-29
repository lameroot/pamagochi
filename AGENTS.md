# AGENTS.md — инструкции для AI-агентов и разработчиков

Этот документ описывает правила работы в монорепозитории «Памагочи» для любых автоматизированных агентов (Cursor Cloud Agents, CI-боты) и людей.

## Быстрый старт (агент должен уметь это с первого запуска)

```bash
cp .env.local.example .env.local
pnpm install
pnpm setup:local
pnpm dev:local
```

Всё, что нужно агенту для локальной разработки — это Node.js 24, pnpm и Docker (только для PostgreSQL). Supabase/Render/Cloudflare **не требуются** для профиля `local`.

## Профили

- `APP_PROFILE=local` — автономная работа, без сети. Auth/Storage — локальные реализации.
- `APP_PROFILE=cloud` — Supabase Auth/Storage/Postgres, деплой в Render/Cloudflare Pages.

Никогда не смешивать провайдеры между профилями (см. `apps/api/src/config`).

## Структура

- `apps/web` — React + Vite + Phaser (frontend).
- `apps/api` — NestJS + Fastify (backend).
- `packages/contracts` — общие Zod-схемы и типы DTO.
- `packages/game-core` — чистая игровая логика без React/Phaser/NestJS/Prisma зависимостей.
- `packages/database` — Prisma schema, миграции, клиент, seed.
- `packages/ui` — общие React-компоненты.
- `infra/local` — docker-compose для PostgreSQL.
- `infra/cloud` — Dockerfile для Render и инструкции по Supabase/Cloudflare.
- `scripts` — Node.js-скрипты оркестрации (без shell-специфичных конструкций).

## Правила для агентов

1. Не исполнять код, сгенерированный LLM в игровом контенте (`packages/contracts` содержит Zod-схему `SceneSpec` — валидировать всегда).
2. Не коммитить `.env`, `.env.local`, `.env.cloud.local` — только `*.example`.
3. Не логировать секреты. Скрипты в `scripts/*.mjs` обязаны маскировать значения.
4. Все команды проверки должны быть идемпотентны: `pnpm setup:local`, `pnpm verify:local`, seed.
5. Перед тем как считать задачу выполненной — прогнать `pnpm check`.
6. Правки схемы Prisma — всегда через миграции (`pnpm db:migrate:local` / `pnpm db:migrate:cloud`), никогда не редактировать БД вручную.
7. React не должен напрямую менять состояние внутри Phaser Scene и наоборот — только через `apps/web/src/game/bridge`.
8. `packages/game-core` не должен импортировать React, Phaser, NestJS, Prisma или browser API (`window`, `document`).

## Полезные команды

```bash
pnpm dev:local        # web + api локально, Postgres в Docker
pnpm dev:cloud        # web + api локально против Supabase (без Docker)
pnpm verify:local     # полная автоматическая проверка local-профиля
pnpm verify:cloud     # проверка развёрнутого cloud-профиля
pnpm check            # format + lint + typecheck + test + build
```
