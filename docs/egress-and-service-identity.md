# Egress restrictions and service identity (E6.1)

Voice-agent runs in an isolated runtime with **no browser access**, **no generic HTTP**, and **no web search**. Outbound connections are limited to an explicit allowlist enforced in code (`apps/voice-agent/src/safety/egress-policy.ts`) and at the infrastructure/network layer in production.

## Allowlisted egress

| Category     | Hosts (examples)                               | Purpose                          |
| ------------ | ---------------------------------------------- | -------------------------------- |
| LiveKit      | `*.livekit.cloud`, local dev                   | Signaling + media SFU            |
| Deepgram     | `api.deepgram.com`                             | STT                              |
| DeepSeek     | `api.deepseek.com`                             | LLM                              |
| ElevenLabs   | `api.elevenlabs.io`                            | TTS                              |
| Internal API | Configured `VOICE_AGENT_INTERNAL_API_URL` host | Transcript, tools, memory, usage |

All other destinations must be **blocked** (unit tests in `egress-policy.test.ts`).

## Adapter contract

Provider adapters (Deepgram, DeepSeek, ElevenLabs, internal HTTP clients) should call `assertEgressAllowed(url)` before `fetch` / WebSocket connect. Mock providers in local profile do not open network sockets.

## Service identity (`VOICE_AGENT_SERVICE_TOKEN`)

- Voice-agent authenticates to `apps/api` internal routes with `Authorization: Bearer <VOICE_AGENT_SERVICE_TOKEN>`.
- **Not** a parent JWT — no parent impersonation, no direct DB credentials.
- Minimum length 32 characters (validated at startup).
- Compared with `timingSafeEqual` in `ServiceAuthGuard`.

### Rotation procedure

1. Generate a new token in your secret manager (never commit to git).
2. Set `VOICE_AGENT_SERVICE_TOKEN` on **both** `apps/api` and `apps/voice-agent`.
3. Rolling deploy: update API first (accepts new token), then voice-agent.
4. Revoke the previous token in the secret manager after all agents reconnect.
5. Audit logs must never print the token — only a short prefix for correlation.

Local profile: use values from `.env.local.example` placeholders only.

## What is forbidden

- Arbitrary URLs from LLM output or tool arguments
- Metadata / cloud credential endpoints (e.g. `169.254.169.254`)
- Parent JWT or database connection strings inside voice-agent
- Logging request headers containing `Authorization`

## Verification

```bash
pnpm --filter @pamagochi/voice-agent test -- egress-policy
```

Network policy in cloud should mirror the same host list (egress firewall / security groups).
