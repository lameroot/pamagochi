# Load, voice, and reconnect test harness (E6.3)

In-process harness for session limits, metrics, and reconnect behaviour without LiveKit or paid providers.

## Location

`apps/voice-agent/src/observability/reconnect-and-load.test.ts`

## What it covers

- Reconnect counter increments without duplicating completed turn latency samples
- Concurrent session rejection (`concurrent_sessions` violation)
- Turn burst / `turns_per_minute` enforcement
- Usage accumulation bounded across many reconnect cycles (no unbounded array growth in metrics)

## Run

```bash
# From repo root
pnpm --filter @pamagochi/voice-agent test -- reconnect-and-load

# Or full voice-agent suite
pnpm --filter @pamagochi/voice-agent test
```

## Manual / integration follow-up

For end-to-end voice (mic, network loss, duplicate TTS), use the acceptance checklist in [acceptance-checklist.md](./acceptance-checklist.md) after `pnpm verify:local`.

Provider failure simulation: set `VOICE_*_PROVIDER=mock` in `.env.local` and exercise reconnect in the game client while voice-agent restarts.

## Expected outcomes

| Scenario                        | Expected                                                                |
| ------------------------------- | ----------------------------------------------------------------------- |
| Second tab / session same child | API/voice limits deny with `concurrent_sessions`                        |
| Rapid reconnect loop            | `reconnects` metric increases; no duplicate `e2eMs` per incomplete turn |
| 50 turn simulation              | Fixed-size latency arrays; usage totals linear in turn count            |
