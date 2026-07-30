import { describe, expect, it } from 'vitest';
import { BudgetTracker } from './budget.js';

describe('BudgetTracker', () => {
  it('blocks when child daily budget exceeded', () => {
    const tracker = new BudgetTracker({ dailyUsdPerChild: 1, globalDailyUsd: 100 });
    tracker.recordUsage('child-1', {
      inputTokens: 0,
      outputTokens: 0,
      ttsChars: 100_000,
      sttSeconds: 0,
    });
    const check = tracker.checkBefore('child-1');
    expect(check.allowed).toBe(false);
    expect(check.violation).toBe('daily_budget_child');
  });

  it('blocks when global budget exceeded', () => {
    const tracker = new BudgetTracker({ dailyUsdPerChild: 100, globalDailyUsd: 0.001 });
    tracker.recordUsage('a', {
      inputTokens: 100_000,
      outputTokens: 100_000,
      ttsChars: 50_000,
      sttSeconds: 100,
    });
    const check = tracker.checkBefore('b');
    expect(check.allowed).toBe(false);
    expect(check.violation).toBe('daily_budget_global');
  });

  it('calls persist hooks on record', async () => {
    const flushed: string[] = [];
    const tracker = new BudgetTracker(
      { dailyUsdPerChild: 5, globalDailyUsd: 500 },
      {
        flush: (scope) => {
          flushed.push(scope);
        },
      },
    );
    await tracker.recordUsage('c1', {
      inputTokens: 100,
      outputTokens: 50,
      ttsChars: 10,
      sttSeconds: 1,
    });
    expect(flushed).toEqual(['child', 'global']);
  });
});
