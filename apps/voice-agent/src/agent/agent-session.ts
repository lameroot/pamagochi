import {
  characterEmotionSchema,
  type AgentState,
  type CharacterEmotion,
  type VoiceSessionContext,
} from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import { VoiceMetricsCollector } from '../observability/metrics.js';
import {
  LlmProviderFactory,
  SttProviderFactory,
  TtsProviderFactory,
} from '../providers/factories.js';
import type {
  StreamingSttProvider,
  StreamingTtsProvider,
  StreamingTtsSession,
  ToolCallingLlm,
} from '../providers/types.js';
import { BargeInTracker } from './barge-in.js';
import type { RoomTransport } from './room-transport.js';
import { SessionContextClient } from './session-context-client.js';
import { TranscriptClient } from './transcript-client.js';
import { ToolInvokeClient } from './tool-invoke-client.js';
import type { AgentSafetyHooks } from '../safety/turn-pipeline.js';
import { runInputPipeline, runOutputPipeline } from '../safety/turn-pipeline.js';

export interface AgentSessionDeps {
  env: VoiceAgentEnv;
  transport: RoomTransport;
  contextClient?: SessionContextClient;
  transcriptClient?: TranscriptClient;
  toolClient?: ToolInvokeClient;
  stt?: StreamingSttProvider;
  llm?: ToolCallingLlm;
  tts?: StreamingTtsProvider;
  metrics?: VoiceMetricsCollector;
  sceneKey?: string;
  safetyHooks?: AgentSafetyHooks;
}

/**
 * One child / one room voice runtime.
 * Forbidden capabilities (shell, filesystem, generic HTTP tools) are intentionally absent.
 */
export class AgentSession {
  private state: AgentState = 'connecting';
  private context?: VoiceSessionContext;
  private closed = false;
  private turnSequence = 0;
  private readonly stt: StreamingSttProvider;
  private readonly llm: ToolCallingLlm;
  private readonly tts: StreamingTtsProvider;
  private readonly contextClient: SessionContextClient;
  private readonly transcriptClient: TranscriptClient;
  private readonly toolClient: ToolInvokeClient;
  private readonly metrics: VoiceMetricsCollector;
  private readonly bargeIn = new BargeInTracker();
  private readonly sceneKey: string;
  private readonly safetyHooks?: AgentSafetyHooks;
  private activeTts?: StreamingTtsSession;
  private readonly stateListeners = new Set<(state: AgentState) => void>();

