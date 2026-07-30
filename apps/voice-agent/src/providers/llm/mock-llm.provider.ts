import type { LlmCompletionChunk, LlmMessage, ToolCallingLlm } from '../types.js';

export interface MockLlmOptions {
  /** When set, yields a character_emote tool call instead of plain text. */
  toolEmotion?: 'curious' | 'happy' | 'confused' | 'surprised' | 'calm';
  /** Optional scene event request for ship-capsule intro tests. */
  sceneEventId?: string;
}

export class MockLlmProvider implements ToolCallingLlm {
  readonly providerId = 'mock';
  readonly model = 'mock-model';

  constructor(private readonly options: MockLlmOptions = {}) {}

  async *complete(input: {
    messages: LlmMessage[];
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    maxOutputTokens?: number;
  }): AsyncIterable<LlmCompletionChunk> {
    void input.maxOutputTokens;

    if (this.options.toolEmotion && input.tools?.some((t) => t.name === 'character_emote')) {
      yield {
        toolCalls: [
          {
            id: 'mock-tool-1',
            name: 'character_emote',
            argumentsJson: JSON.stringify({ emotion: this.options.toolEmotion }),
          },
        ],
      };
      yield { done: true };
      return;
    }

    if (this.options.sceneEventId && input.tools?.some((t) => t.name === 'scene_request_event')) {
      yield {
        toolCalls: [
          {
            id: 'mock-scene-1',
            name: 'scene_request_event',
            argumentsJson: JSON.stringify({ eventId: this.options.sceneEventId }),
          },
        ],
      };
      yield { textDelta: 'Давай откроем капсулу.' };
      yield { done: true };
      return;
    }

    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const reply = lastUser?.content.includes('перебей')
      ? 'Я начал говорить, но ты перебил.'
      : 'Привет! Я рядом.';
    yield { textDelta: reply };
    yield { done: true };
  }
}
