import type { VoiceAgentEnv } from '../../config/env.schema.js';
import type { StreamingSttProvider, StreamingSttSession, TranscriptEvent } from '../types.js';

/**
 * Deepgram streaming STT adapter.
 * Network session wiring is completed when AgentSession lands (E1.3);
 * this class owns Deepgram-specific config only.
 */
export class DeepgramSttProvider implements StreamingSttProvider {
  readonly providerId = 'deepgram';

  constructor(private readonly env: VoiceAgentEnv) {
    if (!env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is required for deepgram STT');
    }
  }

  get model(): string {
    return this.env.DEEPGRAM_MODEL;
  }

  get language(): string {
    return this.env.DEEPGRAM_LANGUAGE;
  }

  startSession(options?: { language?: string }): StreamingSttSession {
    const language = options?.language ?? this.language;
    let handler: ((event: TranscriptEvent) => void) | undefined;
    return {
      writeAudio() {
        void language;
      },
      async end() {
        handler?.({ text: '', isFinal: true });
      },
      onTranscript(next) {
        handler = next;
      },
    };
  }
}
