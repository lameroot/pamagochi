# Observability and cost (E6.5)

## Metrics collected (voice-agent)

`VoiceMetricsCollector` (`apps/voice-agent/src/observability/metrics.ts`) tracks per-session:

| Metric             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `sttPartialMs`     | Time to first STT partial                              |
| `llmFirstTokenMs`  | Time to first LLM token (from turn start)              |
| `ttsFirstAudioMs`  | Time to first TTS audio                                |
| `e2eMs`            | End-to-end turn latency                                |
| `reconnects`       | LiveKit / transport reconnect count                    |
| `usage`            | Aggregated input/output tokens, TTS chars, STT seconds |
| `estimatedCostUsd` | Rough USD estimate (not billing-grade)                 |
| `errors`           | Sanitized error strings (max 200 chars, no secrets)    |

**Never logged:** chain-of-thought, raw audio, auth headers, API keys, full child transcripts in debug logs.

## API usage endpoints

### Parent (ownership-safe)

```
GET /api/children/:childId/usage
Authorization: Bearer <parent JWT>
```

Returns daily rollup for the owned child (`ChildUsageSummaryDto` in `packages/contracts`).

### Internal (service token)

```
GET /internal/agent/usage
Authorization: Bearer <VOICE_AGENT_SERVICE_TOKEN>
```

Returns global daily rollup across all children (`GlobalUsageSummaryDto`).

Cost fields are derived from persisted `conversation_sessions.cost*` columns via `aggregateSessionCosts` in `@pamagochi/agent-core`.

## Rate limits

Parent usage routes share `ParentApiRateLimitGuard` (120 req/min). Internal usage shares `InternalApiRateLimitGuard` (600 req/min).

## Local verification

```bash
pnpm --filter @pamagochi/api test -- child-usage
pnpm --filter @pamagochi/voice-agent test -- metrics
```

With API running locally:

```bash
# After dev login and creating a child
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/children/$CHILD_ID/usage | jq
```

## Dashboard guidance (cloud)

- Plot p50/p95 of `e2eMs`, `llmFirstTokenMs`, `ttsFirstAudioMs`
- Alert on `reconnects` spike per session
- Alert on global `estimatedCostUsd` approaching `VOICE_GLOBAL_DAILY_BUDGET_USD`
- Correlate with `soulVersion` / `safetyPolicyVersion` from session context

Mask child IDs in external dashboards (show truncated hash only).
