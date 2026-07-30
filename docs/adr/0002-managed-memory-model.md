# ADR 0002: Управляемая память без vector DB

- Status: Accepted
- Date: 2026-07-29
- Beads: pamagochi-eg9.1 (связан с E3)

## Context

Памагочи должен узнавать ребёнка между сессиями, но детские данные нельзя
превращать в непрозрачный embedding-store без контроля родителя.

## Decision

Разделить четыре вида данных:

1. **Текущий разговор** — эфемерный `ChatContext` активной сессии.
2. **Полная история** — transcript turns в PostgreSQL.
3. **Резюме встречи** — короткое schema-validated summary после finalize.
4. **Долгосрочная память** — структурированные `memory_items` с категориями,
   confidence, provenance, lifecycle `active|disabled|deleted` и
   `memory_versions` audit trail.

Правила:

- Нет vector database в первой версии.
- Основной conversational agent **не пишет** memory напрямую.
- Отдельный `MemoryExtractor` предлагает facts; `MemoryPolicyValidator`
  принимает/отклоняет; родитель может edit/disable/delete/pin.
- В следующий prompt попадают last summary + 5–15 active items + relationship
  state; полный transcript не подмешивается.
- Удалённая/disabled память немедленно исключается из context assembly.

## Alternatives considered

- Vector RAG по полному transcript — сложно аудировать, выше риск PII leakage
  и memory poisoning.
- Память только в промпте без persistence — нет родительского контроля и
  повторного узнавания.

## Consequences

Схема БД должна покрывать sessions/turns/memory/relationship/safety/consents.
Любой переход на embeddings/vector search требует нового ADR.
