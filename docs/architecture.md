# Архитектура «Памагочи»

## Обзор монорепозитория

```
apps/web       — React + Vite + Phaser (frontend)
apps/api       — NestJS + Fastify (backend)
packages/contracts   — общие Zod-схемы и типы DTO
packages/game-core   — чистая игровая логика (без React/Phaser/NestJS/Prisma/browser API)
packages/database    — Prisma schema, миграции, клиент, seed
packages/ui          — общие React-компоненты
infra/local          — docker-compose для PostgreSQL
infra/cloud          — Dockerfile для Render + инструкции Supabase/Cloudflare
scripts              — оркестрация профилей (Node.js, без shell-специфичных конструкций)
tests/e2e            — Playwright сценарии
```

## Профили запуска

Единственная точка входа — переменная `APP_PROFILE` (`local` | `cloud`), дополненная явными провайдерами `AUTH_PROVIDER`, `STORAGE_PROVIDER`, `JOB_PROVIDER`. Конфигурация валидируется через Zod при старте API (`apps/api/src/config/env.schema.ts`); недопустимые комбинации (например `APP_PROFILE=cloud` + `AUTH_PROVIDER=local`) останавливают запуск с понятной ошибкой.

## Разделение React и Phaser

- React отвечает за маршрутизацию, авторизацию, профиль пользователя, формы, состояние загрузки/ошибок, получение данных через `ApiClient`.
- Phaser (`apps/web/src/game`) отвечает только за canvas, сцены, игровые объекты, ввод, анимации, игровой цикл.
- Единственный канал связи — типизированный `GameBridge` (`apps/web/src/game/bridge/game-bridge.ts`), обменивающийся событиями `ReactToGameEvent` / `GameToReactEvent` из `packages/contracts`. React никогда не мутирует состояние Phaser Scene напрямую и наоборот.

## Игровая логика

`packages/game-core` содержит чистые функции: начисление очков (`scoring.ts`), опыт/уровни (`leveling.ts`), проверка ответов (`answers.ts`), ограничение координат (`coordinates.ts`), состояние квеста (`quest.ts`), награды (`rewards.ts`). Пакет не имеет зависимостей от React, Phaser, NestJS, Prisma или browser API — это гарантирует переиспользуемость и 100% юнит-тестируемость без моков фреймворков.

## Контракты

`packages/contracts` — единственный источник форматов запросов/ответов между frontend и backend, а также формата `SceneSpec` (безопасный JSON-контент для будущей LLM-генерации сцен, см. `packages/contracts/src/scene-spec.ts`). Все схемы — Zod.

## Доступ к базе данных

Только `apps/api` обращается к PostgreSQL, через `packages/database` (Prisma). Frontend никогда не читает и не изменяет игровые таблицы напрямую — Supabase SDK на frontend используется только для Supabase Auth (см. `apps/web/src/auth/supabase-auth-client.ts`).

## Auth

- `IdentityProvider` (`apps/api/src/auth/domain/identity-provider.ts`) — единый интерфейс верификации токена.
- `LocalIdentityProvider` — проверяет локальный dev-JWT (HS256, `DEV_AUTH_SECRET`).
- `SupabaseIdentityProvider` — проверяет Supabase JWT через JWKS (`jose`, с кэшированием и поддержкой ротации ключей).
- `ParentAccountService.upsertFromIdentity` идемпотентно создаёт/обновляет `ParentAccount` при каждом успешно авторизованном запросе.

## Storage

- `ObjectStorage` (`apps/api/src/storage/domain/object-storage.ts`) — единый интерфейс.
- `FilesystemObjectStorage` — локальная реализация с HMAC-подписанными URL, защитой от path traversal, allowlist MIME-типов, ограничением размера.
- `SupabaseS3ObjectStorage` — S3-совместимый клиент для приватного bucket `pamagochi-assets`, ключи доступа только на backend.

## Фоновые задачи

`JobDispatcher` (`apps/api/src/jobs/job-dispatcher.ts`) с единственной реализацией `InlineJobDispatcher` — синхронное выполнение зарегистрированного handler'а в текущем процессе. Redis/BullMQ/отдельный worker пока не используются намеренно.

## Безопасность LLM-контента

`packages/contracts/src/scene-spec.ts` определяет `SceneSpec` — единственный формат, в котором LLM-контент может повлиять на игру. Это данные, а не код: allowlist `assetKey`, ограничение размера (16 KiB) и количества объектов (40), строгая Zod-валидация. Сгенерированный LLM код никогда не исполняется.

## Голосовой агент (E0+)

Целевое разделение приложений зафиксировано в [ADR 0001](./adr/0001-livekit-and-application-boundaries.md):

- `apps/game` — Phaser детский клиент
- `apps/parent` — React кабинет родителя
- `apps/voice-agent` — LiveKit STT→LLM→TTS runtime
- `apps/api` — ownership, tokens, transcript, memory, tool validation

Дополнительно: [threat model](./threat-model-voice-session.md), [data-flow](./data-flow-voice-session.md),
[data model](./data-model-voice.md), [local voice docs](./voice-agent-local.md).

Новые packages: `game-protocol`, `agent-core`, `safety-contracts`. Контракты голоса —
в `packages/contracts/src/voice`.
