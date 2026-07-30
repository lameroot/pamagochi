import type { VoiceAgentEnv } from '../../config/env.schema.js';
import { egressFetch } from '../../safety/egress-fetch.js';
import type { LlmCompletionChunk, LlmMessage, ToolCallingLlm } from '../types.js';

/**
 * DeepSeek OpenAI-compatible LLM adapter.
 * Uses DEEPSEEK_* env names only (never OPENAI_*).
 */
export class DeepseekLlmProvider implements ToolCallingLlm {
  readonly providerId = 'deepseek';

  constructor(private readonly env: VoiceAgentEnv) {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is required for deepseek LLM');
    }
  }

  get model(): string {
    return this.env.DEEPSEEK_MODEL;
  }

  get baseUrl(): string {
    return this.env.DEEPSEEK_BASE_URL.replace(/\/$/, '');
  }

  async *complete(input: {
    messages: LlmMessage[];
    maxOutputTokens?: number;
  }): AsyncIterable<LlmCompletionChunk> {
    const response = await egressFetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        temperature: this.env.DEEPSEEK_TEMPERATURE,
        max_tokens: input.maxOutputTokens ?? this.env.DEEPSEEK_MAX_OUTPUT_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.env.DEEPSEEK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? '';
    if (text) yield { textDelta: text };
    yield { done: true };
  }
}
