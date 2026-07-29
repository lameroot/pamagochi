# Локальная разработка

## Что запускается в Docker

Только PostgreSQL (`infra/local/compose.yaml`, сервис `postgres`, образ `postgres:17.6-bookworm`). Frontend, API, Phaser, файловое хранилище и test runner всегда работают на хостовой машине через `pnpm`.

## Быстрый старт

```bash
cp .env.local.example .env.local
pnpm install
pnpm setup:local
pnpm dev:local
```

`pnpm setup:local` проверяет Node.js/pnpm/Docker, поднимает PostgreSQL, дожидается healthcheck, выполняет `prisma generate`, применяет миграции, выполняет идемпотентный seed, создаёт `.data/storage` и печатает безопасную сводку (без секретов).

`pnpm dev:local` запускает `apps/api` и `apps/web` параллельно на хосте (см. `scripts/run-profile.mjs`).

Каркас голосового среза: см. [voice-agent-local.md](./voice-agent-local.md) (`apps/game`, `apps/parent`, `apps/voice-agent`).

## Как остановить

```bash
pnpm db:local:down
```

Останавливает только контейнер PostgreSQL (data volume сохраняется).

## Как сбросить БД

```bash
pnpm db:local:reset
pnpm setup:local
```

`db:local:reset` удаляет docker volume с данными PostgreSQL. После этого `setup:local` пересоздаёт всё с нуля (миграции + seed).

## Где находятся локальные файлы

- Загруженные ассеты: `.data/storage` (путь настраивается через `LOCAL_STORAGE_PATH`). Каталог `.data` не коммитится в Git.
- Docker volume PostgreSQL: `pamagochi-local-postgres-data` (именованный том, переживает `docker compose down`, удаляется только через `db:local:reset`).

## Как работает dev auth

- Endpoint `POST /api/dev/login` доступен **только** когда одновременно `APP_PROFILE=local`, `AUTH_PROVIDER=local` и `DEV_AUTH_ENABLED=true`.
- В cloud-профиле контроллер вообще не регистрируется (не просто закрыт — его нет в маршрутах и в Swagger).
- Он возвращает короткоживущий (15 минут) HS256 JWT для фиксированного `DEV_USER_ID` — клиент не может передать произвольный `userId`.
- Frontend (`apps/web/src/auth/local-auth-client.ts`) автоматически получает и кэширует токен в `sessionStorage`, привязанном к текущему origin, и обновляет его по истечении.

## Как запускать тесты

```bash
pnpm test                                    # все unit-тесты (turbo)
pnpm --filter @pamagochi/api run test:integration   # integration-тесты API (нужен реальный PostgreSQL)
pnpm e2e:local                               # Playwright сценарий поверх поднятого local-стенда
pnpm verify:local                            # полная автоматическая проверка local-профиля
```
