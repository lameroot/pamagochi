# Data-flow голосовой сессии

- Beads: pamagochi-eg9.2

```mermaid
sequenceDiagram
  autonumber
  actor Parent
  participant ParentApp as apps/parent
  participant API as apps/api
  participant DB as PostgreSQL
  participant Game as apps/game
  participant LK as LiveKit
  participant Agent as apps/voice-agent
  participant STT as STT provider
  participant LLM as LLM provider
  participant TTS as TTS provider

  Parent->>ParentApp: login / select child
  ParentApp->>API: auth + create game_session
  API->>DB: persist game_session (token_hash, expiry)
  API-->>ParentApp: limited launch payload (no parent JWT)
  ParentApp->>Game: open with limited-game-token
  Game->>API: bootstrap(game token)
  API->>DB: validate ownership/expiry/revoke
  API-->>Game: LIVEKIT_URL + room token + age band + scene bootstrap
  API->>LK: (token minting via API key, server-side)
  Game->>LK: connect + publish mic
  Agent->>API: internal session context (service token)
  API-->>Agent: minimal context + versions + memory slice
  Agent->>LK: join room as agent
  loop Voice turn
    Game->>LK: audio frames
    LK->>Agent: child audio
    Agent->>STT: streaming audio
    STT-->>Agent: partial/final transcript
    Agent->>Agent: input safety
    Agent->>LLM: PromptAssembler layers
    LLM-->>Agent: text (+ tool calls)
    Agent->>API: validate/execute allowlisted tools
    API->>DB: audit tool calls / world checks
    API-->>Agent: safe tool result
    Agent->>Agent: output safety
    Agent->>TTS: streaming synthesize
    TTS-->>Agent: audio
    Agent->>LK: agent audio
    LK->>Game: play + AgentState visuals
    Agent->>API: persist turns (idempotent)
    API->>DB: conversation_turns
  end
  Agent->>API: finalize session
  API->>DB: summary + memory proposals (policy)
  Parent->>ParentApp: history / memory / privacy
  ParentApp->>API: ownership-scoped read/edit/delete
```

## Trust notes

- Arrows carrying secrets stay server-side (API↔LiveKit credentials, Agent↔providers,
  Agent↔API service token).
- Game never receives provider keys or parent JWT.
- World mutations only via validated tool/request path through API/Phaser.
