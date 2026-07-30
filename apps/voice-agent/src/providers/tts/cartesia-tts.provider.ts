import type { VoiceAgentEnv } from '../../config/env.schema.js';
import { egressFetch } from '../../safety/egress-fetch.js';
import type { StreamingTtsProvider, StreamingTtsSession } from '../types.js';

async function describeFailure(response: Response): Promise<string> {
  let detail = '';
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null) {
      const error = payload as { message?: unknown; error?: { message?: unknown } | unknown };
      detail =
        typeof error.message === 'string'
          ? error.message
          : typeof error.error === 'object' &&
              error.error !== null &&
              typeof (error.error as { message?: unknown }).message === 'string'
            ? ((error.error as { message: string }).message ?? '')
            : '';
    }
  } catch {
    // Keep the status-only error when the provider did not return JSON.
  }

  const safeDetail = detail.replace(/\s+/g, ' ').trim().slice(0, 200);
  return safeDetail
    ? `Cartesia request failed with status ${response.status}: ${safeDetail}`
    : `Cartesia request failed with status ${response.status}`;
}

/**
 * Cartesia streaming TTS adapter.
 *
 * Cartesia's bytes endpoint streams raw PCM in the HTTP response body. It is
 * deliberately used instead of its WebSocket endpoint because the current
 * StreamingTtsSession contract receives the full assistant turn before end().
 */
export class CartesiaTtsProvider implements StreamingTtsProvider {
  readonly providerId = 'cartesia';

  constructor(private readonly env: VoiceAgentEnv) {
    if (!env.CARTESIA_API_KEY) {
      throw new Error('CARTESIA_API_KEY is required for cartesia TTS');
    }
    if (!env.CARTESIA_VOICE_ID) {
      throw new Error('CARTESIA_VOICE_ID is required for cartesia TTS');
    }
  }

  get voiceId(): string {
    return this.env.CARTESIA_VOICE_ID!;
  }

  startSession(): StreamingTtsSession {
    const env = this.env;
    const voiceId = this.voiceId;
    const baseUrl = env.CARTESIA_BASE_URL.replace(/\/$/, '');
    const parts: string[] = [];
    let handler: ((chunk: Uint8Array) => void) | undefined;
    let interrupted = false;

    return {
      writeText(text: string) {
        if (!interrupted) parts.push(text);
      },
      async end() {
        if (interrupted) return;
        const transcript = parts.join('');
        if (!transcript) {
          handler?.(new Uint8Array());
          return;
        }

        const response = await egressFetch(`${baseUrl}/tts/bytes`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${env.CARTESIA_API_KEY!}`,
            'cartesia-version': env.CARTESIA_API_VERSION,
            'content-type': 'application/json',
            accept: 'audio/pcm',
          },
          body: JSON.stringify({
            model_id: env.CARTESIA_MODEL_ID,
            transcript,
            voice: { mode: 'id', id: voiceId },
            language: env.CARTESIA_LANGUAGE,
            output_format: {
              container: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: 24000,
            },
          }),
        });

        if (!response.ok) throw new Error(await describeFailure(response));
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Cartesia response has no audio body');
        try {
          while (!interrupted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.byteLength) handler?.(value);
          }
        } finally {
          if (interrupted) await reader.cancel().catch(() => undefined);
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
