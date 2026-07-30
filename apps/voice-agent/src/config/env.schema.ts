import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === 'true');

const providerSelectorSchema = z.enum(['deepgram', 'deepseek', 'elevenlabs', 'mock']);

/**
 * Strict startup schema for apps/voice-agent.
 * Secrets must never appear in thrown error messages.
 */
export const VoiceAgentEnvSchema = z
  .object({
    NODE_ENV: z.string().default('development'),

    LIVEKIT_URL: z.string().url(),
    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    LIVEKIT_AGENT_NAME: z.string().min(1).default('pamagochi-voice-agent'),

    VOICE_STT_PROVIDER: z.enum(['deepgram', 'mock']).default('deepgram'),
    VOICE_LLM_PROVIDER: z.enum(['deepseek', 'mock']).default('deepseek'),
    VOICE_TTS_PROVIDER: z.enum(['cartesia', 'elevenlabs', 'mock']).default('elevenlabs'),

    DEEPGRAM_API_KEY: z.string().optional(),
    DEEPGRAM_BASE_URL: z.string().url().default('https://api.deepgram.com'),
    DEEPGRAM_MODEL: z.string().default('nova-3'),
    DEEPGRAM_LANGUAGE: z.string().default('ru'),
    DEEPGRAM_SMART_FORMAT: booleanFromString.default(true),
    DEEPGRAM_INTERIM_RESULTS: booleanFromString.default(true),
    DEEPGRAM_ENDPOINTING_MS: z.coerce.number().int().positive().default(300),
    DEEPGRAM_UTTERANCE_END_MS: z.coerce.number().int().positive().default(1000),

    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
    DEEPSEEK_API_KEY: z.string().optional(),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    DEEPSEEK_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.65),
    DEEPSEEK_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(350),
    DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    DEEPSEEK_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),

    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_BASE_URL: z.string().url().default('https://api.elevenlabs.io'),
    ELEVENLABS_VOICE_ID: z.string().optional(),
    ELEVENLABS_MODEL_ID: z.string().default('eleven_flash_v2_5'),
    ELEVENLABS_STABILITY: z.coerce.number().min(0).max(1).default(0.45),
    ELEVENLABS_SIMILARITY_BOOST: z.coerce.number().min(0).max(1).default(0.75),
    ELEVENLABS_STYLE: z.coerce.number().min(0).max(1).default(0.2),
    ELEVENLABS_USE_SPEAKER_BOOST: booleanFromString.default(true),

    CARTESIA_API_KEY: z.string().optional(),
    CARTESIA_BASE_URL: z.string().url().default('https://api.cartesia.ai'),
    CARTESIA_API_VERSION: z.string().min(1).default('2026-03-01'),
    CARTESIA_VOICE_ID: z.string().optional(),
    CARTESIA_MODEL_ID: z.string().min(1).default('sonic-3.5'),
    CARTESIA_LANGUAGE: z.string().length(2).default('ru'),

    VOICE_AGENT_INTERNAL_API_URL: z.string().url(),
    VOICE_AGENT_SERVICE_TOKEN: z.string().min(32),

    PAMAGOCHI_SOUL_VERSION: z.string().min(1).default('0.1.0'),
    PAMAGOCHI_SAFETY_POLICY_VERSION: z.string().min(1).default('0.1.0'),

    AUDIO_RECORDING_ENABLED: booleanFromString.default(false),

    VOICE_MAX_TURNS_PER_MINUTE: z.coerce.number().int().positive().default(20),
    VOICE_MAX_OUTPUT_TOKENS_PER_TURN: z.coerce.number().int().positive().default(350),
    VOICE_MAX_TTS_CHARACTERS_PER_SESSION: z.coerce.number().int().positive().default(30000),
    VOICE_MAX_STT_SECONDS_PER_SESSION: z.coerce.number().int().positive().default(1800),
  })
  .superRefine((env, ctx) => {
    if (!env.LIVEKIT_URL.startsWith('ws')) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_URL'],
        message: 'must use ws:// or wss://',
      });
    }

    if (env.VOICE_STT_PROVIDER === 'deepgram' && !env.DEEPGRAM_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEEPGRAM_API_KEY'],
        message: 'required when VOICE_STT_PROVIDER=deepgram',
      });
    }
    if (env.VOICE_LLM_PROVIDER === 'deepseek' && !env.DEEPSEEK_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEEPSEEK_API_KEY'],
        message: 'required when VOICE_LLM_PROVIDER=deepseek',
      });
    }
    if (env.VOICE_TTS_PROVIDER === 'elevenlabs') {
      if (!env.ELEVENLABS_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['ELEVENLABS_API_KEY'],
          message: 'required when VOICE_TTS_PROVIDER=elevenlabs',
        });
      }
      if (!env.ELEVENLABS_VOICE_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['ELEVENLABS_VOICE_ID'],
          message: 'required when VOICE_TTS_PROVIDER=elevenlabs',
        });
      }
    }
    if (env.VOICE_TTS_PROVIDER === 'cartesia') {
      if (!env.CARTESIA_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['CARTESIA_API_KEY'],
          message: 'required when VOICE_TTS_PROVIDER=cartesia',
        });
      }
      if (!env.CARTESIA_VOICE_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['CARTESIA_VOICE_ID'],
          message: 'required when VOICE_TTS_PROVIDER=cartesia',
        });
      }
    }

    if (env.AUDIO_RECORDING_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUDIO_RECORDING_ENABLED'],
        message: 'cannot be true until consent plumbing is configured; keep false for this stage',
      });
    }

    void providerSelectorSchema;
  });

export type VoiceAgentEnv = z.infer<typeof VoiceAgentEnvSchema>;

export class VoiceAgentEnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid voice-agent environment: ${issues.join('; ')}`);
    this.name = 'VoiceAgentEnvError';
  }
}

/** Parse env without echoing secret values. */
export function parseVoiceAgentEnv(source: NodeJS.ProcessEnv): VoiceAgentEnv {
  const result = VoiceAgentEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)';
      return `${path}: ${issue.message}`;
    });
    throw new VoiceAgentEnvError(issues);
  }
  return result.data;
}
