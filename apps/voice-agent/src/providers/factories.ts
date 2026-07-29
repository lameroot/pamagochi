import type { VoiceAgentEnv } from '../config/env.schema.js';
import { DeepgramSttProvider } from './stt/deepgram-stt.provider.js';
import { MockSttProvider } from './stt/mock-stt.provider.js';
import { DeepseekLlmProvider } from './llm/deepseek-llm.provider.js';
import { MockLlmProvider } from './llm/mock-llm.provider.js';
import { ElevenLabsTtsProvider } from './tts/elevenlabs-tts.provider.js';
import { MockTtsProvider } from './tts/mock-tts.provider.js';
import type { StreamingSttProvider, StreamingTtsProvider, ToolCallingLlm } from './types.js';

export class SttProviderFactory {
  constructor(private readonly env: VoiceAgentEnv) {}

  create(provider = this.env.VOICE_STT_PROVIDER): StreamingSttProvider {
    switch (provider) {
      case 'deepgram':
        return new DeepgramSttProvider(this.env);
      case 'mock':
        return new MockSttProvider();
      default:
        throw new Error(`Unsupported STT provider: ${String(provider)}`);
    }
  }
}

export class LlmProviderFactory {
  constructor(private readonly env: VoiceAgentEnv) {}

  create(provider = this.env.VOICE_LLM_PROVIDER): ToolCallingLlm {
    switch (provider) {
      case 'deepseek':
        return new DeepseekLlmProvider(this.env);
      case 'mock':
        return new MockLlmProvider();
      default:
        throw new Error(`Unsupported LLM provider: ${String(provider)}`);
    }
  }
}

export class TtsProviderFactory {
  constructor(private readonly env: VoiceAgentEnv) {}

  create(provider = this.env.VOICE_TTS_PROVIDER): StreamingTtsProvider {
    switch (provider) {
      case 'elevenlabs':
        return new ElevenLabsTtsProvider(this.env);
      case 'mock':
        return new MockTtsProvider();
      default:
        throw new Error(`Unsupported TTS provider: ${String(provider)}`);
    }
  }
}
