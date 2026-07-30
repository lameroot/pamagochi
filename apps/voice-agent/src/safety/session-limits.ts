import { SimpleCircuitBreaker, type CircuitBreaker } from '@pamagochi/agent-core';
import type { VoiceAgentEnv } from '../config/env.schema.js';

export { SimpleCircuitBreaker, type CircuitBreaker } from '@pamagochi/agent-core';

export interface SessionLimitConfig {
  maxDurationSeconds: number;
  idleTimeoutSeconds: number;
  maxTurnsPerMinute: number;
  maxOutputTokensPerTurn: number;
  maxTtsCharactersPerSession: number;
  maxSttSecondsPerSession: number;
  maxConcurrentSessionsPerChild: number;
  dailyBudgetUsdPerChild: number;
  globalDailyBudgetUsd: number;
}

export interface SessionUsage {
  startedAtMs: number;
  lastActivityAtMs: number;
  turnCount: number;
  turnTimestamps: number[];
  outputTokensUsed: number;
  ttsCharactersUsed: number;
  sttSecondsUsed: number;
  estimatedCostUsd: number;
}

export type SessionLimitViolation =
  | 'max_duration'
  | 'idle_timeout'
  | 'turns_per_minute'
  | 'output_tokens'
  | 'tts_characters'
  | 'stt_seconds'
  | 'concurrent_sessions'
  | 'daily_budget_child'
  | 'daily_budget_global'
  | 'circuit_breaker';

export interface SessionLimitCheckResult {
  allowed: boolean;
  violation: SessionLimitViolation | null;
  message: string | null;
}

export interface SessionLimitsContext {
  childId: string;
  usage: SessionUsage;
  concurrentSessionsForChild: number;
  childDailyCostUsd: number;
  globalDailyCostUsd: number;
  nowMs?: number;
}

export function sessionLimitConfigFromEnv(env: VoiceAgentEnv): SessionLimitConfig {
  return {
    maxDurationSeconds: Number(process.env.VOICE_SESSION_MAX_DURATION_SECONDS ?? 3600),
    idleTimeoutSeconds: Number(process.env.VOICE_SESSION_IDLE_TIMEOUT_SECONDS ?? 120),
    maxTurnsPerMinute: env.VOICE_MAX_TURNS_PER_MINUTE,
    maxOutputTokensPerTurn: env.VOICE_MAX_OUTPUT_TOKENS_PER_TURN,
    maxTtsCharactersPerSession: env.VOICE_MAX_TTS_CHARACTERS_PER_SESSION,
    maxSttSecondsPerSession: env.VOICE_MAX_STT_SECONDS_PER_SESSION,
    maxConcurrentSessionsPerChild: Number(process.env.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD ?? 1),
    dailyBudgetUsdPerChild: Number(process.env.VOICE_DAILY_BUDGET_USD_PER_CHILD ?? 1),
    globalDailyBudgetUsd: Number(process.env.VOICE_GLOBAL_DAILY_BUDGET_USD ?? 25),
  };
}

export function sessionLimitConfigFromApiEnv(env: {
  VOICE_SESSION_MAX_DURATION_SECONDS?: number;
  VOICE_SESSION_IDLE_TIMEOUT_SECONDS?: number;
  VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD?: number;
  VOICE_DAILY_BUDGET_USD_PER_CHILD?: number;
  VOICE_GLOBAL_DAILY_BUDGET_USD?: number;
}): Pick<
  SessionLimitConfig,
  | 'maxDurationSeconds'
  | 'idleTimeoutSeconds'
  | 'maxConcurrentSessionsPerChild'
  | 'dailyBudgetUsdPerChild'
  | 'globalDailyBudgetUsd'
> {
  return {
    maxDurationSeconds: env.VOICE_SESSION_MAX_DURATION_SECONDS ?? 3600,
    idleTimeoutSeconds: env.VOICE_SESSION_IDLE_TIMEOUT_SECONDS ?? 120,
    maxConcurrentSessionsPerChild: env.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD ?? 1,
    dailyBudgetUsdPerChild: env.VOICE_DAILY_BUDGET_USD_PER_CHILD ?? 1,
    globalDailyBudgetUsd: env.VOICE_GLOBAL_DAILY_BUDGET_USD ?? 25,
  };
}

/**
 * Enforces per-session and per-child cost/duration limits (E2.7).
 */
export class SessionLimits {
  constructor(
    private readonly config: SessionLimitConfig,
    private readonly circuitBreaker: CircuitBreaker = new SimpleCircuitBreaker(),
  ) {}

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  checkBeforeTurn(ctx: SessionLimitsContext): SessionLimitCheckResult {
    if (this.circuitBreaker.isOpen()) {
      return this.deny('circuit_breaker', 'Session paused for safety. Please try again later.');
    }

    const now = ctx.nowMs ?? Date.now();
    const elapsedSec = (now - ctx.usage.startedAtMs) / 1000;
    if (elapsedSec >= this.config.maxDurationSeconds) {
      return this.deny('max_duration', 'Session time is up for today.');
    }

    const idleSec = (now - ctx.usage.lastActivityAtMs) / 1000;
    if (idleSec >= this.config.idleTimeoutSeconds) {
      return this.deny('idle_timeout', 'Session ended due to inactivity.');
    }

    if (ctx.concurrentSessionsForChild > this.config.maxConcurrentSessionsPerChild) {
      return this.deny('concurrent_sessions', 'Another voice session is already active.');
    }

    const windowStart = now - 60_000;
    const recentTurns = ctx.usage.turnTimestamps.filter((t) => t >= windowStart);
    if (recentTurns.length >= this.config.maxTurnsPerMinute) {
      return this.deny('turns_per_minute', 'Too many turns — please wait a moment.');
    }

    if (ctx.childDailyCostUsd >= this.config.dailyBudgetUsdPerChild) {
      return this.deny('daily_budget_child', 'Daily voice budget reached.');
    }

    if (ctx.globalDailyCostUsd >= this.config.globalDailyBudgetUsd) {
      return this.deny('daily_budget_global', 'Voice service is temporarily unavailable.');
    }

    return { allowed: true, violation: null, message: null };
  }

  checkAfterTurn(
    ctx: SessionLimitsContext,
    delta: { outputTokens: number; ttsCharacters: number; sttSeconds: number; costUsd: number },
  ): SessionLimitCheckResult {
    if (delta.outputTokens > this.config.maxOutputTokensPerTurn) {
      return this.deny('output_tokens', 'Response was too long.');
    }
    if (
      ctx.usage.ttsCharactersUsed + delta.ttsCharacters >
      this.config.maxTtsCharactersPerSession
    ) {
      return this.deny('tts_characters', 'Voice limit reached for this session.');
    }
    if (ctx.usage.sttSecondsUsed + delta.sttSeconds > this.config.maxSttSecondsPerSession) {
      return this.deny('stt_seconds', 'Listening limit reached for this session.');
    }
    return { allowed: true, violation: null, message: null };
  }

  private deny(violation: SessionLimitViolation, message: string): SessionLimitCheckResult {
    return { allowed: false, violation, message };
  }
}

export function createInitialUsage(startedAtMs: number = Date.now()): SessionUsage {
  return {
    startedAtMs,
    lastActivityAtMs: startedAtMs,
    turnCount: 0,
    turnTimestamps: [],
    outputTokensUsed: 0,
    ttsCharactersUsed: 0,
    sttSecondsUsed: 0,
    estimatedCostUsd: 0,
  };
}
