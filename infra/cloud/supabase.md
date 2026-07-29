# Supabase — настройка проекта `pamagochi-dev`

> **Статус:** проект реально настроен и работает — `pamagochi-dev`, ref `hvtvjlpzvetiejrgioek`, регион eu-west-2. Миграции применены, Auth и Storage проверены. Подробности — `docs/deployment-report.md`.
>
> ⚠️ Supabase Management API **не имеет эндпоинта для создания S3 Access Keys** (Storage) — единственный способ получить их — Dashboard → Project Settings → Storage → S3 Access Keys → New access key. Это придётся сделать вручную даже при полностью автоматизированной остальной настройке.

Этот документ описывает шаги настройки Supabase для cloud-профиля. Никакие значения credentials здесь не хранятся — только названия и порядок действий.

## 1. Создание проекта

1. Создать проект `pamagochi-dev` в Supabase Dashboard.
2. Регион — европейский, согласованный с регионом Render (например, Frankfurt / eu-central).
3. Не создавать production-проект в рамках этой задачи без явного запроса.

## 2. PostgreSQL

1. Создать отдельного database user для Prisma с минимально необходимыми правами (DML/DDL только на схему `public`).
2. Получить runtime connection string (через Supavisor transaction pooler) → `DATABASE_URL`.
3. Получить migration connection string (через Supavisor session pooler или прямое подключение) → `DIRECT_DATABASE_URL`.
4. Убедиться, что SSL включён (`sslmode=require`).
5. Ограничить размер пула соединений Prisma (`connection_limit` в connection string) в соответствии с лимитами Supabase-плана.
6. Prisma управляет только схемой `public`. Никогда не запускать миграции на схемы `auth`, `storage`, `realtime`.

## 3. Auth

1. Включить email/password провайдер.
2. Включить восстановление пароля (email template по умолчанию подходит для dev).
3. Не включать OAuth-провайдеры на этом этапе.
4. Добавить redirect URLs: `http://localhost:5173` (dev) и Cloudflare Pages URL после деплоя.
5. Создать одного тестового cloud-пользователя с отдельным тестовым email (не использовать реальные персональные данные).
6. Записать (не в git!): `SUPABASE_URL`, `SUPABASE_JWT_ISSUER` (`${SUPABASE_URL}/auth/v1`), `SUPABASE_JWKS_URL` (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), `SUPABASE_JWT_AUDIENCE=authenticated`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 4. Storage

1. Создать приватный bucket `pamagochi-assets` (не публичный).
2. Создать S3-compatible access key/secret с правами только на этот bucket (backend-only).
3. Записать: `SUPABASE_STORAGE_BUCKET`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`.
4. Никогда не передавать эти значения на frontend.

## 5. Применение миграций

```bash
DATABASE_URL=... DIRECT_DATABASE_URL=... pnpm db:migrate:cloud
```

Миграции идентичны локальным (`packages/database/prisma/migrations`) — Prisma управляет одной и той же схемой независимо от профиля.

## 6. Проверка

После настройки — выполнить `pnpm dev:cloud` локально (без Docker) и убедиться, что API успешно подключается к Supabase Postgres, а frontend — к Supabase Auth.
