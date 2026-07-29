# Памагочи

Образовательная игровая платформа. Монорепозиторий на TypeScript (pnpm + Turborepo), с двумя профилями запуска: `local` (автономная разработка) и `cloud` (Supabase + Render + Cloudflare Pages).

Быстрый локальный старт:

```bash
cp .env.local.example .env.local
pnpm install
pnpm setup:local
pnpm dev:local
```

Разработка с облачной инфраструктурой:

```bash
cp .env.cloud.example .env.cloud.local
pnpm dev:cloud
```

## Структура

См. `AGENTS.md` для описания структуры и правил работы, `docs/architecture.md` для архитектуры, `docs/local-development.md` и `docs/cloud-development.md` для подробных инструкций по каждому профилю, `docs/deployment.md` для деплоя, `docs/versions.md` для зафиксированных версий зависимостей.

## Основные команды

```bash
pnpm dev:local        # web + api локально, PostgreSQL в Docker
pnpm dev:cloud        # web + api локально против облачного Supabase
pnpm verify:local     # автоматическая проверка local-профиля
pnpm verify:cloud     # автоматическая проверка cloud-профиля
pnpm check            # format + lint + typecheck + test + build
```

## Статус

Результаты последней проверки — в `docs/deployment-report.md`.
