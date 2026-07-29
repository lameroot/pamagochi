import { describe, expect, it, vi } from 'vitest';
import type { VoiceSessionContext } from '@pamagochi/contracts';
import { parseVoiceAgentEnv } from '../config/env.schema.js';
import { AgentSession } from './agent-session.js';
import { MockRoomTransport } from './room-transport.js';
import type { SessionContextClient } from './session-context-client.js';

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

describe('AgentSession', () => {
  it('loads context, connects room, and completes one turn without forbidden tools', async () => {
    const transport = new MockRoomTransport('game-gs1');
    const contextClient = {
      fetch: vi.fn(async () => context),
    } as unknown as SessionContextClient;

    const session = new AgentSession({ env, transport, contextClient });
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

    await session.close();
    expect(transport.connected).toBe(false);
    expect(session.getAgentState()).toBe('unavailable');
  });
});
