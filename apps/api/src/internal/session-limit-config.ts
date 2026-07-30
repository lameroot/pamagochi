export function sessionLimitConfigFromApiEnv(env: {
  VOICE_SESSION_MAX_DURATION_SECONDS?: number;
  VOICE_SESSION_IDLE_TIMEOUT_SECONDS?: number;
  VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD?: number;
  VOICE_DAILY_BUDGET_USD_PER_CHILD?: number;
  VOICE_GLOBAL_DAILY_BUDGET_USD?: number;
}) {
  return {
    maxDurationSeconds: env.VOICE_SESSION_MAX_DURATION_SECONDS ?? 3600,
    idleTimeoutSeconds: env.VOICE_SESSION_IDLE_TIMEOUT_SECONDS ?? 300,
    maxConcurrentSessionsPerChild: env.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD ?? 1,
    dailyBudgetUsdPerChild: env.VOICE_DAILY_BUDGET_USD_PER_CHILD ?? 5,
    globalDailyBudgetUsd: env.VOICE_GLOBAL_DAILY_BUDGET_USD ?? 500,
  };
}
