export interface VoiceUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  ttsChars: number;
  sttSeconds: number;
}

export interface VoiceMetricsSnapshot {
  sttPartialMs: number[];
  llmFirstTokenMs: number[];
  ttsFirstAudioMs: number[];
  e2eMs: number[];
  reconnects: number;
  usage: VoiceUsageSnapshot;
  errors: string[];
  turnCount: number;
  estimatedCostUsd: number;
}

/** Rough USD estimate for dashboard — not billing-grade. */
const COST_RATES = {
  inputTokenUsd: 0.000_000_14,
  outputTokenUsd: 0.000_000_28,
  ttsCharUsd: 0.000_015,
  sttSecondUsd: 0.000_43,
};

/**
 * Collects vertical-slice latency metrics without secrets or chain-of-thought.
 */
export class VoiceMetricsCollector {
  private static readonly MAX_SAMPLES = 200;
  private static readonly MAX_ERRORS = 50;

  private readonly sttPartialMs: number[] = [];
  private readonly llmFirstTokenMs: number[] = [];
  private readonly ttsFirstAudioMs: number[] = [];
  private readonly e2eMs: number[] = [];
  private reconnects = 0;
  private readonly errors: string[] = [];
  private usage: VoiceUsageSnapshot = {
    inputTokens: 0,
    outputTokens: 0,
    ttsChars: 0,
    sttSeconds: 0,
  };

  private turnStartedAtMs?: number;
  private sttStartedAtMs?: number;
  private llmStartedAtMs?: number;
  private ttsStartedAtMs?: number;

  beginTurn(): void {
    this.turnStartedAtMs = Date.now();
    this.sttStartedAtMs = Date.now();
    this.llmStartedAtMs = undefined;
    this.ttsStartedAtMs = undefined;
  }

  recordSttPartial(): void {
    if (this.sttStartedAtMs === undefined) return;
    this.pushBounded(this.sttPartialMs, Date.now() - this.sttStartedAtMs);
  }

  recordLlmFirstToken(): void {
    if (this.llmStartedAtMs !== undefined) return;
    this.llmStartedAtMs = Date.now();
    if (this.turnStartedAtMs !== undefined) {
      this.pushBounded(this.llmFirstTokenMs, this.llmStartedAtMs - this.turnStartedAtMs);
    }
  }

  recordTtsFirstAudio(): void {
    if (this.ttsStartedAtMs !== undefined) return;
    this.ttsStartedAtMs = Date.now();
    if (this.turnStartedAtMs !== undefined) {
      this.pushBounded(this.ttsFirstAudioMs, this.ttsStartedAtMs - this.turnStartedAtMs);
    }
  }

  completeTurn(): void {
    if (this.turnStartedAtMs === undefined) return;
    this.pushBounded(this.e2eMs, Date.now() - this.turnStartedAtMs);
    this.turnStartedAtMs = undefined;
  }

  recordReconnect(): void {
    this.reconnects += 1;
  }

  recordError(message: string): void {
    const safe = message.slice(0, 200);
    this.errors.push(safe);
    if (this.errors.length > VoiceMetricsCollector.MAX_ERRORS) {
      this.errors.splice(0, this.errors.length - VoiceMetricsCollector.MAX_ERRORS);
    }
  }

  addUsage(partial: Partial<VoiceUsageSnapshot>): void {
    this.usage = {
      inputTokens: this.usage.inputTokens + (partial.inputTokens ?? 0),
      outputTokens: this.usage.outputTokens + (partial.outputTokens ?? 0),
      ttsChars: this.usage.ttsChars + (partial.ttsChars ?? 0),
      sttSeconds: this.usage.sttSeconds + (partial.sttSeconds ?? 0),
    };
  }

  snapshot(): VoiceMetricsSnapshot {
    const usage = { ...this.usage };
    const estimatedCostUsd =
      usage.inputTokens * COST_RATES.inputTokenUsd +
      usage.outputTokens * COST_RATES.outputTokenUsd +
      usage.ttsChars * COST_RATES.ttsCharUsd +
      usage.sttSeconds * COST_RATES.sttSecondUsd;

    return {
      sttPartialMs: [...this.sttPartialMs],
      llmFirstTokenMs: [...this.llmFirstTokenMs],
      ttsFirstAudioMs: [...this.ttsFirstAudioMs],
      e2eMs: [...this.e2eMs],
      reconnects: this.reconnects,
      usage,
      errors: [...this.errors],
      turnCount: this.e2eMs.length,
      estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    };
  }

  private pushBounded(target: number[], value: number): void {
    target.push(value);
    if (target.length > VoiceMetricsCollector.MAX_SAMPLES) {
      target.splice(0, target.length - VoiceMetricsCollector.MAX_SAMPLES);
    }
  }
}
