import type { LlmCompletionChunk, ToolCallingLlm } from '../types.js';

export class MockLlmProvider implements ToolCallingLlm {
  readonly providerId = 'mock';
  readonly model = 'mock-model';

  async *complete(): AsyncIterable<LlmCompletionChunk> {
    yield { textDelta: 'Привет! Я рядом.' };
    yield { done: true };
  }
}
