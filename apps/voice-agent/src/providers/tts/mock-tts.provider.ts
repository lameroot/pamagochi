import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

export class MockTtsProvider implements StreamingTtsProvider {
  readonly providerId = 'mock';
  readonly voiceId = 'mock-voice';

  startSession(): StreamingTtsSession {
    let handler: ((chunk: Uint8Array) => void) | undefined;
    return {
      writeText() {
        /* accumulate in real adapters */
      },
      async end() {
        handler?.(new Uint8Array([1, 2, 3, 4]));
      },
      onAudio(next) {
        handler = next;
      },
      async interrupt() {
        /* stop playback path */
      },
    };
  }
}
