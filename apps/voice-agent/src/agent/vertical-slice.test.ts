import { describe, expect, it, vi } from 'vitest';
import type { AppendConversationTurnRequest } from '@pamagochi/contracts';
import { MockLlmProvider } from '../providers/llm/mock-llm.provider.js';
import { parseVoiceAgentEnv } from '../config/env.schema.js';
import { AgentSession } from './agent-session.js';
import { MockRoomTransport } from './room-transport.js';
import type { SessionContextClient } from './session-context-client.js';
import type { TranscriptClient } from './transcript-client.js';
import type { ToolInvokeClient } from './tool-invoke-client.js';
import { VoiceMetricsCollector } from '../observability/metrics.js';

const env = parseVoiceAgentEnv({
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret',
  VOICE_STT_PROVIDER: 'mock',
  VOICE_LLM_PROVIDER: 'mock',
  VOICE_TTS_PROVIDER: 'mock',
  VOICE_AGENT_INTERNAL_API_URL: 'http://localhost:3000/internal/agent',
  VOICE_AGENT_SERVICE_TOKEN: 'x'.repeat(32),
});

const context = {
  protocolVersion: '1' as const,
  gameSessionId: 'gs-vertical',
  conversationSessionId: 'cs-vertical',
  childId: 'ch1',
  ageBand: '6-8' as const,
  primaryLanguage: 'ru',
  displayName: 'Мира',
  soulVersion: '0.1.0',
  safetyPolicyVersion: '0.1.0',
  livekitRoomName: 'game-gs-vertical',
};

describe('voice vertical slice (mock)', () => {
  it('runs multi-turn conversation with interruption, transcript, and metrics', async () => {
    const transport = new MockRoomTransport('game-gs-vertical');
    const runtimeEvents: unknown[] = [];
    transport.onRuntimeEvent((payload) => runtimeEvents.push(payload));

    const turns: AppendConversationTurnRequest[] = [];
    const transcriptClient = {
      appendTurn: vi.fn(async (_id: string, turn: AppendConversationTurnRequest) => {
        const existing = turns.find((t) => t.idempotencyKey === turn.idempotencyKey);
        if (existing) {
          return {
            turn: {
              id: 'existing',
              conversationSessionId: 'cs-vertical',
              ...existing,
              createdAt: new Date().toISOString(),
            },
            created: false,
          };
        }
        turns.push(turn);
        return {
          turn: {
            id: `t-${turns.length}`,
            conversationSessionId: 'cs-vertical',
            ...turn,
            createdAt: new Date().toISOString(),
          },
          created: true,
        };
      }),
      finalize: vi.fn(async () => {}),
    } as unknown as TranscriptClient;

    const toolResults: unknown[] = [];
    const toolClient = {
      invoke: vi.fn(async () => {
        const result = {
          callId: 'tool-1',
          name: 'character_emote' as const,
          validation: 'accepted' as const,
          safeMessage: 'ok',
          gamePayload: { emotion: 'happy' },
        };
        toolResults.push(result);
        return result;
      }),
    } as unknown as ToolInvokeClient;

    const metrics = new VoiceMetricsCollector();
    const llm = new MockLlmProvider({ toolEmotion: 'happy' });

    const session = new AgentSession({
      env,
      transport,
      contextClient: { fetch: vi.fn(async () => context) } as unknown as SessionContextClient,
      transcriptClient,
      toolClient,
      metrics,
      llm,
    });

    await session.start('gs-vertical');
    await session.handleFinalTranscript('привет');
    await session.handleFinalTranscript('ещё раз');

    const snap = metrics.snapshot();
    expect(turns.length).toBeGreaterThanOrEqual(4);
    expect(snap.e2eMs.length).toBe(2);
    expect(snap.llmFirstTokenMs.length).toBeGreaterThanOrEqual(1);
    expect(toolClient.invoke).toHaveBeenCalled();
    expect(runtimeEvents.some((e) => (e as { type?: string }).type === 'agent-state')).toBe(true);

    const duplicate = await transcriptClient.appendTurn('cs-vertical', turns[0]!);
    expect(duplicate.created).toBe(false);

    await session.close();
    expect(transcriptClient.finalize).toHaveBeenCalled();
  });
});
