# Credentials — реестр (без значений)

Этот документ перечисляет **только названия и назначение** credentials. Значения никогда не записываются в этот или любой другой файл в репозитории.

| Название                                                                                         | Назначение                                                                               | Где хранится                                  | Публично?                                                        |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `DEV_AUTH_SECRET`                                                                                | Подпись локального dev JWT (HS256)                                                       | `.env.local` (не в git)                       | Нет                                                              |
| `LOCAL_STORAGE_SIGNING_SECRET`                                                                   | HMAC-подпись локальных signed URL для файлового хранилища                                | `.env.local` (не в git)                       | Нет                                                              |
| `DATABASE_URL`                                                                                   | Runtime-подключение Prisma к PostgreSQL                                                  | `.env.local` / Render Environment             | Нет                                                              |
| `DIRECT_DATABASE_URL`                                                                            | Подключение для миграций Prisma                                                          | `.env.local` / Render Environment             | Нет                                                              |
| `SUPABASE_URL`                                                                                   | Базовый URL Supabase-проекта                                                             | Render env / Cloudflare env                   | Да (публичный)                                                   |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`                                                   | Публичный anon-ключ Supabase (Auth)                                                      | Cloudflare env / GitHub Secrets (cloud-smoke) | Да                                                               |
| `SUPABASE_JWT_ISSUER` / `SUPABASE_JWKS_URL` / `SUPABASE_JWT_AUDIENCE`                            | Параметры верификации Supabase JWT                                                       | Render env                                    | Да (не секрет)                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                      | Полный доступ к Supabase (не используется этим проектом)                                 | —                                             | **Никогда не использовать**                                      |
| `SUPABASE_S3_ACCESS_KEY` / `SUPABASE_S3_SECRET_KEY`                                              | S3-совместимый доступ к приватному bucket `pamagochi-assets`                             | Render Environment                            | Нет, только backend                                              |
| `RENDER_DEPLOY_HOOK_URL`                                                                         | Одноразовый секретный URL для запуска деплоя `pamagochi-api` в Render после успешного CI | GitHub Secrets                                | Нет                                                              |
| `CLOUD_TEST_EMAIL` / `CLOUD_TEST_PASSWORD`                                                       | Тестовый Supabase-пользователь для cloud smoke tests                                     | GitHub Secrets                                | Нет                                                              |
| `CLOUD_API_URL` / `CLOUD_WEB_URL`                                                                | URL развёрнутых сервисов для smoke tests                                                 | GitHub Secrets                                | Да (публичные URL, но хранятся как secrets для гибкости ротации) |
| Render API key (опционально, только для управления через Render API/CLI, не для обычного деплоя) | Администрирование сервиса `pamagochi-api`                                                | Локально у оператора                          | Нет                                                              |
| Cloudflare API token (Pages, минимальные права)                                                  | Управление проектом `pamagochi-web`                                                      | Локально у оператора                          | Нет                                                              |
| Supabase access token / Dashboard доступ                                                         | Администрирование проекта `pamagochi-dev`                                                | Локально у оператора                          | Нет                                                              |
| GitHub token / integration                                                                       | CI, деплой-интеграции Render/Cloudflare с репозиторием                                   | GitHub App / Actions                          | Нет                                                              |

| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit Cloud: URL и серверные ключи для mint room tokens и voice-agent | `.env.local` / Cursor secrets / Render env | Нет (кроме URL, который отдаётся game через bootstrap) |
| `LIVEKIT_AGENT_NAME` | Имя агента в LiveKit | env voice-agent | Да (не секрет) |
| `VOICE_AGENT_SERVICE_TOKEN` | Service-to-service auth voice-agent → api internal routes | api + voice-agent env only | Нет |
| `DEEPGRAM_API_KEY` | Streaming STT | voice-agent env only | Нет |
| `DEEPSEEK_API_KEY` | LLM (OpenAI-compatible) | voice-agent env only | Нет |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | TTS | voice-agent env only | Нет |
| `CARTESIA_API_KEY` / `CARTESIA_VOICE_ID` | Cartesia TTS (включая русский язык) | voice-agent env only | Нет |

## ⚠️ Инцидент: утечка реальных credentials в `.env.cloud.example` (обнаружено и исправлено 2026-07-29)

В `.env.cloud.example` в публичном репозитории оказались реальные значения вместо плейсхолдеров: пароль подключения к Supabase PostgreSQL, `SUPABASE_S3_ACCESS_KEY`/`SUPABASE_S3_SECRET_KEY` и `VITE_SUPABASE_ANON_KEY` проекта Supabase `pamagochi` (ref `zainvvtkjvhoasiwdcnd`, регион eu-west-1 — **не** `pamagochi-dev`, который использовался для остальной работы над задачей). Файл содержал эти значения с момента первого коммита в git-историю ветки; репозиторий публичный, поэтому эти значения нужно считать скомпрометированными.

**Что сделано:**

- Значения в `.env.cloud.example` заменены обратно на плейсхолдеры (`replace-me`/`PROJECT_REF`).
- Добавлена автоматическая проверка `scripts/check-no-secrets-in-examples.mjs`, встроенная в `pnpm check` и в CI (`ci.yml`) — сканирует все `*.example`-файлы на JWT-подобные строки, connection strings с паролем и длинные значения в переменных `*_KEY`/`*_SECRET`/`*_TOKEN`/`*_PASSWORD`, падает при обнаружении.
- Значения остаются в git-истории веток `cursor/pamagochi-monorepo-skeleton-d23e` и `main` до тех пор, пока история не будет переписана (force-push) — это отдельное, более рискованное действие, которое не выполнялось без явного запроса.

**Требуется от владельца проекта (срочно):**

1. Ротировать пароль database user в Supabase-проекте `pamagochi` (ref `zainvvtkjvhoasiwdcnd`): Dashboard → Project Settings → Database → Reset database password.
2. Ротировать `SUPABASE_S3_ACCESS_KEY`/`SUPABASE_S3_SECRET_KEY` этого же проекта: Dashboard → Project Settings → Storage → S3 Access Keys → отозвать старый, создать новый.
3. Опционально — ротировать JWT secret проекта (что инвалидирует все текущие anon/service_role JWT), если проект `pamagochi` содержит что-то чувствительное.
4. Рассмотреть переписывание git-истории (`git filter-repo`/BFG + force-push) для полного удаления значений из истории — учитывая, что репозиторий публичный, это не отменяет уже случившуюся экспозицию, но снижает риск повторной находки в будущем.

## Принципы

- Ни одно из значений выше никогда не коммитится в Git, не пишется в issue/PR/commit message, не печатается в build log.
- Все секреты хранятся в platform secret stores: Render Environment Variables, Cloudflare Pages Environment Variables, GitHub Actions Secrets.
- Скрипты в `scripts/*.mjs` печатают только имена переменных окружения, никогда значения (см. `scripts/lib/log.mjs`).
- Список credentials, рекомендованных к ротации после выполнения этой задачи, — в `docs/deployment-report.md`.
