import { Injectable } from '@nestjs/common';
import { sessionLimitConfigFromApiEnv } from './session-limit-config.js';

export interface ApiSessionLimitCheckInput {
  childId: string;
  sessionStartedAt: Date;
  lastActivityAt: Date;
  activeConversationCount: number;
  childDailyCostUsd: number;
  globalDailyCostUsd: number;
}

export interface ApiSessionLimitCheckResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Server-side session limit checks using env limits from api schema (E2.7).
 */
@Injectable()
export class SessionLimitService {
  constructor(private readonly env: ReturnType<typeof sessionLimitConfigFromApiEnv>) {}

  checkSession(input: ApiSessionLimitCheckInput): ApiSessionLimitCheckResult {
    const now = Date.now();
    const maxDurationMs = this.env.maxDurationSeconds * 1000;
    const idleMs = this.env.idleTimeoutSeconds * 1000;

    if (now - input.sessionStartedAt.getTime() >= maxDurationMs) {
      return { allowed: false, reason: 'max_duration' };
    }
    if (now - input.lastActivityAt.getTime() >= idleMs) {
      return { allowed: false, reason: 'idle_timeout' };
    }
    if (input.activeConversationCount > this.env.maxConcurrentSessionsPerChild) {
      return { allowed: false, reason: 'concurrent_sessions' };
    }
    if (input.childDailyCostUsd >= this.env.dailyBudgetUsdPerChild) {
      return { allowed: false, reason: 'daily_budget_child' };
    }
    if (input.globalDailyCostUsd >= this.env.globalDailyBudgetUsd) {
      return { allowed: false, reason: 'daily_budget_global' };
    }
    return { allowed: true, reason: null };
  }
}

export function createSessionLimitServiceFromProcessEnv(
  source: NodeJS.ProcessEnv,
): SessionLimitService {
  return new SessionLimitService(
    sessionLimitConfigFromApiEnv({
      VOICE_SESSION_MAX_DURATION_SECONDS: source.VOICE_SESSION_MAX_DURATION_SECONDS
        ? Number(source.VOICE_SESSION_MAX_DURATION_SECONDS)
        : undefined,
      VOICE_SESSION_IDLE_TIMEOUT_SECONDS: source.VOICE_SESSION_IDLE_TIMEOUT_SECONDS
        ? Number(source.VOICE_SESSION_IDLE_TIMEOUT_SECONDS)
        : undefined,
      VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD: source.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD
        ? Number(source.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD)
        : undefined,
      VOICE_DAILY_BUDGET_USD_PER_CHILD: source.VOICE_DAILY_BUDGET_USD_PER_CHILD
        ? Number(source.VOICE_DAILY_BUDGET_USD_PER_CHILD)
        : undefined,
      VOICE_GLOBAL_DAILY_BUDGET_USD: source.VOICE_GLOBAL_DAILY_BUDGET_USD
        ? Number(source.VOICE_GLOBAL_DAILY_BUDGET_USD)
        : undefined,
    }),
  );
}

// Avoid circular import — thin re-export wrapper for voice-agent shared shape
export { sessionLimitConfigFromApiEnv } from './session-limit-config.js';
