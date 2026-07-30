# Ship–capsule intro (E5)

Deterministic first-meeting flow: child explores a Phaser ship scene, talks freely with Pamagochi through LiveKit, and progresses without HTML dialog menus or magic phrases.

## State machine

Canonical order (validated by `packages/game-protocol` and `apps/api`):

```
SHIP_DARK → SHIP_POWERED → VOICE_CONNECTION_READY → FIRST_VOICE_CONTACT →
POWER_CELL_DISCOVERED → POWER_RESTORED → CAPSULE_OPENING → FIRST_MEETING → INTRO_COMPLETED
```

- Transitions are **idempotent** (`from === to` is a no-op).
- **Invalid/out-of-order** transitions are rejected by game engine and API.
- LLM text cannot advance state; only validated player actions, voice link events, and accepted `scene_request_event` tool calls matter.

## Scenes

| Component                                     | Role                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `apps/game/src/scenes/ShipCapsuleScene.ts`    | Phaser visuals: ship hull, capsule, console, power cell, voice light |
| `apps/game/src/intro/intro-engine.ts`         | Local state machine + persistence                                    |
| `apps/game/src/protocol/game-voice-bridge.ts` | Agent state → capsule/light animation; tool results → scene          |

Bootstrap (`POST /api/game/bootstrap`) returns `sceneKey: ship-capsule-intro` and `introProgress` until `INTRO_COMPLETED`, then `talking-light`.

## Voice agent perception

`IntroProgressService.worldStateFor()` feeds `VoiceSessionContext.worldState` to `PromptAssembler`.

In `FIRST_VOICE_CONTACT` the agent:

- Hears the child through comms
- Does **not** see the room or child
- Must **not** claim the capsule is open
- Must **not** invent the child's name

`goal` on session context carries scene-specific role text from `introRoleDescriptionFor()`.

## Tool allowlists

Per-state allowlists live in `introAllowlistFor()` (`packages/game-protocol`).

`scene_request_event` creates a **pending** request only. The game engine accepts or rejects:

| Event            | Allowed in state        | Effect              |
| ---------------- | ----------------------- | ------------------- |
| `RESTORE_POWER`  | `POWER_CELL_DISCOVERED` | → `POWER_RESTORED`  |
| `OPEN_CAPSULE`   | `POWER_RESTORED`        | → `CAPSULE_OPENING` |
| `COMPLETE_INTRO` | `FIRST_MEETING`         | → `INTRO_COMPLETED` |

`OPEN_CAPSULE` is rejected when power is missing — cannot be bypassed via LLM text.

Server validation: `ToolValidator` + `apps/api` `ToolValidationService`.

## Persistence

Table `intro_progress` (Prisma):

- `childId`, `state`, `sharedEventsJson`, `completedAt`, `updatedAt`
- On `INTRO_COMPLETED`, `relationship_state.sharedEventsJson` is updated

Game client: `POST /api/game/intro-progress/transition` with `limitedGameToken` + `idempotencyKey`.

Reload/reconnect restores `introProgress` from bootstrap — no TTS/event replay.

## Agent connection states

Mapped visually on capsule `voice_light`:

| AgentState     | Visual                                          |
| -------------- | ----------------------------------------------- |
| `listening`    | Gentle blue pulse                               |
| `thinking`     | Faster purple pulse                             |
| `speaking`     | Green bright pulse                              |
| `interrupted`  | Yellow flash                                    |
| `reconnecting` | Slow orange pulse + hint text                   |
| `unavailable`  | Dim red + “ask a parent” hint (no stack traces) |

## Tests

| Package            | Test file                                                           |
| ------------------ | ------------------------------------------------------------------- |
| `game-protocol`    | `intro-state.test.ts`, `scene-events.test.ts`                       |
| `agent-core`       | `tool-validator.test.ts`                                            |
| `apps/api`         | `intro-progress.service.test.ts`, `tool-validation.service.test.ts` |
| `apps/game`        | `ship-capsule-intro.e2e.test.ts`, `game-voice-bridge.test.ts`       |
| `apps/voice-agent` | `ship-capsule-intro.test.ts`, `vertical-slice.test.ts`              |

## Constraints

- No React in child game UX
- Phaser ↔ voice only through `GameVoiceBridge` and `@pamagochi/contracts` payloads
- Free conversation — no branching dialog trees or HTML choice controls
