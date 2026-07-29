import type { StreamingSttProvider, StreamingSttSession, TranscriptEvent } from '../types.js';

export class MockSttProvider implements StreamingSttProvider {
  readonly providerId = 'mock';

  startSession(): StreamingSttSession {
    let handler: ((event: TranscriptEvent) => void) | undefined;
    return {
      writeAudio() {
        /* no-op */
      },
      async end() {
        handler?.({ text: 'привет', isFinal: true });
      },
      onTranscript(next) {
        handler = next;
      },
    };
  }
}
