import { describe, expect, it } from 'vitest';
import { SessionLimitService } from './session-limit.service.js';

describe('SessionLimitService', () => {
  const service = new SessionLimitService({
    maxDurationSeconds: 60,
    idleTimeoutSeconds: 30,
    maxConcurrentSessionsPerChild: 1,
    dailyBudgetUsdPerChild: 1,
    globalDailyBudgetUsd: 10,
  });

  it('allows healthy sessions', () => {
    const now = new Date();
    const result = service.checkSession({
      childId: 'c1',
      sessionStartedAt: new Date(now.getTime() - 10_000),
      lastActivityAt: now,
      activeConversationCount: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks concurrent sessions over limit', () => {
    const now = new Date();
    const result = service.checkSession({
      childId: 'c1',
      sessionStartedAt: now,
      lastActivityAt: now,
      activeConversationCount: 2,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(result.reason).toBe('concurrent_sessions');
  });
});
