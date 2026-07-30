import { describe, expect, it } from 'vitest';
import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

/** TTS session that blocks until interrupt() or release() — for barge-in tests. */
class SlowTtsSession implements StreamingTtsSession {
  private handler?: (chunk: Uint8Array) => void;
  private released = false;
  private interrupted = false;
  private text = '';

  writeText(text: string): void {
    this.text += text;
  }

  async end(): Promise<void> {
    this.handler?.(new Uint8Array([1, 2, 3]));
    while (!this.released && !this.interrupted) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  onAudio(handler: (chunk: Uint8Array) => void): void {
    this.handler = handler;
  }

  async interrupt(): Promise<void> {
    this.interrupted = true;
    this.released = true;
  }

  getPlayedTextLength(): number {
    return Math.floor(this.text.length * 0.4);
  }
}

export class SlowMockTtsProvider implements StreamingTtsProvider {
  readonly providerId = 'mock-slow';
  readonly voiceId = 'mock-voice';

  startSession(): StreamingTtsSession {
    return new SlowTtsSession();
  }
}
