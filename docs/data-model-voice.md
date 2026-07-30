# Модель данных голосового Памагочи

- Beads: pamagochi-eg9.4
- Изменения схемы — только через Prisma migrations (`pnpm db:migrate:local` / `cloud`).

## Ownership

Все child-scoped таблицы ссылаются на `child_profiles` (и косвенно на `parent_accounts`).
Чтение/запись с parent API всегда проверяет `parentId` текущего родителя.
Internal voice-agent API использует service token и привязку к активной `game_session`.

## Таблицы

| Table                   | Purpose                                 | Soft delete / retention |
| ----------------------- | --------------------------------------- | ----------------------- |
| `child_profiles`        | Профиль ребёнка (+ language/levels)     | `deleted_at`            |
| `game_sessions`         | Limited launch tokens                   | `revoked_at`, short TTL |
| `conversation_sessions` | Voice session metadata, costs, versions | status lifecycle        |
| `conversation_turns`    | Transcript turns                        | retention job (E6)      |
| `agent_tool_calls`      | Tool audit (no secrets)                 | tied to session         |
| `memory_items`          | Long-term facts                         | `status` + `deleted_at` |
| `memory_versions`       | Audit trail edits                       | immutable history       |
| `relationship_state`    | Per-child relationship                  | upsert by child         |
| `safety_events`         | Safety audit / parent-visible subset    | minimize excerpts       |
| `privacy_consents`      | Versioned consents                      | `revoked_at`            |
| `agent_prompt_versions` | SOUL/safety/runtime templates           | draft/active/retired    |

## Indexes

- `child_profiles(parent_id)`, `child_profiles(deleted_at)`
- `game_sessions(child_id, status)`, `game_sessions(token_hash)` unique
- `conversation_sessions(child_id, started_at)`
- `conversation_turns(conversation_session_id, sequence_no)` unique
- `memory_items(child_id, status)`, `memory_items(child_id, pinned)`
- `safety_events(child_id, created_at)`
- `privacy_consents(child_id, consent_type, version)`
- `agent_prompt_versions(kind, semantic_version)` unique, `(kind, status)`

## Migration plan

1. **E0/E1:** add enums + tables above; extend `child_profiles` with
   `primary_language`, optional `birth_date`, levels, `deleted_at` without
   breaking existing `avatarKey`/`birthYear` columns.
2. **E2:** seed active `agent_prompt_versions` for soul/safety.
3. **E3:** enable memory extractor writes + relationship updates.
4. **E4:** parent privacy/export uses soft-delete semantics.
5. **E6:** retention jobs hard-delete expired soft-deleted rows per policy.

Ручные правки БД запрещены.
