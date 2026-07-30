/** Rough USD rates for observability — not billing-grade. */
export const DEFAULT_USAGE_RATES = {
  inputTokenUsd: 0.000_000_14,
  outputTokenUsd: 0.000_000_28,
  ttsCharUsd: 0.000_015,
  sttSecondUsd: 0.000_43,
} as const;

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  ttsChars: number;
  sttSeconds: number;
}

export interface BudgetLimits {
  dailyUsdPerChild: number;
  globalDailyUsd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  childRemainingUsd: number;
  globalRemainingUsd: number;
  violation: 'daily_budget_child' | 'daily_budget_global' | null;
}

export interface BudgetPersistHook {
  flush?(scope: 'child' | 'global', spentUsd: number): Promise<void> | void;
  loadChildDailyUsd?(childId: string): Promise<number> | number;
  loadGlobalDailyUsd?(): Promise<number> | number;
}

/**
 * Atomic-ish in-memory budget tracker with optional DB hooks (E6.2).
 * Single-process only; multi-instance deployments should rely on DB hooks.
 */
export class BudgetTracker {
  private readonly childSpend = new Map<string, number>();
  private globalSpend = 0;
  private readonly dayKey: string;

  constructor(
    private readonly limits: BudgetLimits,
    private readonly hooks: BudgetPersistHook = {},
    dayKey: string = new Date().toISOString().slice(0, 10),
  ) {
    this.dayKey = dayKey;
  }

  getChildSpend(childId: string): number {
    return this.childSpend.get(`${this.dayKey}:${childId}`) ?? 0;
  }

  getGlobalSpend(): number {
    return this.globalSpend;
  }

  estimateCostUsd(usage: UsageTotals, rates = DEFAULT_USAGE_RATES): number {
    return (
      usage.inputTokens * rates.inputTokenUsd +
      usage.outputTokens * rates.outputTokenUsd +
      usage.ttsChars * rates.ttsCharUsd +
      usage.sttSeconds * rates.sttSecondUsd
    );
  }

  checkBefore(childId: string): BudgetCheckResult {
    const childSpent = this.getChildSpend(childId);
    const childRemaining = Math.max(0, this.limits.dailyUsdPerChild - childSpent);
    const globalRemaining = Math.max(0, this.limits.globalDailyUsd - this.globalSpend);

    if (childSpent >= this.limits.dailyUsdPerChild) {
      return {
        allowed: false,
        childRemainingUsd: childRemaining,
        globalRemainingUsd: globalRemaining,
        violation: 'daily_budget_child',
      };
    }
    if (this.globalSpend >= this.limits.globalDailyUsd) {
      return {
        allowed: false,
        childRemainingUsd: childRemaining,
        globalRemainingUsd: globalRemaining,
        violation: 'daily_budget_global',
      };
    }
    return {
      allowed: true,
      childRemainingUsd: childRemaining,
      globalRemainingUsd: globalRemaining,
      violation: null,
    };
  }

  async recordUsage(childId: string, usage: UsageTotals): Promise<number> {
    const costUsd = this.estimateCostUsd(usage);
    const key = `${this.dayKey}:${childId}`;
    const nextChild = (this.childSpend.get(key) ?? 0) + costUsd;
    this.childSpend.set(key, nextChild);
    this.globalSpend += costUsd;
    await this.hooks.flush?.('child', costUsd);
    await this.hooks.flush?.('global', costUsd);
    return costUsd;
  }

  async hydrateFromStore(childId: string): Promise<void> {
    if (this.hooks.loadChildDailyUsd) {
      const spent = await this.hooks.loadChildDailyUsd(childId);
      this.childSpend.set(`${this.dayKey}:${childId}`, spent);
    }
    if (this.hooks.loadGlobalDailyUsd) {
      this.globalSpend = await this.hooks.loadGlobalDailyUsd();
    }
  }
}
