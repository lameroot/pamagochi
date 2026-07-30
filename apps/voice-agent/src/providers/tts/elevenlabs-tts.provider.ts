import type { VoiceAgentEnv } from '../../config/env.schema.js';
import { egressFetch } from '../../safety/egress-fetch.js';
import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

async function describeFailure(response: Response): Promise<string> {
  let detail = '';

  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null) {
      const error = payload as {
        detail?: { status?: unknown; message?: unknown } | unknown;
        message?: unknown;
      };
      if (typeof error.detail === 'object' && error.detail !== null) {
        const providerDetail = error.detail as { status?: unknown; message?: unknown };
        detail = [providerDetail.status, providerDetail.message]
          .filter((value): value is string => typeof value === 'string')
          .join(': ');
      } else if (typeof error.detail === 'string') {
        detail = error.detail;
      } else if (typeof error.message === 'string') {
        detail = error.message;
      }
    }
  } catch {
    // Keep the status-only error when the provider did not return JSON.
  }

  const safeDetail = detail.replace(/\s+/g, ' ').trim().slice(0, 200);
  return safeDetail
    ? `ElevenLabs request failed with status ${response.status}: ${safeDetail}`
    : `ElevenLabs request failed with status ${response.status}`;
}

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

        // LiveKit's server SDK accepts PCM frames. Requesting MP3 here made
        // playback impossible without a decoder and added avoidable latency.
        const response = await egressFetch(
          `${baseUrl}/v1/text-to-speech/${voiceId}/stream?output_format=pcm_24000`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'xi-api-key': env.ELEVENLABS_API_KEY!,
              accept: 'audio/pcm',
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
          },
        );

        if (!response.ok) {
          throw new Error(await describeFailure(response));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('ElevenLabs response has no audio body');
        try {
          while (!interrupted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.byteLength) handler?.(value);
          }
        } finally {
          if (interrupted) await reader.cancel();
          reader.releaseLock();
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
