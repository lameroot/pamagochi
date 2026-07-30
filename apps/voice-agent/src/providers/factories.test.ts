import { describe, expect, it } from 'vitest';
import { parseVoiceAgentEnv } from '../config/env.schema.js';
import { LlmProviderFactory, SttProviderFactory, TtsProviderFactory } from './factories.js';

const baseProcessEnv = {
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret',
  VOICE_STT_PROVIDER: 'mock',
  VOICE_LLM_PROVIDER: 'mock',
  VOICE_TTS_PROVIDER: 'mock',
  VOICE_AGENT_INTERNAL_API_URL: 'http://localhost:3000/internal/agent',
  VOICE_AGENT_SERVICE_TOKEN: 'x'.repeat(32),
};

describe('provider factories', () => {
  it('creates providers from canonical selectors', () => {
    const env = parseVoiceAgentEnv(baseProcessEnv);
    const stt = new SttProviderFactory(env).create();
    const llm = new LlmProviderFactory(env).create();
    const tts = new TtsProviderFactory(env).create();
    expect(stt.providerId).toBe('mock');
    expect(llm.providerId).toBe('mock');
    expect(tts.providerId).toBe('mock');
  });

  it('switches Deepgram/DeepSeek/ElevenLabs by configuration', () => {
    const env = parseVoiceAgentEnv({
      ...baseProcessEnv,
      VOICE_STT_PROVIDER: 'deepgram',
      VOICE_LLM_PROVIDER: 'deepseek',
      VOICE_TTS_PROVIDER: 'elevenlabs',
      DEEPGRAM_API_KEY: 'dg',
      DEEPSEEK_API_KEY: 'ds',
      ELEVENLABS_API_KEY: 'el',
      ELEVENLABS_VOICE_ID: 'voice-1',
      DEEPSEEK_MODEL: 'deepseek-chat',
      ELEVENLABS_MODEL_ID: 'eleven_flash_v2_5',
    });

    const stt = new SttProviderFactory(env).create('deepgram');
    const llm = new LlmProviderFactory(env).create('deepseek');
    const tts = new TtsProviderFactory(env).create('elevenlabs');

    expect(stt.providerId).toBe('deepgram');
    expect(llm.providerId).toBe('deepseek');
    expect(llm.model).toBe('deepseek-chat');
    expect(tts.providerId).toBe('elevenlabs');
    expect(tts.voiceId).toBe('voice-1');
  });

  it('keeps mock STT contract usable without network', async () => {
    const env = parseVoiceAgentEnv(baseProcessEnv);
    const stt = new SttProviderFactory(env).create('mock');
    const session = stt.startSession();
    const events: string[] = [];
    session.onTranscript((event) => events.push(event.text));
    await session.end();
    expect(events).toEqual(['привет']);
  });

  it('creates Cartesia TTS with the configured voice', () => {
    const env = parseVoiceAgentEnv({
      ...baseProcessEnv,
      VOICE_TTS_PROVIDER: 'cartesia',
      CARTESIA_API_KEY: 'cartesia-key',
      CARTESIA_VOICE_ID: 'cartesia-voice',
    });

    const tts = new TtsProviderFactory(env).create();
    expect(tts.providerId).toBe('cartesia');
    expect(tts.voiceId).toBe('cartesia-voice');
  });
});
