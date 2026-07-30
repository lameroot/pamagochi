import { describe, expect, it, vi } from 'vitest';
import type { VoiceSessionContext } from '@pamagochi/contracts';
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

const context: VoiceSessionContext = {
  protocolVersion: '1',
  gameSessionId: 'gs1',
  conversationSessionId: 'cs1',
  childId: 'ch1',
  ageBand: '6-8',
  primaryLanguage: 'ru',
  displayName: 'Мира',
  soulVersion: '0.1.0',
  safetyPolicyVersion: '0.1.0',
  livekitRoomName: 'game-gs1',
};

function createMocks() {
  const appendedTurns: unknown[] = [];
  const transcriptClient = {
    appendTurn: vi.fn(async (_id: string, turn: unknown) => {
      appendedTurns.push(turn);
      return { turn: { id: 't1', ...(turn as Record<string, unknown>) }, created: true };
    }),
    finalize: vi.fn(async () => {}),
  } as unknown as TranscriptClient;

  const toolClient = {
    invoke: vi.fn(async () => ({
      callId: 'c1',
      name: 'character_emote' as const,
      validation: 'accepted' as const,
      safeMessage: 'ok',
      gamePayload: { emotion: 'happy' },
    })),
  } as unknown as ToolInvokeClient;

  return { transcriptClient, toolClient, appendedTurns };
}

describe('AgentSession', () => {
  it('loads context, connects room, and completes one turn without forbidden tools', async () => {
    const transport = new MockRoomTransport('game-gs1');
    const contextClient = {
      fetch: vi.fn(async () => context),
    } as unknown as SessionContextClient;
    const { transcriptClient, toolClient } = createMocks();
    const metrics = new VoiceMetricsCollector();

    const session = new AgentSession({
      env,
      transport,
      contextClient,
      transcriptClient,
      toolClient,
      metrics,
    });
    const states: string[] = [];
    session.onState((state) => states.push(state));

    await session.start('gs1');
    expect(transport.connected).toBe(true);
    expect(session.getContext()?.childId).toBe('ch1');

    const reply = await session.handleFinalTranscript('привет');
    expect(reply.length).toBeGreaterThan(0);
    expect(states).toContain('thinking');
    expect(states).toContain('speaking');
    expect(states).toContain('listening');
    expect(transcriptClient.appendTurn).toHaveBeenCalled();
    expect(metrics.snapshot().e2eMs.length).toBe(1);

    await session.close();
    expect(transport.connected).toBe(false);
    expect(session.getAgentState()).toBe('unavailable');
    expect(transcriptClient.finalize).toHaveBeenCalled();
  });

  it('interrupts TTS when child speaks during agent reply', async () => {
    const transport = new MockRoomTransport('game-gs1');
    const contextClient = {
      fetch: vi.fn(async () => context),
    } as unknown as SessionContextClient;
    const { transcriptClient, toolClient } = createMocks();
    const { SlowMockTtsProvider } = await import('../providers/tts/slow-mock-tts.provider.js');

    const session = new AgentSession({
      env,
      transport,
      contextClient,
      transcriptClient,
      toolClient,
      tts: new SlowMockTtsProvider(),
    });
    const states: string[] = [];
    session.onState((state) => states.push(state));

    await session.start('gs1');

    void session.handleFinalTranscript('первый');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(states).toContain('speaking');

    // Continuous microphone frames must not be treated as an interruption.
    // Only a finalized new utterance is valid barge-in input.
    transport.emitChildAudio(new Uint8Array([1, 2, 3, 4]));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(states).not.toContain('interrupted');

    void session.handleFinalTranscript('перебей');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(states).toContain('interrupted');
  });

  it('invokes scene_request_event with sceneState for ship-capsule intro', async () => {
    const transport = new MockRoomTransport('game-gs1');
    const introContext: VoiceSessionContext = {
      ...context,
      sceneKey: 'ship-capsule-intro',
      sceneState: 'POWER_RESTORED',
      worldState: { introState: 'POWER_RESTORED', capsuleOpen: false },
      goal: 'Ask the child to restore power carefully.',
    };
    const contextClient = {
      fetch: vi.fn(async () => introContext),
    } as unknown as SessionContextClient;
    const { transcriptClient, toolClient } = createMocks();
    const { MockLlmProvider } = await import('../providers/llm/mock-llm.provider.js');

    const session = new AgentSession({
      env,
      transport,
      contextClient,
      transcriptClient,
      toolClient,
      llm: new MockLlmProvider({ sceneEventId: 'OPEN_CAPSULE' }),
    });

    await session.start('gs1');
    expect(session.getContext()?.sceneKey).toBe('ship-capsule-intro');

    await session.handleFinalTranscript('открой капсулу');
    expect(toolClient.invoke).toHaveBeenCalledWith(
      'cs1',
      'ship-capsule-intro',
      expect.objectContaining({
        name: 'scene_request_event',
        arguments: { eventId: 'OPEN_CAPSULE' },
      }),
      expect.any(String),
      'POWER_RESTORED',
    );
    expect(
      transport.publishedEvents.some((e) => (e as { type?: string }).type === 'tool-result'),
    ).toBe(true);
  });
});
