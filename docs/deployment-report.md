# Отчёт о развёртывании

> **Обновление:** cloud backend перенесён с Koyeb на Render (см. `cursor/render-backend-deploy-d23e`). Ниже отчёт обновлён с учётом этого изменения; фактические результаты локальных проверок (миграции, тесты, Docker-сборка) не изменились — менялся только целевой хостинг API.

## Метаданные

- Дата: 2026-07-28.
- Commit SHA: `788d87f4d4674bc49c58ef9e86f123bd7980a5da` (ветка `cursor/pamagochi-monorepo-skeleton-d23e`).
- Node.js: 24.18.0 (LTS Krypton). pnpm: 10.15.0. Полный список версий — `docs/versions.md`.
- Ветка: `cursor/pamagochi-monorepo-skeleton-d23e`.

## Cloud resources

**Не созданы.** У агента не было доступа к Supabase, Render или Cloudflare (ни MCP-интеграций к этим сервисам, ни API-токенов/креденшлов в окружении). Весь код, конфигурация и документация для cloud-профиля подготовлены и локально протестированы в максимально возможном объёме без реальных облачных аккаунтов:

- API успешно **собран в production Docker-образ** по `infra/cloud/api.Dockerfile` (build context — корень репозитория, multi-stage: base → dependencies → builder → runner) и **запущен локально в контейнере** с `APP_PROFILE=cloud`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase-s3` (с фиктивными Supabase-значениями, реальным PostgreSQL). Подтверждено:
  - `GET /api/health/live` → `200 {"status":"ok"}`
  - `GET /api/health/ready` → `200`, включая проверку PostgreSQL
  - `GET /api/meta/version` → `200`, `appProfile":"cloud"`, `authProvider":"supabase"`, без секретов в ответе
  - `POST /api/dev/login` → `404` (эндпоинт не зарегистрирован в cloud-сборке, как того требует ТЗ)
  - образ запускается от непривилегированного пользователя, слушает `PORT`/`API_PORT`, содержит HEALTHCHECK.
- Supabase project ref: не создан.
- Render Web Service: не развёрнуто (нет Render Deploy Hook / API key).
- Cloudflare Pages project: не развёрнуто (нет Cloudflare API token).

Реальное облачное развёртывание (этапы 4–7 ТЗ) требует, чтобы пользователь предоставил доступ — см. `docs/credentials.md` за перечнем нужных значений — после чего эти шаги можно выполнить.

## Результаты миграций

```
$ pnpm db:local:reset
$ pnpm setup:local
```

- Docker Compose поднимает `postgres:17.6-bookworm` (единственный сервис, healthcheck через `pg_isready`, именованный volume `pamagochi-local-postgres-data`).
- `prisma migrate deploy` применяет единственную миграцию `20260728204236_init` (создание `parent_accounts`, `child_profiles`, `skill_progress`, `quest_progress`, `stored_assets` + enum'ы) — успешно, идемпотентно при повторных запусках («No pending migrations to apply»).
- Seed (`prisma/seed.ts`) идемпотентен: повторные запуски возвращают тот же `parent.id`, `child.id`; создаёт 1 родителя, 1 демо-ребёнка, 3 skill records, 1 квест `first-steps`. Реальные персональные данные не используются.

## Результаты тестов и проверок (все выполнены реально, не в теории)

| Команда                                                                                             | Результат                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`                                                                                 | ✅ pass                                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm lint`                                                                                         | ✅ pass (0 errors; несколько допустимых warnings `no-console`/`no-explicit-any`)                                                                                                                                                                                                                                                                                                                       |
| `pnpm typecheck`                                                                                    | ✅ pass (все 7 workspace-пакетов)                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm test`                                                                                         | ✅ pass — 65 unit-тестов (game-core 22, contracts 6, api 29, web 6, ui 2)                                                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @pamagochi/api run test:integration`                                                 | ✅ pass — 6 интеграционных тестов на реальном PostgreSQL (readiness, dev-login, идемпотентный upsert ParentAccount, создание ребёнка, запрет чтения чужого ребёнка (404), upload-url → complete asset flow)                                                                                                                                                                                            |
| `pnpm build`                                                                                        | ✅ pass — все пакеты и оба приложения собираются                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm setup:local`                                                                                  | ✅ exit code 0                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm e2e:local` / Playwright (`local-smoke.spec.ts`)                                               | ✅ pass — local login, `LOCAL` badge, `API: online`, Phaser canvas виден, `scene-ready` получен React, создание детского профиля через форму, обновление страницы, профиль сохранился, отсутствие критических console errors                                                                                                                                                                           |
| `pnpm verify:local`                                                                                 | ✅ **exit code 0**, повторные прогоны стабильны, порты 3000/5173 освобождаются, PostgreSQL остаётся запущенным                                                                                                                                                                                                                                                                                         |
| `docker build -f infra/cloud/api.Dockerfile .`                                                      | ✅ успешно собирается                                                                                                                                                                                                                                                                                                                                                                                  |
| Запуск собранного образа локально (cloud-профиль, реальный Postgres, фиктивные Supabase-переменные) | ✅ `/api/health/live`, `/api/health/ready`, `/api/meta/version` отвечают корректно; `/api/dev/login` → 404                                                                                                                                                                                                                                                                                             |
| `pnpm verify:cloud`                                                                                 | ⛔ Не может быть выполнен — требует реальные `CLOUD_API_URL`, `CLOUD_WEB_URL`, `CLOUD_TEST_EMAIL`, `CLOUD_TEST_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, которых нет. Скрипт корректно завершается с понятной ошибкой о недостающих переменных (эта часть проверена: `node scripts/verify-cloud.mjs` без переменных выводит точный список отсутствующих значений и завершается ненулевым кодом). |
| GitHub Actions `ci.yml` (реальный прогон на PR #1)                                                  | ✅ **success** — checkout, Node 24, Corepack, `pnpm install --frozen-lockfile`, PostgreSQL service container, Prisma generate/migrate/seed, format/lint/typecheck, unit tests, build, API integration tests, Playwright smoke — все шаги зелёные                                                                                                                                                       |

## Найденные и исправленные в процессе баги

Полный список нетривиальных проблем, обнаруженных только благодаря реальному запуску (а не просто написанию кода), и их исправлений:

1. **NestJS DI ломался под `tsx`**: ESLint-автофикс `consistent-type-imports` конвертировал часть runtime-импортов классов (`AppConfigService`, `PrismaService` и др.) в `import type`, из-за чего TypeScript переставал эмитить `design:paramtypes` для конструкторов — Nest получал `undefined` вместо зависимостей. Правило отключено проектно (см. `eslint.config.js`), импорты исправлены вручную.
2. **`tsx watch` в принципе не подходит для dev-сервера NestJS**: esbuild (на котором работает `tsx`) не поддерживает надёжную эмиссию decorator metadata (нужна для DI), т.к. транспилирует файлы по одному без полной проверки типов. Заменено на `tsc --watch` + `node --watch dist/main.js` (`apps/api/scripts/dev.mjs`).
3. **Workspace-пакеты, экспортирующие `.ts` напрямую**, ломали production-запуск (`node dist/main.js`) — Node не может исполнять `.ts`. Пакеты `contracts`/`game-core`/`database`/`ui` переключены на экспорт собранного `dist/*`; добавлен единый шаг предварительной сборки (`scripts/lib/build-shared-packages.mjs`), вызываемый из `setup-local.mjs`, `verify-local.mjs`, `run-profile.mjs`.
4. **Утечка `*.tsbuildinfo` в Docker build context** заставляла `tsc` внутри контейнера думать, что сборка уже актуальна, и не эмитить файлы вовсе (0 ошибок, но и 0 файлов). Добавлено в `.dockerignore`.
5. **Неверный синтаксис `pnpm --filter` в Dockerfile** (`@pamagochi/api...` вместо явного перечисления пакетов) приводил к тому, что зависимости `contracts`/`game-core`/`database` не устанавливались вовсе. Исправлено на явные множественные `--filter`.
6. **`pnpm deploy --legacy`** создавал новый virtual store и линковал НЕ тот экземпляр `@prisma/client` (без сгенерированной по нашей schema модели) — заменено на `pnpm prune --prod` внутри уже собранного дерева `node_modules`.
7. **Некорректная остановка dev-процессов** (`node --watch` + `tsc --watch`, запущенные через несколько уровней `pnpm run`) — сигналы не всегда доходили до самых глубоких потомков, порты 3000/5173 иногда оставались занятыми. Добавлена защитная очистка портов через `lsof` (`scripts/lib/process-utils.mjs: killProcessesOnPort`) как гарантия поверх обычной сигнальной остановки.

## Известные ограничения

- Cloud-развёртывание (Supabase / Render / Cloudflare Pages) не выполнено — нет доступа к внешним аккаунтам/токенам. Код и документация полностью готовы к развёртыванию, как только пользователь предоставит доступ (см. `docs/credentials.md`).
- `pnpm verify:cloud` и manual workflow `cloud-smoke.yml` не запускались end-to-end по той же причине.
- Docker-образ API — 729 МБ (не оптимизирован дальше `pnpm prune --prod`; можно уменьшить, убрав неиспользуемые нативные бинарники esbuild/rolldown, доставшиеся от `apps/web`/дev-инструментов, отдельной задачей).
- `cloud-smoke.yml` не запускался (`workflow_dispatch`, требует cloud credentials в GitHub Secrets, которых нет).
- Docker и Docker Compose не были доступны из коробки в этой изолированной среде — установлены вручную (docker.io, docker-compose-v2) и запущены с `--storage-driver=vfs` из-за ограничений overlayfs в песочнице; на реальном CI-раннере (GitHub Actions, Render) эти ограничения отсутствуют.
- Container-to-container сеть Docker (bridge) не работала в этой конкретной песочнице (nftables недоступен) — smoke-тест собранного образа выполнялся через `--network host`; это ограничение среды выполнения агента, не приложения.

## Credentials, рекомендованные к ротации

Cloud-ресурсы не создавались, поэтому ротация пока не требуется. Общий список credentials и их назначение — `docs/credentials.md`. После первого реального облачного развёртывания рекомендуется:

- при первичной настройке Supabase Storage S3-ключей — если значения когда-либо были показаны в терминале/логах при копировании вручную, ротировать `SUPABASE_S3_ACCESS_KEY`/`SUPABASE_S3_SECRET_KEY` сразу после проверки;
- использовать выделенный, а не личный, Render Deploy Hook/Cloudflare API token с минимальными правами, и отозвать его по завершании первоначальной настройки, заменив на токен, привязанный к CI/CD интеграции.
