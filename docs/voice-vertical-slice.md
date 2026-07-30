# Voice vertical slice (E1)

End-to-end path for the **Talking Light** technical scene: parent launches game → child speaks → agent replies with optional `character_emote` → transcript and metrics persist via internal API.

## Prerequisites

- Node.js 24, pnpm, Docker (PostgreSQL for `APP_PROFILE=local`)
- LiveKit project URL + API key/secret (or mock transport for agent-only dry runs)

```bash
cp .env.local.example .env.local
pnpm install
pnpm setup:local
```

Set in `.env.local` (never commit real values):

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `VOICE_AGENT_SERVICE_TOKEN` (≥32 chars, shared by API and voice-agent)

## Run locally

### 1. API + database

```bash
pnpm dev:local
# API on http://localhost:3000
```

### 2. Create a game session (parent dev login)

Use parent app or API dev login to create a child and `POST /api/children/:id/game-sessions`. Copy `limitedGameToken` from the response.

### 3. Game (Phaser)

```bash
pnpm --filter @pamagochi/game dev
# Open http://localhost:5173/?token=<limitedGameToken>
```

The scene will:

1. Call `POST /api/game/bootstrap` with the limited token
2. Connect to LiveKit (`livekit-client`), publish mic, subscribe agent audio
3. Map `AgentState` events to light color/pulse (no technical errors shown to the child)
4. Flash accent colors on accepted `character_emote` tool results

### 4. Voice agent

```bash
export VOICE_GAME_SESSION_ID=<gameSessionId from bootstrap>
export VOICE_STT_PROVIDER=mock
export VOICE_LLM_PROVIDER=mock
export VOICE_TTS_PROVIDER=mock
# Optional: VOICE_ROOM_TRANSPORT=mock for token-only dry run
pnpm --filter @pamagochi/voice-agent dev
```

## What gets measured

`apps/voice-agent/src/observability/metrics.ts` collects per turn (no secrets / chain-of-thought):

| Metric               | Description                                 |
| -------------------- | ------------------------------------------- |
| `stt_partial_ms`     | Time to first STT partial                   |
| `llm_first_token_ms` | Time to first LLM token                     |
| `tts_first_audio_ms` | Time to first TTS audio chunk               |
| `e2e_ms`             | Turn start → agent reply complete           |
| `reconnects`         | LiveKit reconnect count                     |
| `usage`              | Input/output tokens, TTS chars, STT seconds |
| `errors`             | Safe error labels only                      |

Inspect via `AgentSession.getMetrics()` in tests or extend logging in `main.ts` for local runs.

## Persistence

| Endpoint                                                        | Purpose                            |
| --------------------------------------------------------------- | ---------------------------------- |
| `POST /internal/agent/sessions/:conversationSessionId/turns`    | Append turn (`idempotencyKey`)     |
| `POST /internal/agent/sessions/:conversationSessionId/finalize` | Mark session completed             |
| `POST /internal/agent/sessions/:conversationSessionId/tools`    | Validate `character_emote` + audit |

All require `Authorization: Bearer <VOICE_AGENT_SERVICE_TOKEN>`.

## Barge-in

When the child speaks while the agent is in `speaking` state:

1. TTS session is interrupted
2. State briefly shows `interrupted`, then `listening`
3. `playedTextLength` excludes the unplayed tail from agent context / transcript

## Automated checks

```bash
pnpm --filter @pamagochi/game test
pnpm --filter @pamagochi/game typecheck
pnpm --filter @pamagochi/voice-agent test
pnpm --filter @pamagochi/voice-agent typecheck
pnpm --filter @pamagochi/api test
pnpm --filter @pamagochi/api typecheck
```

`apps/voice-agent/src/agent/vertical-slice.test.ts` runs a mock multi-turn flow with interruption, idempotent transcript append, tool invoke, and metrics assertions.

## Known gaps (E1)

- LiveKit **data channel** publishing from `LiveKitRoomTransport` is scaffolded; mock transport covers tests and local protocol validation.
- Real STT/LLM/TTS providers require API keys; use `mock` selectors for offline development.
- Game autoplay may require a user gesture in some browsers before agent audio plays (visual states still work).
