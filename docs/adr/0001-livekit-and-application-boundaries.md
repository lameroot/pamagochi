# ADR 0001: LiveKit и границы приложений

- Status: Accepted
- Date: 2026-07-29
- Beads: pamagochi-eg9.1

## Context

Нужен безопасный голосовой vertical slice: родитель запускает игру для
конкретного ребёнка, ребёнок говорит голосом с LLM-персонажем в Phaser-мире,
а агент не получает произвольных полномочий. Текущий монорепозиторий уже
содержит `apps/web` (React+Phaser) и `apps/api`, но план разделяет детский и
родительский UX и выносит голосовой runtime в отдельный процесс.

## Decision

### Transport: LiveKit

- Использовать **LiveKit** (WebRTC) как единственный транспорт аудио между
  `apps/game` и `apps/voice-agent`.
- Голосовой runtime: классическая цепочка **STT → LLM → TTS** (не speech-to-speech),
  чтобы сохранять transcript, фильтровать input/output и менять провайдеров.
- Первичные провайдеры прототипа: Deepgram (STT), DeepSeek OpenAI-compatible (LLM),
  ElevenLabs (TTS). Выбор активного провайдера — только через env selectors
  (`VOICE_STT_PROVIDER` / `VOICE_LLM_PROVIDER` / `VOICE_TTS_PROVIDER`).

### Границы приложений

| Приложение         | Стек                     | Ответственность                                                                                              |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `apps/game`        | Phaser + TypeScript      | Сцены, микрофон, agent audio, визуальные AgentState, выполнение разрешённых RPC. Без React/HTML-форм.        |
| `apps/parent`      | React + TypeScript       | Auth родителя, профили детей, запуск сессии, история, память, privacy, safety events.                        |
| `apps/api`         | NestJS + Fastify         | Источник истины ownership/RBAC, game tokens, transcript, memory, consents, audit, серверная валидация tools. |
| `apps/voice-agent` | LiveKit Agents (Node/TS) | Подключение к room, PromptAssembler/SOUL, STT/LLM/TTS, safety, tools, persistence через internal API.        |

`apps/web` остаётся переходным приложением до полной миграции UI в
`apps/game` + `apps/parent` и не получает голосовых секретов.

### Источник истины игрового мира

- **Phaser и `apps/api`** — источники истины о мире и прогрессе.
- LLM **не** меняет world state текстом. Допустимы только строго типизированные
  allowlisted tools; backend/Phaser валидируют запрос относительно сцены и
  state machine.
- React никогда не мутирует Phaser Scene напрямую и наоборот — только через
  типизированный bridge/protocol (`packages/contracts`, `packages/game-protocol`).

### Профили local / cloud

- `APP_PROFILE=local` и `APP_PROFILE=cloud` не смешивают провайдеры Auth/Storage/DB
  (существующее правило `apps/api/src/config`).
- Local-профиль не требует Supabase/Render/Cloudflare для базового запуска;
  LiveKit/STT/LLM/TTS для голосового среза могут быть внешними сервисами,
  но секреты остаются только на сервере.

### Секреты и токены

- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`, provider API keys и
  `VOICE_AGENT_SERVICE_TOKEN` — только `apps/api` и/или `apps/voice-agent`.
- `apps/game` получает через bootstrap API лишь `LIVEKIT_URL` и короткоживущий
  room token с минимальными grants для одной child/game session.
- Parent JWT никогда не передаётся в game или voice-agent.

## Alternatives considered

1. **WebSocket + custom audio streaming** — больше своей инфраструктуры,
   хуже reconnect/NAT, дольше до vertical slice.
2. **Speech-to-speech модель** — ниже контроль transcript/safety/tool calling
   и сложнее замена компонентов.
3. **Единый `apps/web` для parent+child** — повышает риск утечки родительских
   экранов/данных в детский UX и смешивает React-формы с Phaser.
4. **Voice-agent внутри `apps/api`** — смешивает HTTP API с долгоживущим
   realtime runtime и усложняет изоляцию/egress.

## Consequences

- Появляются новые apps: `game`, `parent`, `voice-agent` и пакеты протокола.
- Нужен internal service auth между voice-agent и api.
- Изменение границ приложений, транспорта или правила «LLM не источник истины»
  требует **нового ADR**; правки кода без ADR запрещены.
