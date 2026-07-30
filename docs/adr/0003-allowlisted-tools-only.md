# ADR 0003: Только allowlisted tools

- Status: Accepted
- Date: 2026-07-29
- Beads: pamagochi-eg9.1 (связан с E1/E2)

## Context

Свободный разговор не означает свободные полномочия. Generic tool/RPC даёт
модель путь к эскалации (shell, HTTP, изменение мира).

## Decision

Запрещены: shell/bash, filesystem, browser, web search, произвольный HTTP,
SQL tool, email/мессенджеры, чтение env, универсальный MCP, generic
`execute_action(name, args)` и любой RPC с произвольным методом.

Разрешены только явно описанные tools первой версии:

- `character_emote`
- `character_look_at`
- `character_gesture`
- `scene_highlight_object`
- `scene_request_event` (создаёт запрос; game engine решает переход)
- `request_parent_attention`

Каждый вызов проходит: Zod schema → scene allowlist → state machine →
ownership → rate limit → idempotency → timeout → audit.

## Consequences

Toolset расширяется только через изменение contracts + серверной валидации +
ADR/обновления этого решения. LLM-текст никогда не считается командой миру.
