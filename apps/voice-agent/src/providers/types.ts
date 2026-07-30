export type { SttConfig, LlmConfig, TtsConfig } from '@pamagochi/agent-core';

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  startedAtMs?: number;
  endedAtMs?: number;
}

export interface StreamingSttSession {
  writeAudio(chunk: Uint8Array): void;
  end(): Promise<void>;
  onTranscript(handler: (event: TranscriptEvent) => void): void;
}

export interface StreamingSttProvider {
  readonly providerId: string;
  startSession(options?: { language?: string }): StreamingSttSession;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface LlmCompletionChunk {
  textDelta?: string;
  toolCalls?: LlmToolCall[];
  done?: boolean;
}

export interface ToolCallingLlm {
  readonly providerId: string;
  readonly model: string;
  complete(input: {
    messages: LlmMessage[];
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    maxOutputTokens?: number;
  }): AsyncIterable<LlmCompletionChunk>;
}

export interface StreamingTtsSession {
  writeText(text: string): void;
  end(): Promise<void>;
  onAudio(handler: (chunk: Uint8Array) => void): void;
  interrupt(): Promise<void>;
}

export interface StreamingTtsProvider {
  readonly providerId: string;
  readonly voiceId: string;
  startSession(): StreamingTtsSession;
}