  constructor(private readonly deps: AgentSessionDeps) {
    this.contextClient = deps.contextClient ?? new SessionContextClient(deps.env);
    this.transcriptClient = deps.transcriptClient ?? new TranscriptClient(deps.env);
    this.toolClient = deps.toolClient ?? new ToolInvokeClient(deps.env);
    this.metrics = deps.metrics ?? new VoiceMetricsCollector();
    this.sceneKey = deps.sceneKey ?? 'talking-light';
    this.safetyHooks = deps.safetyHooks;
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

  getMetrics(): ReturnType<VoiceMetricsCollector['snapshot']> {
    return this.metrics.snapshot();
  }

  onState(listener: (state: AgentState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async start(gameSessionId: string): Promise<void> {
    if (this.closed) throw new Error('Session already closed');
    await this.setState('connecting');
    this.context = await this.contextClient.fetch(gameSessionId);
    await this.deps.transport.connect();
    await this.setState('listening');

    this.deps.transport.onAudio((chunk) => {
      void this.handleAudio(chunk);
    });
  }

  /** Process one completed child utterance (used by tests and STT final events). */
  async handleFinalTranscript(text: string): Promise<string> {
    if (this.closed || !this.context) throw new Error('Session is not active');

    if (this.bargeIn.getIsSpeaking()) {
      await this.interruptSpeaking();
    }

    this.metrics.beginTurn();
    const childStartedAt = new Date().toISOString();
    const childSeq = this.turnSequence++;

    await this.setState('thinking');

    const pipeline = await runInputPipeline(this.safetyHooks, {
      context: this.context,
      userText: text,
      turnId: `turn-${childSeq}`,
    });

    if (!pipeline.proceed) {
      const refusal = pipeline.refusalLine ?? 'Я рядом.';
      const agentReply = await this.speakReply(refusal);
      this.metrics.completeTurn();
      await this.setState('listening');
      return agentReply.heardText;
    }

    const replyParts: string[] = [];
    let sawFirstToken = false;
    const toolCalls: Array<{ id: string; name: string; argumentsJson: string }> = [];

    const systemContent =
      pipeline.systemPrompt ??
      `You are Pamagochi. Child age band: ${this.context.ageBand}. Language: ${this.context.primaryLanguage}. Keep replies short.`;

    for await (const chunk of this.llm.complete({
      messages: [
        {
          role: 'system',
          content: systemContent,
        },
        { role: 'user', content: pipeline.userText },
      ],
      tools: [
        {
          name: 'character_emote',
          description: 'Express an emotion visually',
          parameters: { type: 'object', properties: { emotion: { type: 'string' } } },
        },
      ],
      maxOutputTokens: this.deps.env.VOICE_MAX_OUTPUT_TOKENS_PER_TURN,
    })) {
      if (chunk.textDelta) {
        if (!sawFirstToken) {
          sawFirstToken = true;
          this.metrics.recordLlmFirstToken();
        }
        replyParts.push(chunk.textDelta);
      }
      if (chunk.toolCalls) {
        if (!sawFirstToken) {
          sawFirstToken = true;
          this.metrics.recordLlmFirstToken();
        }
        toolCalls.push(...chunk.toolCalls);
      }
    }

    for (const call of toolCalls) {
      if (call.name !== 'character_emote') continue;
      try {
        const args = JSON.parse(call.argumentsJson) as { emotion?: string };
        const emotion: CharacterEmotion = characterEmotionSchema.parse(args.emotion ?? 'calm');
        const result = await this.toolClient.invoke(
          this.context.conversationSessionId,
          this.sceneKey,
          {
            name: 'character_emote',
            callId: call.id,
            arguments: { emotion },
          },
        );
        await this.deps.transport.publishToolResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'tool_invoke_failed';
        this.metrics.recordError(message);
      }
    }

    const reply = replyParts.join('').trim() || 'Я рядом.';
    const safeReply = await runOutputPipeline(this.safetyHooks, {
      context: this.context,
      userText: text,
      agentText: reply,
      turnId: `turn-${childSeq}`,
    });
    this.metrics.addUsage({ outputTokens: safeReply.length, inputTokens: text.length });

    await this.persistTurn({
      idempotencyKey: `child-${childSeq}`,
      sequenceNo: childSeq,
      speaker: 'child',
      text,
      startedAt: childStartedAt,
      endedAt: new Date().toISOString(),
    });

    const agentReply = await this.speakReply(safeReply);
    const agentSeq = this.turnSequence++;

    await this.persistTurn({
      idempotencyKey: `agent-${agentSeq}`,
      sequenceNo: agentSeq,
      speaker: 'agent',
      text: agentReply.heardText,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      wasInterrupted: agentReply.wasInterrupted,
      playedTextLength: agentReply.playedTextLength,
    });

    this.metrics.completeTurn();
    await this.setState('listening');
    return agentReply.heardText;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.context) {
      try {
        await this.transcriptClient.finalize(this.context.conversationSessionId, {
          status: 'completed',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'finalize_failed';
        this.metrics.recordError(message);
      }
    }
    await this.deps.transport.disconnect();
    await this.setState('unavailable');
  }

  private async handleAudio(chunk: Uint8Array): Promise<void> {
    if (this.closed || chunk.byteLength === 0) return;

    if (this.bargeIn.getIsSpeaking()) {
      await this.interruptSpeaking();
    }

    this.metrics.recordSttPartial();
    const session = this.stt.startSession({ language: this.context?.primaryLanguage });
    let finalText = '';
    session.onTranscript((event) => {
      if (event.isFinal) finalText = event.text;
    });
    session.writeAudio(chunk);
    await session.end();
    this.metrics.addUsage({ sttSeconds: 1 });

    if (finalText.trim()) {
      await this.handleFinalTranscript(finalText.trim());
    }
  }

  private async speakReply(reply: string): Promise<{
    wasInterrupted: boolean;
    playedTextLength: number;
    heardText: string;
  }> {
    await this.setState('speaking');
    this.bargeIn.beginSpeaking(reply);
    const tts = this.tts.startSession();
    this.activeTts = tts;

    let firstAudio = false;
    tts.onAudio((audio) => {
      if (!firstAudio) {
        firstAudio = true;
        this.metrics.recordTtsFirstAudio();
      }
      const played = Math.floor(reply.length * 0.5);
      this.bargeIn.updatePlayedLength(played);
      void this.deps.transport.publishAudio(audio);
    });

    tts.writeText(reply);
    this.metrics.addUsage({ ttsChars: reply.length });
    await tts.end();

    this.activeTts = undefined;
    const snap = this.bargeIn.completeSpeaking();
    return {
      wasInterrupted: snap.wasInterrupted,
      playedTextLength: snap.playedTextLength,
      heardText: snap.heardText,
    };
  }

  private async interruptSpeaking(): Promise<void> {
    const playedLength =
      this.bargeIn.getSpeakingText().length > 0
        ? Math.floor(this.bargeIn.getSpeakingText().length * 0.4)
        : 0;

    if (this.activeTts) {
      await this.activeTts.interrupt();
    }

    const snap = this.bargeIn.handleInterrupt(playedLength);
    if (snap.wasInterrupted) {
      await this.setState('interrupted');
    }
    this.activeTts = undefined;
  }

  private async persistTurn(input: {
    idempotencyKey: string;
    sequenceNo: number;
    speaker: 'child' | 'agent' | 'system_event';
    text: string;
    startedAt: string;
    endedAt?: string;
    wasInterrupted?: boolean;
    playedTextLength?: number;
  }): Promise<void> {
    if (!this.context) return;
    try {
      await this.transcriptClient.appendTurn(this.context.conversationSessionId, {
        idempotencyKey: input.idempotencyKey,
        sequenceNo: input.sequenceNo,
        speaker: input.speaker,
        text: input.text,
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? null,
        wasInterrupted: input.wasInterrupted ?? false,
        playedTextLength: input.playedTextLength ?? null,
        safetyFlags: [],
        metadata: {},
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'persist_turn_failed';
      this.metrics.recordError(message);
    }
  }

  private async setState(state: AgentState): Promise<void> {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
    try {
      await this.deps.transport.publishAgentState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'publish_state_failed';
      this.metrics.recordError(message);
    }
  }
}
