import { describe, expect, it, vi } from 'vitest';
import { SimpleCircuitBreaker } from './circuit-breaker.js';

describe('SimpleCircuitBreaker', () => {
  it('trips after failure threshold', () => {
    const breaker = new SimpleCircuitBreaker({ failureThreshold: 3 });
    breaker.recordFailure('timeout');
    breaker.recordFailure('timeout');
    expect(breaker.isOpen()).toBe(false);
    breaker.recordFailure('timeout');
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.state.reason).toBe('timeout');
  });

  it('resets on success before threshold', () => {
    const breaker = new SimpleCircuitBreaker({ failureThreshold: 3 });
    breaker.recordFailure('err');
    breaker.recordFailure('err');
    breaker.recordSuccess();
    breaker.recordFailure('err');
    expect(breaker.isOpen()).toBe(false);
  });

  it('auto-resets after resetAfterMs', () => {
    vi.useFakeTimers();
    const breaker = new SimpleCircuitBreaker({ resetAfterMs: 1000 });
    breaker.trip('outage');
    expect(breaker.isOpen()).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(breaker.isOpen()).toBe(false);
    vi.useRealTimers();
  });
});
