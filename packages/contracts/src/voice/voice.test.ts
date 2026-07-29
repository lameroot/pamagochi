import { describe, expect, it } from 'vitest';
import { agentStateSchema } from './agent-state.js';
import { agentToolRequestSchema, agentToolResultSchema } from './tools.js';
import { gameBootstrapResponseSchema } from './bootstrap.js';
import { memoryProposalSchema } from './memory.js';
import { voiceRuntimeEventSchema } from './protocol.js';

describe('voice contracts', () => {
  it('accepts known agent states only', () => {
    expect(agentStateSchema.parse('listening')).toBe('listening');
    expect(() => agentStateSchema.parse('broken')).toThrow();
  });

  it('validates character_emote tool request', () => {
    const req = agentToolRequestSchema.parse({
      name: 'character_emote',
      callId: 'c1',
      arguments: { emotion: 'curious' },
    });
    expect(req.name).toBe('character_emote');
  });

  it('rejects unknown tool names via discriminated union', () => {
    expect(() =>
      agentToolRequestSchema.parse({
        name: 'execute_action',
        callId: 'x',
        arguments: { name: 'shell', args: {} },
      }),
    ).toThrow();
  });

  it('parses bootstrap without secrets fields', () => {
    const boot = gameBootstrapResponseSchema.parse({
      protocolVersion: '1',
      gameSessionId: 'gs1',
      child: {
        id: 'ch1',
        displayName: 'Мира',
        ageBand: '6-8',
        primaryLanguage: 'ru',
      },
      livekit: {
        url: 'wss://example.livekit.cloud',
        roomName: 'room-1',
        token: 'token',
      },
      sceneKey: 'talking-light',
    });
    expect(boot.initialAgentState).toBe('connecting');
    expect('parentJwt' in boot).toBe(false);
  });

  it('validates memory proposals and runtime events', () => {
    expect(
      memoryProposalSchema.parse({
        category: 'interest',
        fact: 'Любит звёзды',
        confidence: 0.9,
        sourceTurnIds: ['t1'],
        rationale: 'said explicitly',
      }).fact,
    ).toContain('звёзды');

    const event = voiceRuntimeEventSchema.parse({
      type: 'tool-result',
      protocolVersion: '1',
      result: agentToolResultSchema.parse({
        callId: 'c1',
        name: 'character_emote',
        validation: 'accepted',
        safeMessage: 'ok',
      }),
    });
    expect(event.type).toBe('tool-result');
  });
});
