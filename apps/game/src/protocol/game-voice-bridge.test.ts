import { describe, expect, it } from 'vitest';
import { agentStateSchema, type AgentState, type AgentToolResult } from '@pamagochi/contracts';
import { agentStatePulseScale, emotionAccentColor, GameVoiceBridge } from './game-voice-bridge.js';
import { MockVoiceClient } from '../voice/livekit-voice-client.js';

describe('GameVoiceBridge', () => {
  it('maps agent state events to scene handler', async () => {
    const client = new MockVoiceClient();
    const states: AgentState[] = [];
    const bridge = new GameVoiceBridge(client, {
      onAgentState: (state) => states.push(state),
    });

    await client.connect();
    bridge.attach();
    client.simulateAgentState('thinking');
    client.simulateAgentState('speaking');

    expect(states).toEqual(['listening', 'thinking', 'speaking']);
    bridge.detach();
  });

  it('forwards accepted character_emote tool results', () => {
    const client = new MockVoiceClient();
    const emotes: string[] = [];
    const bridge = new GameVoiceBridge(client, {
      onAgentState: () => {},
      onCharacterEmote: (emotion) => emotes.push(emotion),
    });
    bridge.attach();

    const result: AgentToolResult = {
      callId: 'c1',
      name: 'character_emote',
      validation: 'accepted',
      safeMessage: 'ok',
      gamePayload: { emotion: 'happy' },
    };
    client.simulateToolResult(result);

    expect(emotes).toEqual(['happy']);
    bridge.detach();
  });

  it('ignores rejected tool results', () => {
    const client = new MockVoiceClient();
    const emotes: string[] = [];
    const bridge = new GameVoiceBridge(client, {
      onAgentState: () => {},
      onCharacterEmote: (emotion) => emotes.push(emotion),
    });
    bridge.attach();

    client.simulateToolResult({
      callId: 'c2',
      name: 'character_emote',
      validation: 'rejected_allowlist',
      safeMessage: 'not allowed',
    });

    expect(emotes).toHaveLength(0);
    bridge.detach();
  });

  it('forwards scene_event_request to game handler', () => {
    const client = new MockVoiceClient();
    const events: string[] = [];
    const bridge = new GameVoiceBridge(client, {
      onAgentState: () => {},
      onSceneEventRequest: (eventId) => events.push(eventId),
    });
    bridge.attach();

    client.simulateToolResult({
      callId: 'c3',
      name: 'scene_request_event',
      validation: 'accepted',
      safeMessage: 'ok',
      gamePayload: { type: 'scene_event_request', eventId: 'OPEN_CAPSULE', status: 'pending' },
    });

    expect(events).toEqual(['OPEN_CAPSULE']);
    bridge.detach();
  });
});

describe('agentStatePulseScale', () => {
  it('returns higher pulse for active speaking states', () => {
    expect(agentStatePulseScale('listening')).toBeLessThan(agentStatePulseScale('speaking'));
    expect(agentStatePulseScale('interrupted')).toBeGreaterThan(agentStatePulseScale('thinking'));
  });
});

describe('emotionAccentColor', () => {
  it('maps each emotion to a distinct accent', () => {
    expect(emotionAccentColor('happy')).not.toBe(emotionAccentColor('confused'));
  });
});

describe('MockVoiceClient', () => {
  it('connects and transitions to listening', async () => {
    const client = new MockVoiceClient();
    const states: AgentState[] = [];
    client.onAgentState((s) => states.push(s));
    await client.connect();
    expect(states).toContain('listening');
    await client.disconnect();
    expect(client.getAgentState()).toBe('unavailable');
  });
});

describe('TalkingLightScene contract', () => {
  it('uses shared AgentState values', () => {
    expect(agentStateSchema.parse('listening')).toBe('listening');
  });
});
