# Test environment acceptance checklist (E6.7)

Manual acceptance for **local** and **test** profiles before release. No production secrets in `.env` files — use placeholders from `*.example` only.

## Prerequisites

```bash
cp .env.local.example .env.local
pnpm install
pnpm setup:local
```

Docker required for PostgreSQL. Voice providers can stay on `mock` for most checks.

## 1. Stack health

- [ ] `pnpm verify:local` completes (API smoke, web build, tests)
- [ ] `GET /api/health/ready` returns 200
- [ ] `GET /api/docs` loads (local profile only)

## 2. Parent journey

- [ ] `POST /api/dev/login` returns bearer token
- [ ] Create child profile (`POST /api/children`)
- [ ] Grant privacy consents (`POST /api/children/:id/consents`)
- [ ] View overview (`GET /api/children/:id/overview`)
- [ ] View usage (`GET /api/children/:id/usage`) — returns zeros before sessions

## 3. Game session + voice path

- [ ] Create game session for child (parent flow or API)
- [ ] Bootstrap returns LiveKit URL + room token (or mock in local)
- [ ] Start voice-agent: `pnpm dev:voice-agent` (or full `pnpm dev:local`)
- [ ] Child client connects; agent joins room
- [ ] At least one turn persisted (`conversation_turns` row)
- [ ] Session finalize produces summary or empty transcript handling

See [voice-agent-local.md](./voice-agent-local.md) and [voice-vertical-slice.md](./voice-vertical-slice.md).

## 4. Safety and ownership

- [ ] Parent A cannot access Parent B child (`404` on wrong `childId`)
- [ ] Deleted memory not in voice context (soft-delete then new session)
- [ ] Internal routes reject missing/invalid service token (`401`)
- [ ] `pnpm --filter @pamagochi/api test -- security-ownership`

## 5. Hardening (E6)

- [ ] Egress unit tests pass: `pnpm --filter @pamagochi/voice-agent test -- egress-policy`
- [ ] Reconnect/load harness passes: `pnpm --filter @pamagochi/voice-agent test -- reconnect-and-load`
- [ ] Rate limit: rapid parent requests eventually return `429`
- [ ] Retention job registered (dispatch `retention.hard-delete` via InlineJobDispatcher in integration test or manual trigger)

## 6. Provider errors and reconnect

- [ ] Stop voice-agent mid-session → client shows recoverable state (no crash loop)
- [ ] Restart voice-agent → reconnect without duplicate TTS for same turn idempotency key
- [ ] Mock LLM timeout → circuit breaker / refusal path (no unbounded retries)

## 7. Privacy

- [ ] Delete conversation removes turns from parent view
- [ ] Export child data (`GET .../privacy/export`) excludes other children
- [ ] No secrets in browser network tab or server logs (spot-check)

## Artifacts

Record in PR or release notes:

- Date, profile (`local` / `test`)
- Git SHA
- Pass/fail per section
- Known limitations (e.g. ship scene pending E5)

## Automated voice path in CI

`pnpm verify:local` runs API integration smoke. Full voice E2E requires LiveKit credentials — keep optional in test environment. For voice-specific unit coverage:

```bash
pnpm --filter @pamagochi/voice-agent test
pnpm --filter @pamagochi/agent-core test
```
