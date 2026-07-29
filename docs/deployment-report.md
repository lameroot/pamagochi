# Отчёт о развёртывании

## Метаданные

- Дата: 2026-07-29.
- Commit SHA приложения: `32fa88cb65367a98b89a093f1882033a4268d342` (ветка `cursor/render-backend-deploy-d23e`) — именно этот коммит сейчас развёрнут в Render.
- Node.js: 24.18.0 (LTS Krypton). pnpm: 10.15.0. Полный список версий — `docs/versions.md`.

## Cloud resources — созданы и работают

| Ресурс             | Значение                                                                                         | Статус                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Supabase project   | `pamagochi-dev`, ref `hvtvjlpzvetiejrgioek`, регион eu-west-2 (Лондон)                           | ✅ ACTIVE_HEALTHY                                 |
| Supabase Auth      | email/password включён, redirect URL настроен на Cloudflare Pages                                | ✅ проверено реальным входом                      |
| Supabase Storage   | приватный bucket `pamagochi-assets` (`public: false`)                                            | ✅ put/get/delete проверены напрямую через S3 API |
| Render Web Service | `pamagochi-api`, https://pamagochi-api.onrender.com, регион Frankfurt, план free, runtime Docker | ✅ live                                           |
| Cloudflare Pages   | `pamagochi-web`, https://pamagochi-web.pages.dev                                                 | ✅ live (direct upload)                           |

Всё перечисленное выше — **реально созданные ресурсы**, а не гипотетическая инструкция. Ниже — как именно и с какими оговорками.

### Как это было сделано технически

- Supabase: через Management API (`SUPABASE_ACCESS_TOKEN`) — сброшен пароль БД, применены Prisma-миграции к реальной Supabase PostgreSQL (pooled/session Supavisor connection strings, оба протестированы), создан тестовый пользователь `cloud-smoke-test@pamagochi.dev`, обновлены Auth redirect URLs. Bucket и S3-ключи Storage Supabase не даёт создавать через публичный Management API — bucket уже существовал, S3-ключи создал пользователь вручную через Dashboard (это ограничение платформы, не автоматизируется в принципе).
- Render: через Render API (`RENDER_API_KEY`) создан Web Service с runtime Docker (`infra/cloud/api.Dockerfile`, build context — корень репозитория), прописаны 19 environment variables, health check `/api/health/ready`, план free. **Важный нюанс API**: `envVars`, переданные в теле `POST /v1/services`, Render тихо игнорирует — переменные пришлось дополнительно проставить через `PUT /v1/services/{id}/env-vars` и передеплоить. Auto-Deploy выключен (`autoDeploy: no`) — по дизайну, деплой должен идти только через `deploy-render` job в CI после зелёного `ci` (см. `docs/deployment.md`).
- Cloudflare Pages: через Cloudflare API (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) создан проект. **Ограничение платформы**: привязка Pages-проекта к GitHub-репозиторию для непрерывного автодеплоя требует одноразовой OAuth-авторизации в браузере (`Workers & Pages → Create → Pages → Connect to Git`) — через API токен это невозможно в принципе (Cloudflare возвращает `8000011: internal issue with your Cloudflare Pages Git installation`, если GitHub App не установлен интерактивно). Поэтому frontend собран (`pnpm --filter @pamagochi/web build` с реальными `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_API_URL`) и задеплоен через `wrangler pages deploy` (direct upload). Работает полностью идентично git-based деплою за исключением автотриггера на push — это единственный оставшийся ручной шаг для пользователя.

## Результаты миграций

Применены дважды — к чистой локальной базе и к реальной Supabase PostgreSQL:

```
$ pnpm db:local:reset && pnpm setup:local        # локально
$ prisma migrate deploy (DATABASE_URL=Supabase)  # облако
```

