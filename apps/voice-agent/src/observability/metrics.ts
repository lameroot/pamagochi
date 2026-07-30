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
}

/**
 * Collects vertical-slice latency metrics without secrets or chain-of-thought.
 */
export class VoiceMetricsCollector {
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
    this.sttPartialMs.push(Date.now() - this.sttStartedAtMs);
  }

  recordLlmFirstToken(): void {
    if (this.llmStartedAtMs !== undefined) return;
    this.llmStartedAtMs = Date.now();
    if (this.turnStartedAtMs !== undefined) {
      this.llmFirstTokenMs.push(this.llmStartedAtMs - this.turnStartedAtMs);
    }
  }

  recordTtsFirstAudio(): void {
    if (this.ttsStartedAtMs !== undefined) return;
    this.ttsStartedAtMs = Date.now();
    if (this.turnStartedAtMs !== undefined) {
      this.ttsFirstAudioMs.push(this.ttsStartedAtMs - this.turnStartedAtMs);
    }
  }

  completeTurn(): void {
    if (this.turnStartedAtMs === undefined) return;
    this.e2eMs.push(Date.now() - this.turnStartedAtMs);
    this.turnStartedAtMs = undefined;
  }

  recordReconnect(): void {
    this.reconnects += 1;
  }

  recordError(message: string): void {
    const safe = message.slice(0, 200);
    this.errors.push(safe);
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
    return {
      sttPartialMs: [...this.sttPartialMs],
      llmFirstTokenMs: [...this.llmFirstTokenMs],
      ttsFirstAudioMs: [...this.ttsFirstAudioMs],
      e2eMs: [...this.e2eMs],
      reconnects: this.reconnects,
      usage: { ...this.usage },
      errors: [...this.errors],
    };
  }
}
