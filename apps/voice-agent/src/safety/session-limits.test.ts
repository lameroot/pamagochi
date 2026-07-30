import { describe, expect, it } from 'vitest';
import { SessionLimits, createInitialUsage, type SessionLimitConfig } from './session-limits.js';
import { SimpleCircuitBreaker } from '@pamagochi/agent-core';

const config: SessionLimitConfig = {
  maxDurationSeconds: 60,
  idleTimeoutSeconds: 30,
  maxTurnsPerMinute: 3,
  maxOutputTokensPerTurn: 100,
  maxTtsCharactersPerSession: 500,
  maxSttSecondsPerSession: 120,
  maxConcurrentSessionsPerChild: 1,
  dailyBudgetUsdPerChild: 1,
  globalDailyBudgetUsd: 10,
};

describe('SessionLimits', () => {
  it('allows turns within limits', () => {
    const limits = new SessionLimits(config);
    const usage = createInitialUsage();
    const result = limits.checkBeforeTurn({
      childId: 'c1',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks when max duration exceeded', () => {
    const limits = new SessionLimits(config);
    const now = Date.now();
    const usage = { ...createInitialUsage(now - 120_000), lastActivityAtMs: now };
    const result = limits.checkBeforeTurn({
      childId: 'c1',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
      nowMs: now,
    });
    expect(result.violation).toBe('max_duration');
  });

  it('blocks idle timeout', () => {
    const limits = new SessionLimits({ ...config, maxDurationSeconds: 3600 });
    const now = Date.now();
    const usage = { ...createInitialUsage(now - 60_000), lastActivityAtMs: now - 40_000 };
    const result = limits.checkBeforeTurn({
      childId: 'c1',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
      nowMs: now,
    });
    expect(result.violation).toBe('idle_timeout');
  });

  it('blocks turns per minute', () => {
    const limits = new SessionLimits(config);
    const now = Date.now();
    const usage = {
      ...createInitialUsage(now),
      turnTimestamps: [now - 10_000, now - 5_000, now - 1_000],
    };
    const result = limits.checkBeforeTurn({
      childId: 'c1',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
      nowMs: now,
    });
    expect(result.violation).toBe('turns_per_minute');
  });

  it('blocks when circuit breaker is open', () => {
    const breaker = new SimpleCircuitBreaker();
    breaker.trip('provider outage');
    const limits = new SessionLimits(config, breaker);
    const result = limits.checkBeforeTurn({
      childId: 'c1',
      usage: createInitialUsage(),
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(result.violation).toBe('circuit_breaker');
  });

  it('blocks excessive output tokens after turn', () => {
    const limits = new SessionLimits(config);
    const result = limits.checkAfterTurn(
      {
        childId: 'c1',
        usage: createInitialUsage(),
        concurrentSessionsForChild: 1,
        childDailyCostUsd: 0,
        globalDailyCostUsd: 0,
      },
      { outputTokens: 200, ttsCharacters: 10, sttSeconds: 1, costUsd: 0.01 },
    );
    expect(result.violation).toBe('output_tokens');
  });
});
