# Threat model: голосовая сессия Памагочи

- Beads: pamagochi-eg9.2
- Related: [ADR 0001](./adr/0001-livekit-and-application-boundaries.md), [data-flow](./data-flow-voice-session.md)

## Assets

| Asset                                               | Sensitivity                   |
| --------------------------------------------------- | ----------------------------- |
| Parent account / JWT                                | High                          |
| Child profile (name, age/birth, education settings) | High (child data)             |
| Limited game session token                          | High (scoped access)          |
| LiveKit room token & media                          | High                          |
| Transcript / session summary                        | High                          |
| Long-term memory items                              | High                          |
| SOUL / safety policy / system prompt                | Medium (confidential)         |
| Provider API keys, `VOICE_AGENT_SERVICE_TOKEN`      | Critical                      |
| Tool allowlists / world state                       | Medium (integrity)            |
| Cost/usage budgets                                  | Medium (availability/finance) |

## Trust boundaries

1. Parent browser ↔ `apps/api` (Auth provider)
2. Parent browser ↔ `apps/parent` (no secrets in build)
3. Child device / `apps/game` ↔ `apps/api` bootstrap (limited token only)
4. `apps/game` ↔ LiveKit SFU (room token)
5. `apps/voice-agent` ↔ LiveKit SFU
6. `apps/voice-agent` ↔ STT/LLM/TTS providers
7. `apps/voice-agent` ↔ `apps/api` internal API (service token)
8. `apps/api` ↔ PostgreSQL

Child speech, parent notes, memory facts and transcripts are **DATA_NOT_INSTRUCTIONS**.

## Data-flow (summary)

Parent login → create/select child → create `game_session` → open `apps/game` with
limited token → bootstrap returns LiveKit URL + room token + minimal child age band →
game publishes mic → voice-agent joins room → STT → input safety → PromptAssembler →
LLM (+ allowlisted tools) → output safety → TTS → game plays audio → turns persisted →
session end → summary + memory proposals → parent reviews history/memory/privacy.

Full diagram: [data-flow-voice-session.md](./data-flow-voice-session.md).

## Threats and mitigations

### T1. Prompt injection / jailbreak via child speech

- **Threat:** Child (or attacker near mic) tries to override SOUL/safety, extract
  prompt, fake tool results, or escalate tools.
- **Mitigations:** Treat input as untrusted data; input safety classifier/rules;
  immutable safety layer first in PromptAssembler; no dynamic toolset from speech;
  adversarial suite (E2.8); short in-character refusals; safety_events.

### T2. Memory poisoning

- **Threat:** Injected speech becomes long-term “fact” and re-enters later prompts.
- **Mitigations:** Separate MemoryExtractor (no game tools/network); MemoryPolicyValidator
  category/PII/instruction filters; parent edit/disable/delete; provenance + versions;
  disabled/deleted never assembled into context.

### T3. Personal data leakage

- **Threat:** PII in prompts, logs, safety excerpts, parent UI, or provider payloads.
- **Mitigations:** Minimal child fields in bootstrap (age band, not full birth date);
  no parent JWT in game/voice-agent; audit payload minimization; no default audio
  recording; retention/delete/export controls; secrets never logged.

### T4. Ownership / IDOR

- **Threat:** Parent A reads/modifies child of parent B; reused/revoked game token;
  cross-session tool calls.
- **Mitigations:** RBAC + ownership guards on all `/api/children/*`; game token bound
  to one child/session with expiry/revoke; voice-agent session context from internal
  API only; one concurrent voice session per child.

### T5. Tool escalation / world mutation

- **Threat:** LLM invents tools, opens capsule, awards progress via text/RPC.
- **Mitigations:** ADR 0003 allowlist; Zod + scene/state validation; `scene_request_event`
  is request-only; Phaser/api are sources of truth; unknown tools rejected safely.

### T6. Credential exposure

- **Threat:** Keys in `VITE_*`, game bundle, examples, logs, error messages.
- **Mitigations:** Secrets only on api/voice-agent; `.env*.example` placeholders +
  `check-no-secrets-in-examples`; startup Zod schemas mask secrets in errors;
  rotation without code change.

### T7. Cost / resource exhaustion

- **Threat:** Long sessions, rapid turns, huge TTS/STT usage.
- **Mitigations:** Server-side duration/idle/turn/token/TTS/STT/daily budgets and
  circuit breakers; concurrent session limit; observability without CoT/secrets.

### T8. Network egress abuse from voice-agent

- **Threat:** Compromised agent process reaches arbitrary internet.
- **Mitigations:** No generic HTTP/browser/search tools; production egress allowlist
  to LiveKit + active providers + internal API (E6); fail closed on unknown hosts.

## Minimum privilege checklist

- [ ] Game token: single child + single room + short TTL
- [ ] Voice-agent service token: internal routes only
- [ ] Provider keys: server-only, per-environment
- [ ] Parent JWT: parent app/api only
- [ ] Audio recording: env AND consent AND child policy (default off)
- [ ] Soft-delete + retention jobs for transcripts/memory
- [ ] Parent-visible safety events use minimal excerpts

## Residual risks

Model providers process audio/text under their DPA; network isolation depends on
deployment controls (E6); children may still say sensitive things — retention and
parent delete are the compensating controls.
