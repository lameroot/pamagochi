export interface CircuitBreakerState {
  tripped: boolean;
  reason: string | null;
  trippedAtMs: number | null;
  failureCount: number;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before tripping (default 5). */
  failureThreshold?: number;
  /** Auto-reset after this many ms (default 60_000, 0 = manual only). */
  resetAfterMs?: number;
}

export interface CircuitBreaker {
  readonly state: CircuitBreakerState;
  recordSuccess(): void;
  recordFailure(reason: string): void;
  trip(reason: string): void;
  reset(): void;
  isOpen(nowMs?: number): boolean;
}

/**
 * In-process circuit breaker for provider outages or cost spikes (E6.2).
 */
export class SimpleCircuitBreaker implements CircuitBreaker {
  state: CircuitBreakerState = {
    tripped: false,
    reason: null,
    trippedAtMs: null,
    failureCount: 0,
  };

  constructor(private readonly options: CircuitBreakerOptions = {}) {}

  recordSuccess(): void {
    this.state.failureCount = 0;
  }

  recordFailure(reason: string): void {
    const threshold = this.options.failureThreshold ?? 5;
    this.state.failureCount += 1;
    if (this.state.failureCount >= threshold) {
      this.trip(reason);
    }
  }

  trip(reason: string): void {
    this.state = {
      tripped: true,
      reason,
      trippedAtMs: Date.now(),
      failureCount: this.state.failureCount,
    };
  }

  reset(): void {
    this.state = { tripped: false, reason: null, trippedAtMs: null, failureCount: 0 };
  }

  isOpen(nowMs: number = Date.now()): boolean {
    if (!this.state.tripped) return false;
    const resetAfter = this.options.resetAfterMs ?? 60_000;
    if (resetAfter > 0 && this.state.trippedAtMs !== null) {
      if (nowMs - this.state.trippedAtMs >= resetAfter) {
        this.reset();
        return false;
      }
    }
    return true;
  }
}
