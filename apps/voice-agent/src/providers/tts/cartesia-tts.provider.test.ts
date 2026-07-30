import { describe, expect, it, vi } from 'vitest';
import { parseVoiceAgentEnv } from '../../config/env.schema.js';
import { CartesiaTtsProvider } from './cartesia-tts.provider.js';

const env = parseVoiceAgentEnv({
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret',
  VOICE_STT_PROVIDER: 'mock',
  VOICE_LLM_PROVIDER: 'mock',
  VOICE_TTS_PROVIDER: 'cartesia',
  CARTESIA_API_KEY: 'cartesia-key',
  CARTESIA_VOICE_ID: 'cartesia-voice',
  VOICE_AGENT_INTERNAL_API_URL: 'http://localhost:3000/internal/agent',
  VOICE_AGENT_SERVICE_TOKEN: 'x'.repeat(32),
});

describe('CartesiaTtsProvider', () => {
  it('streams 24 kHz S16LE Russian speech through the server-only API', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3, 4])),
    ) as typeof fetch;
    try {
      const session = new CartesiaTtsProvider(env).startSession();
      const chunks: Uint8Array[] = [];
      session.onAudio((chunk) => chunks.push(chunk));
      session.writeText('Привет');
      await session.end();

      expect(chunks).toEqual([new Uint8Array([1, 2, 3, 4])]);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.cartesia.ai/tts/bytes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer cartesia-key',
            'cartesia-version': '2026-03-01',
          }),
        }),
      );
      const request = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).toEqual({
        model_id: 'sonic-3.5',
        transcript: 'Привет',
        voice: { mode: 'id', id: 'cartesia-voice' },
        language: 'ru',
        output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
