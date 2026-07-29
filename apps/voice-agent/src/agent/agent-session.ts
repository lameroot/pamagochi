import type { AgentState, VoiceSessionContext } from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import {
  LlmProviderFactory,
  SttProviderFactory,
  TtsProviderFactory,
} from '../providers/factories.js';
import type {
  StreamingSttProvider,
  StreamingTtsProvider,
  ToolCallingLlm,
} from '../providers/types.js';
import type { RoomTransport } from './room-transport.js';
import { SessionContextClient } from './session-context-client.js';

export interface AgentSessionDeps {
  env: VoiceAgentEnv;
  transport: RoomTransport;
  contextClient?: SessionContextClient;
  stt?: StreamingSttProvider;
  llm?: ToolCallingLlm;
  tts?: StreamingTtsProvider;
}

/**
 * One child / one room voice runtime.
 * Forbidden capabilities (shell, filesystem, generic HTTP tools) are intentionally absent.
 */
export class AgentSession {
  private state: AgentState = 'connecting';
  private context?: VoiceSessionContext;
  private closed = false;
  private readonly stt: StreamingSttProvider;
  private readonly llm: ToolCallingLlm;
  private readonly tts: StreamingTtsProvider;
  private readonly contextClient: SessionContextClient;
  private readonly stateListeners = new Set<(state: AgentState) => void>();

  constructor(private readonly deps: AgentSessionDeps) {
    this.contextClient = deps.contextClient ?? new SessionContextClient(deps.env);
    this.stt = deps.stt ?? new SttProviderFactory(deps.env).create();
    this.llm = deps.llm ?? new LlmProviderFactory(deps.env).create();
    this.tts = deps.tts ?? new TtsProviderFactory(deps.env).create();
  }

  getAgentState(): AgentState {
    return this.state;
  }

  getContext(): VoiceSessionContext | undefined {
    return this.context;
  }

  onState(listener: (state: AgentState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async start(gameSessionId: string): Promise<void> {
    if (this.closed) throw new Error('Session already closed');
    this.setState('connecting');
    this.context = await this.contextClient.fetch(gameSessionId);
    await this.deps.transport.connect();
    this.setState('listening');

    this.deps.transport.onAudio((chunk) => {
      void this.handleAudio(chunk);
    });
  }

  /** Process one completed child utterance (used by tests and STT final events). */
  async handleFinalTranscript(text: string): Promise<string> {
    if (this.closed || !this.context) throw new Error('Session is not active');
    this.setState('thinking');

    const replyParts: string[] = [];
    for await (const chunk of this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are Pamagochi. Child age band: ${this.context.ageBand}. Language: ${this.context.primaryLanguage}. Keep replies short.`,
        },
        { role: 'user', content: text },
      ],
      maxOutputTokens: this.deps.env.VOICE_MAX_OUTPUT_TOKENS_PER_TURN,
    })) {
      if (chunk.textDelta) replyParts.push(chunk.textDelta);
    }
    const reply = replyParts.join('').trim() || 'Я рядом.';

    this.setState('speaking');
    const tts = this.tts.startSession();
    const audioChunks: Uint8Array[] = [];
    tts.onAudio((audio) => audioChunks.push(audio));
    tts.writeText(reply);
    await tts.end();
    for (const audio of audioChunks) {
      await this.deps.transport.publishAudio(audio);
    }

    this.setState('listening');
    return reply;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.deps.transport.disconnect();
    this.setState('unavailable');
  }

  private async handleAudio(chunk: Uint8Array): Promise<void> {
    if (this.closed || chunk.byteLength === 0) return;
    const session = this.stt.startSession({ language: this.context?.primaryLanguage });
    let finalText = '';
    session.onTranscript((event) => {
      if (event.isFinal) finalText = event.text;
    });
    session.writeAudio(chunk);
    await session.end();
    if (finalText.trim()) {
      await this.handleFinalTranscript(finalText.trim());
    }
  }

  private setState(state: AgentState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }
}
