import { describe, expect, it } from 'vitest';
import { agentStateSchema } from '@pamagochi/contracts';

describe('TalkingLightScene contract', () => {
  it('uses shared AgentState values', () => {
    expect(agentStateSchema.parse('listening')).toBe('listening');
  });
});
