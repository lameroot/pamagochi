import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

export class MockTtsProvider implements StreamingTtsProvider {
  readonly providerId = 'mock';
  readonly voiceId = 'mock-voice';

  startSession(): StreamingTtsSession {
    let handler: ((chunk: Uint8Array) => void) | undefined;
    let accumulated = '';
    let interrupted = false;
    let firstAudioSent = false;

    return {
      writeText(text: string) {
        accumulated += text;
      },
      async end() {
        if (!interrupted && !firstAudioSent) {
          handler?.(new Uint8Array([1, 2, 3, 4]));
          firstAudioSent = true;
        }
      },
      onAudio(next) {
        handler = next;
      },
      async interrupt() {
        interrupted = true;
      },
    };
  }
}
