import { describe, expect, it } from 'vitest';
import { parseVoiceAgentEnv } from './env.schema.js';

const base = {
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret',
  LIVEKIT_AGENT_NAME: 'pamagochi-voice-agent',
  VOICE_STT_PROVIDER: 'deepgram',
  VOICE_LLM_PROVIDER: 'deepseek',
  VOICE_TTS_PROVIDER: 'elevenlabs',
  DEEPGRAM_API_KEY: 'dg',
  DEEPSEEK_API_KEY: 'ds',
  ELEVENLABS_API_KEY: 'el',
  ELEVENLABS_VOICE_ID: 'voice',
  VOICE_AGENT_INTERNAL_API_URL: 'http://localhost:3000/internal/agent',
  VOICE_AGENT_SERVICE_TOKEN: 'x'.repeat(32),
};

describe('parseVoiceAgentEnv', () => {
  it('accepts a complete configuration', () => {
    const env = parseVoiceAgentEnv(base);
    expect(env.VOICE_STT_PROVIDER).toBe('deepgram');
    expect(env.DEEPSEEK_MAX_OUTPUT_TOKENS).toBe(350);
  });

  it('rejects missing active provider key without leaking the key value', () => {
    try {
      parseVoiceAgentEnv({ ...base, DEEPGRAM_API_KEY: undefined });
      throw new Error('expected throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/DEEPGRAM_API_KEY/);
      expect(message).not.toMatch(/dg/);
    }
  });

  it('rejects AUDIO_RECORDING_ENABLED=true at this stage', () => {
    expect(() => parseVoiceAgentEnv({ ...base, AUDIO_RECORDING_ENABLED: 'true' })).toThrow(
      /AUDIO_RECORDING_ENABLED/,
    );
  });

  it('rejects non-websocket LIVEKIT_URL', () => {
    expect(() =>
      parseVoiceAgentEnv({ ...base, LIVEKIT_URL: 'https://example.livekit.cloud' }),
    ).toThrow(/LIVEKIT_URL/);
  });

  it('allows mock providers without vendor keys', () => {
    const env = parseVoiceAgentEnv({
      ...base,
      VOICE_STT_PROVIDER: 'mock',
      VOICE_LLM_PROVIDER: 'mock',
      VOICE_TTS_PROVIDER: 'mock',
      DEEPGRAM_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      ELEVENLABS_API_KEY: undefined,
      ELEVENLABS_VOICE_ID: undefined,
    });
    expect(env.VOICE_TTS_PROVIDER).toBe('mock');
  });

  it('requires only Cartesia credentials when Cartesia TTS is selected', () => {
    const env = parseVoiceAgentEnv({
      ...base,
      VOICE_TTS_PROVIDER: 'cartesia',
      ELEVENLABS_API_KEY: undefined,
      ELEVENLABS_VOICE_ID: undefined,
      CARTESIA_API_KEY: 'cartesia-key',
      CARTESIA_VOICE_ID: 'voice-id',
    });
    expect(env.CARTESIA_LANGUAGE).toBe('ru');
    expect(env.CARTESIA_MODEL_ID).toBe('sonic-3.5');
  });

  it('rejects a Cartesia configuration without its active credentials', () => {
    expect(() =>
      parseVoiceAgentEnv({
        ...base,
        VOICE_TTS_PROVIDER: 'cartesia',
        CARTESIA_API_KEY: undefined,
        CARTESIA_VOICE_ID: undefined,
      }),
    ).toThrow(/CARTESIA_API_KEY.*CARTESIA_VOICE_ID/);
  });
});
