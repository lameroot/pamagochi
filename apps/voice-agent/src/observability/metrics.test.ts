import { describe, expect, it } from 'vitest';
import { VoiceMetricsCollector } from './metrics.js';

describe('VoiceMetricsCollector', () => {
  it('records turn latencies and usage without secrets', () => {
    const metrics = new VoiceMetricsCollector();
    metrics.beginTurn();
    metrics.recordSttPartial();
    metrics.recordLlmFirstToken();
    metrics.recordTtsFirstAudio();
    metrics.addUsage({ inputTokens: 10, outputTokens: 20, ttsChars: 30, sttSeconds: 1 });
    metrics.completeTurn();
    metrics.recordReconnect();
    metrics.recordError('connection_reset');

    const snap = metrics.snapshot();
    expect(snap.sttPartialMs).toHaveLength(1);
    expect(snap.llmFirstTokenMs).toHaveLength(1);
    expect(snap.ttsFirstAudioMs).toHaveLength(1);
    expect(snap.e2eMs).toHaveLength(1);
    expect(snap.reconnects).toBe(1);
    expect(snap.usage.inputTokens).toBe(10);
    expect(snap.errors).toEqual(['connection_reset']);
    expect(JSON.stringify(snap)).not.toMatch(/api[_-]?key|secret|password/i);
  });
});
