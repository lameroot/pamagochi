import { describe, expect, it } from 'vitest';
import { VoiceMetricsCollector } from './metrics.js';
import {
  SessionLimits,
  createInitialUsage,
  type SessionLimitConfig,
} from '../safety/session-limits.js';

const limitConfig: SessionLimitConfig = {
  maxDurationSeconds: 3600,
  idleTimeoutSeconds: 300,
  maxTurnsPerMinute: 20,
  maxOutputTokensPerTurn: 350,
  maxTtsCharactersPerSession: 30_000,
  maxSttSecondsPerSession: 1800,
  maxConcurrentSessionsPerChild: 1,
  dailyBudgetUsdPerChild: 5,
  globalDailyBudgetUsd: 500,
};

/**
 * Simulates reconnect storms and concurrent session pressure (E6.3).
 * No LiveKit/network — pure in-process harness for limits + metrics.
 */
describe('reconnect and load harness (E6.3)', () => {
  it('tracks reconnects without duplicating turn metrics', () => {
    const metrics = new VoiceMetricsCollector();

    metrics.beginTurn();
    metrics.recordSttPartial();
    metrics.recordLlmFirstToken();
    metrics.recordReconnect();
    metrics.completeTurn();

    metrics.beginTurn();
    metrics.recordSttPartial();
    metrics.recordLlmFirstToken();
    metrics.recordTtsFirstAudio();
    metrics.completeTurn();

    const snap = metrics.snapshot();
    expect(snap.reconnects).toBe(1);
    expect(snap.e2eMs).toHaveLength(2);
    expect(snap.llmFirstTokenMs).toHaveLength(2);
  });

  it('rejects second concurrent session for same child', () => {
    const limits = new SessionLimits(limitConfig);
    const usage = createInitialUsage();

    const first = limits.checkBeforeTurn({
      childId: 'child-load',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(first.allowed).toBe(true);

    const second = limits.checkBeforeTurn({
      childId: 'child-load',
      usage,
      concurrentSessionsForChild: 2,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    expect(second.allowed).toBe(false);
    expect(second.violation).toBe('concurrent_sessions');
  });

  it('simulates burst turns under rate limit', () => {
    const limits = new SessionLimits({ ...limitConfig, maxTurnsPerMinute: 5 });
    const now = Date.now();
    const usage = {
      ...createInitialUsage(now),
      turnTimestamps: Array.from({ length: 5 }, (_, i) => now - i * 2000),
    };

    const blocked = limits.checkBeforeTurn({
      childId: 'burst-child',
      usage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
      nowMs: now,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.violation).toBe('turns_per_minute');
  });

  it('accumulates usage across reconnect cycles without unbounded growth', () => {
    const metrics = new VoiceMetricsCollector();
    const cycles = 50;

    for (let i = 0; i < cycles; i++) {
      metrics.beginTurn();
      metrics.addUsage({ inputTokens: 10, outputTokens: 20, ttsChars: 30, sttSeconds: 1 });
      if (i % 10 === 0) metrics.recordReconnect();
      metrics.completeTurn();
    }

    const snap = metrics.snapshot();
    expect(snap.e2eMs.length).toBeLessThanOrEqual(cycles);
    expect(snap.usage.inputTokens).toBe(10 * cycles);
    expect(snap.reconnects).toBe(5);
    expect(snap.errors.length).toBeLessThanOrEqual(100);
  });
});
