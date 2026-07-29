import type { VoiceAgentEnv } from '../../config/env.schema.js';
import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

/**
 * ElevenLabs streaming TTS adapter.
 * Secrets stay on the server; browser never calls ElevenLabs.
 */
export class ElevenLabsTtsProvider implements StreamingTtsProvider {
  readonly providerId = 'elevenlabs';

  constructor(private readonly env: VoiceAgentEnv) {
    if (!env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is required for elevenlabs TTS');
    }
    if (!env.ELEVENLABS_VOICE_ID) {
      throw new Error('ELEVENLABS_VOICE_ID is required for elevenlabs TTS');
    }
  }

  get voiceId(): string {
    return this.env.ELEVENLABS_VOICE_ID!;
  }

  get modelId(): string {
    return this.env.ELEVENLABS_MODEL_ID;
  }

  startSession(): StreamingTtsSession {
    const env = this.env;
    const voiceId = this.voiceId;
    const modelId = this.modelId;
    const baseUrl = env.ELEVENLABS_BASE_URL.replace(/\/$/, '');
    const parts: string[] = [];
    let handler: ((chunk: Uint8Array) => void) | undefined;
    let interrupted = false;

    return {
      writeText(text: string) {
        if (!interrupted) parts.push(text);
      },
      async end() {
        if (interrupted) return;
        const text = parts.join('');
        if (!text) {
          handler?.(new Uint8Array());
          return;
        }

        const response = await fetch(`${baseUrl}/v1/text-to-speech/${voiceId}/stream`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'xi-api-key': env.ELEVENLABS_API_KEY!,
            accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: env.ELEVENLABS_STABILITY,
              similarity_boost: env.ELEVENLABS_SIMILARITY_BOOST,
              style: env.ELEVENLABS_STYLE,
              use_speaker_boost: env.ELEVENLABS_USE_SPEAKER_BOOST,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs request failed with status ${response.status}`);
        }

        const buffer = new Uint8Array(await response.arrayBuffer());
        handler?.(buffer);
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
