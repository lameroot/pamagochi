# Project status — Pamagochi voice platform

Last updated: 2026-07-30 (E5 ship-capsule + E6 production hardening on `create_persona`).

## Definition of Done (plan §16)

| Criterion                                                      | Status  | Evidence                                                                               |
| -------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Monorepo builds with Node 24 + pnpm                            | Met     | `pnpm check`                                                                           |
| Local profile autonomous (Postgres Docker, local auth/storage) | Met     | `pnpm setup:local`, `pnpm verify:local`                                                |
| Prisma migrations applied idempotently                         | Met     | `pnpm db:migrate:local`                                                                |
| Contracts (Zod) shared web/api/voice                           | Met     | `packages/contracts`                                                                   |
| Voice session data model + internal API                        | Met     | ADR 0001, `internal/agent/*`                                                           |
| Service token auth (no parent JWT on voice-agent)              | Met     | `ServiceAuthGuard`, [egress-and-service-identity.md](./egress-and-service-identity.md) |
| Egress allowlist enforced in code                              | Met     | `egress-policy.ts`, `egressFetch` on providers/clients                                 |
| Session limits + daily budgets                                 | Met     | `session-limits.ts`, `BudgetTracker` wired in AgentSession                             |
| Circuit breakers on provider failures                          | Met     | `SimpleCircuitBreaker` via LLM/TTS failure paths                                       |
| Rate limits (auth, parent, internal)                           | Met     | `rate-limit.guard.ts`                                                                  |
| Input/output safety + adversarial suite                        | Met     | `adversarial.test.ts`, E6.6 regression                                                 |
| Tool allowlist only (no escalation)                            | Met     | ADR 0003, `ToolValidator`, scene-scoped tools                                          |
| Memory policy + parent control                                 | Met     | ADR 0002, parent cabinet                                                               |
| Retention soft-delete + hard-delete jobs                       | Met     | `RetentionCleanupService` + `retention.hard-delete`                                    |
| Observability metrics + cost endpoints                         | Met     | [observability-cost.md](./observability-cost.md), usage POST + child usage API         |
| Reconnect/load harness                                         | Met     | [load-voice-reconnect.md](./load-voice-reconnect.md)                                   |
| Threat model + ADRs documented                                 | Met     | `docs/threat-model-voice-session.md`, `docs/adr/`                                      |
| No secrets in examples/docs                                    | Met     | `pnpm check:no-secrets-in-examples`                                                    |
| Security/ownership regression tests                            | Met     | `security-ownership.regression.test.ts`                                                |
| Manual acceptance checklist                                    | Met     | [acceptance-checklist.md](./acceptance-checklist.md)                                   |
| Ship scene (E5) vertical slice                                 | Met     | `ShipCapsuleScene`, intro state machine, scene tools                                   |
| Cloud deploy + dashboards wired                                | Partial | Docs exist; production dashboards operator-dependent                                   |
| Multi-instance rate limits / budgets                           | Partial | In-memory guards; Redis/store noted in code comments                                   |
| Full LiveKit rtc-node media path                               | Partial | Token + data-channel queue wired; WebRTC media scaffold                                |

## Epic E5 sub-tasks

| Task | Title                               | Status                   |
| ---- | ----------------------------------- | ------------------------ |
| E5.1 | Deterministic intro state machine   | Done                     |
| E5.2 | Phaser ship/capsule scene           | Done                     |
| E5.3 | Voice contact in closed capsule     | Done                     |
| E5.4 | Scene-scoped allowlists + requests  | Done                     |
| E5.5 | AgentState/tools → world animations | Done                     |
| E5.6 | Save/restore intro progress         | Done                     |
| E5.7 | First-meeting E2E (no dialog menus) | Done (unit/protocol E2E) |

## Epic E6 sub-tasks

| Task | Title                                  | Status |
| ---- | -------------------------------------- | ------ |
| E6.1 | Egress + service identity              | Done   |
| E6.2 | Rate limits, budgets, circuit breakers | Done   |
| E6.3 | Load/voice/reconnect harness           | Done   |
| E6.4 | Retention/deletion jobs                | Done   |
| E6.5 | Observability + cost API               | Done   |
| E6.6 | Security regression suite              | Done   |
| E6.7 | Acceptance checklist                   | Done   |
| E6.8 | DoD + status (this doc)                | Done   |

## Known limitations

- `InlineJobDispatcher` runs jobs in-process — schedule `retention.hard-delete` via external cron or worker.
- Cost USD figures are estimates for observability, not billing.
- Egress allowlist does not replace cloud network policies — configure both.
- LiveKit `@livekit/rtc-node` media publish/subscribe remains a scaffold behind the data-channel queue.
- Browser Playwright E2E for the full ship scene is not required for the first cut; protocol E2E covers the intro path.

## Quick verify

```bash
pnpm check
pnpm --filter @pamagochi/voice-agent test
pnpm --filter @pamagochi/api test
pnpm --filter @pamagochi/game test
```