- `prisma migrate deploy` применяет единственную миграцию `20260728204236_init` (создание `parent_accounts`, `child_profiles`, `skill_progress`, `quest_progress`, `stored_assets` + enum'ы) — успешно в обоих окружениях, идемпотентно при повторных запусках.
- Seed (`prisma/seed.ts`) идемпотентен: повторные запуски возвращают тот же `parent.id`/`child.id`. Реальные персональные данные не используются.

## Результаты тестов и проверок (все выполнены реально)

| Команда                                                                                                 | Результат                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm build`                                     | ✅ pass                                                                                                                                                                                                                                                                                       |
| `pnpm test`                                                                                             | ✅ 65 unit-тестов                                                                                                                                                                                                                                                                             |
| `pnpm --filter @pamagochi/api run test:integration`                                                     | ✅ 6/6 на реальном PostgreSQL                                                                                                                                                                                                                                                                 |
| `pnpm setup:local` / `pnpm verify:local`                                                                | ✅ exit code 0, стабильно при повторных прогонах                                                                                                                                                                                                                                              |
| GitHub Actions `ci.yml` (PR #1, #2)                                                                     | ✅ success — все шаги quality gate зелёные                                                                                                                                                                                                                                                    |
| `docker build -f infra/cloud/api.Dockerfile .`                                                          | ✅ собирается                                                                                                                                                                                                                                                                                 |
| **`pnpm verify:cloud` (против реального Render + Supabase + Cloudflare)**                               | ✅ **exit code 0** — live/ready health, версия, Supabase Auth sign-in, `/api/me`, создание ребёнка, signed upload URL, реальная загрузка файла, complete, signed read URL, чтение файла, доступность Cloudflare frontend, CORS (не wildcard) — всё прошло, временный asset удалён в `finally` |
| Playwright `cloud-smoke.spec.ts` (`--grep @cloud`, против реального `pamagochi-web.pages.dev`)          | ✅ pass — `CLOUD` badge, Phaser canvas виден, критических console errors нет                                                                                                                                                                                                                  |
| `curl https://pamagochi-api.onrender.com/api/health/live\|ready`, `/api/meta/version`, `/api/dev/login` | ✅ `200`/`200`/`200`(cloud+supabase)/**`404`** соответственно                                                                                                                                                                                                                                 |

## Найденные и исправленные в процессе баги

1. **NestJS DI ломался под `tsx`** из-за автофикса `@typescript-eslint/consistent-type-imports`, стиравшего runtime-импорты классов, нужные для `emitDecoratorMetadata`. Правило отключено проектно.
2. **`tsx watch` не годится для dev-сервера NestJS** (esbuild не эмитит decorator metadata надёжно) — заменено на `tsc --watch` + `node --watch dist/main.js`.
3. **Workspace-пакеты, экспортировавшие `.ts` напрямую**, ломали `node dist/main.js` в проде — переключены на экспорт `dist/*` со сборкой шагом `scripts/lib/build-shared-packages.mjs`.
4. **Утечка `*.tsbuildinfo` в Docker build context** — `tsc` внутри контейнера считал сборку актуальной и не эмитил файлы. Добавлено в `.dockerignore`.
5. **Неверный синтаксис `pnpm --filter` в Dockerfile** — зависимости `contracts`/`game-core`/`database` не устанавливались. Исправлено на явные множественные `--filter`.
6. **`pnpm deploy --legacy`** линковал не тот экземпляр `@prisma/client` — заменено на `pnpm prune --prod`.
7. **Сигналы не доходили до глубоко вложенных dev-процессов** — добавлена защитная очистка портов через `lsof`.
8. **Render API тихо игнорирует `envVars` внутри `POST /v1/services`** — переменные окружения не применились к первому деплою (`update_failed`, `APP_PROFILE`/`DATABASE_URL`/... undefined). Исправлено: env vars ставятся отдельным `PUT /v1/services/{id}/env-vars` **до** первого реального деплоя.
9. **Cloudflare Pages нельзя подключить к GitHub только через API-токен** — платформа требует интерактивной OAuth-авторизации GitHub App. Обойдено через `wrangler pages deploy` (direct upload) с идентичным результатом, кроме автотриггера на push.
10. **Render требует привязанную карту оплаты даже для free-плана** прежде чем разрешает создать любой сервис через API (`402 Payment information is required`) — блокер, снятый пользователем вручную.
11. **Supabase Management API не имеет эндпоинта для создания S3 Access Keys Storage** — единственный доступный путь — Dashboard UI; ключ создан пользователем вручную и передан агенту.

## Известные ограничения

- **Автодеплой Cloudflare Pages при push в GitHub не настроен** — требует одноразовой ручной OAuth-авторизации в Cloudflare Dashboard (см. выше). Сейчас обновление сайта = ручной `pnpm --filter @pamagochi/web build && wrangler pages deploy dist --project-name=pamagochi-web`, либо настройка автосвязки пользователем.
- ~~`RENDER_DEPLOY_HOOK_URL` не добавлен в GitHub Secrets~~ — **добавлен пользователем и проверен end-to-end**: `deploy-render` job временно запускался на push в feature-ветку (не в `main`), успешно вызвал Render Deploy Hook (`curl` вернул `{"deploy":{"id":"dep-d9ku340u01pc73ehqieg"}}` — реальный новый деплой в Render), после чего временное разрешение отменено и job снова ограничен только push в `main`, как и задумано.
- Render-сервис сейчас указывает на branch `cursor/render-backend-deploy-d23e` — после мерджа PR #1 и #2 в `main` нужно переключить branch сервиса на `main` (Render Dashboard → Settings → Build & Deploy → Branch), иначе `deploy-render` CI job будет деплоить неактуальную ветку.
- Docker-образ API — 729 МБ (не оптимизирован дальше `pnpm prune --prod`).
- `cloud-smoke.yml` (manual GitHub Actions workflow) не запускался — GitHub Secrets для него ещё не добавлены (см. следующий раздел).
- Тестовый детский профиль, созданный во время `verify:cloud`, оставлен в Supabase (в API намеренно нет `DELETE /api/children/:id` — не входит в текущий скоуп ТЗ); это синтетические данные без персональной информации.

## Что ещё нужно добавить в GitHub Secrets вручную (для `cloud-smoke.yml`)

`RENDER_DEPLOY_HOOK_URL` уже добавлен и проверен (см. выше). Остальные секреты нужны только для manual workflow `cloud-smoke.yml`:

| Секрет                | Значение                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `CLOUD_API_URL`       | `https://pamagochi-api.onrender.com`                                                                                        |
| `CLOUD_WEB_URL`       | `https://pamagochi-web.pages.dev`                                                                                           |
| `CLOUD_TEST_EMAIL`    | `cloud-smoke-test@pamagochi.dev`                                                                                            |
| `CLOUD_TEST_PASSWORD` | сгенерирован агентом, передан пользователю отдельно в чате (не хранится в репозитории)                                      |
| `SUPABASE_URL`        | `https://hvtvjlpzvetiejrgioek.supabase.co`                                                                                  |
| `SUPABASE_ANON_KEY`   | публичный anon-ключ проекта `pamagochi-dev` (Dashboard → Settings → API Keys), безопасен для публикации по дизайну Supabase |

## Credentials, рекомендованные к ротации

Четыре токена (`SUPABASE_ACCESS_TOKEN`, `RENDER_API_KEY`, `CLOUDFLARE_API_TOKEN`, S3 access key/secret) были переданы агенту текстом в чате, а не через защищённый secrets-механизм (из-за проблем с подхватом Cloud Agent Secrets в этой сессии). Рекомендуется:

- ротировать/перевыпустить `SUPABASE_ACCESS_TOKEN` (Dashboard → Account → Access Tokens → Revoke → создать новый);
- ротировать `RENDER_API_KEY` (Account Settings → API Keys → Revoke → создать новый);
- ротировать `CLOUDFLARE_API_TOKEN` (My Profile → API Tokens → Roll/Delete → создать новый с теми же правами Pages:Edit);
- при желании перевыпустить `SUPABASE_S3_ACCESS_KEY`/`SUPABASE_S3_SECRET_KEY` (Dashboard → Project Settings → Storage → S3 Access Keys) и обновить значение в Render Environment;
- сменить пароль тестового Supabase-пользователя `cloud-smoke-test@pamagochi.dev`, если `CLOUD_TEST_PASSWORD` не будет храниться исключительно в GitHub Secrets.

Ни один из этих секретов не попал в git-историю, файлы репозитория, CI-логи или сборочные артефакты — они использовались только как переменные окружения текущей агентской сессии и удалены из временных файлов после завершения работы.
