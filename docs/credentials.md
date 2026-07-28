# Credentials — реестр (без значений)

Этот документ перечисляет **только названия и назначение** credentials. Значения никогда не записываются в этот или любой другой файл в репозитории.

| Название                                                              | Назначение                                                   | Где хранится                                  | Публично?                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------- |
| `DEV_AUTH_SECRET`                                                     | Подпись локального dev JWT (HS256)                           | `.env.local` (не в git)                       | Нет                                                              |
| `LOCAL_STORAGE_SIGNING_SECRET`                                        | HMAC-подпись локальных signed URL для файлового хранилища    | `.env.local` (не в git)                       | Нет                                                              |
| `DATABASE_URL`                                                        | Runtime-подключение Prisma к PostgreSQL                      | `.env.local` / Koyeb Secrets                  | Нет                                                              |
| `DIRECT_DATABASE_URL`                                                 | Подключение для миграций Prisma                              | `.env.local` / Koyeb Secrets                  | Нет                                                              |
| `SUPABASE_URL`                                                        | Базовый URL Supabase-проекта                                 | Koyeb env / Cloudflare env                    | Да (публичный)                                                   |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`                        | Публичный anon-ключ Supabase (Auth)                          | Cloudflare env / GitHub Secrets (cloud-smoke) | Да                                                               |
| `SUPABASE_JWT_ISSUER` / `SUPABASE_JWKS_URL` / `SUPABASE_JWT_AUDIENCE` | Параметры верификации Supabase JWT                           | Koyeb env                                     | Да (не секрет)                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                           | Полный доступ к Supabase (не используется этим проектом)     | —                                             | **Никогда не использовать**                                      |
| `SUPABASE_S3_ACCESS_KEY` / `SUPABASE_S3_SECRET_KEY`                   | S3-совместимый доступ к приватному bucket `pamagochi-assets` | Koyeb Secrets                                 | Нет, только backend                                              |
| `CLOUD_TEST_EMAIL` / `CLOUD_TEST_PASSWORD`                            | Тестовый Supabase-пользователь для cloud smoke tests         | GitHub Secrets                                | Нет                                                              |
| `CLOUD_API_URL` / `CLOUD_WEB_URL`                                     | URL развёрнутых сервисов для smoke tests                     | GitHub Secrets                                | Да (публичные URL, но хранятся как secrets для гибкости ротации) |
| Koyeb API token                                                       | Управление сервисом `pamagochi-api` через Koyeb API/CLI      | Локально у оператора / GitHub Environment     | Нет                                                              |
| Cloudflare API token (Pages, минимальные права)                       | Управление проектом `pamagochi-web`                          | Локально у оператора                          | Нет                                                              |
| Supabase access token / Dashboard доступ                              | Администрирование проекта `pamagochi-dev`                    | Локально у оператора                          | Нет                                                              |
| GitHub token / integration                                            | CI, деплой-интеграции Koyeb/Cloudflare с репозиторием        | GitHub App / Actions                          | Нет                                                              |

## Принципы

- Ни одно из значений выше никогда не коммитится в Git, не пишется в issue/PR/commit message, не печатается в build log.
- Все секреты хранятся в platform secret stores: Koyeb Secrets, Cloudflare Pages Environment Variables, GitHub Actions Secrets.
- Скрипты в `scripts/*.mjs` печатают только имена переменных окружения, никогда значения (см. `scripts/lib/log.mjs`).
- Список credentials, рекомендованных к ротации после выполнения этой задачи, — в `docs/deployment-report.md`.
