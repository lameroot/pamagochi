import { describe, expect, it } from 'vitest';
import { introAllowlistFor } from '@pamagochi/game-protocol';
import { talkingLightAllowlist } from '@pamagochi/game-protocol';
import {
  ToolValidator,
  createRateLimitState,
  type ToolValidationContext,
} from './tool-validator.js';

function ctx(overrides: Partial<ToolValidationContext> = {}): ToolValidationContext {
  const allowlist = introAllowlistFor('POWER_RESTORED');
  return {
    sceneAllowlist: allowlist,
    childId: 'child-1',
    conversationSessionId: 'conv-1',
    callStartedAtMs: Date.now(),
    timeoutMs: 5000,
    maxCallsPerMinute: 30,
    rateLimit: createRateLimitState(),
    ...overrides,
  };
}

describe('ToolValidator', () => {
  const validator = new ToolValidator();

  it('accepts a valid character_emote', () => {
    const { result } = validator.validate(
      { name: 'character_emote', callId: 'c1', arguments: { emotion: 'happy' } },
      ctx(),
    );
    expect(result.validation).toBe('accepted');
    expect(result.gamePayload).toEqual({ type: 'character_emote', emotion: 'happy' });
  });

  it('rejects unknown tools', () => {
    const { result } = validator.validate(
      { name: 'execute_shell', callId: 'c2', arguments: {} },
      ctx(),
    );
    expect(result.validation).toBe('rejected_unknown_tool');
  });

  it('rejects schema violations', () => {
    const { result } = validator.validate(
      { name: 'character_emote', callId: 'c3', arguments: { emotion: 'furious' } },
      ctx(),
    );
    expect(result.validation).toBe('rejected_schema');
  });

  it('rejects tools not on scene allowlist', () => {
    const allowlist = talkingLightAllowlist();
    const { result } = validator.validate(
      { name: 'scene_request_event', callId: 'c4', arguments: { eventId: 'OPEN_CAPSULE' } },
      ctx({ sceneAllowlist: allowlist }),
    );
    expect(result.validation).toBe('rejected_allowlist');
  });

  it('rejects look_at for objects not visible', () => {
    const { result } = validator.validate(
      { name: 'character_look_at', callId: 'c5', arguments: { targetId: 'unknown_obj' } },
      ctx(),
    );
    expect(result.validation).toBe('rejected_ownership');
  });

  it('rejects scene_request_event when event not allowed in state', () => {
    const allowlist = introAllowlistFor('POWER_CELL_DISCOVERED');
    const { result } = validator.validate(
      { name: 'scene_request_event', callId: 'c6', arguments: { eventId: 'OPEN_CAPSULE' } },
      ctx({ sceneAllowlist: allowlist }),
    );
    expect(result.validation).toBe('rejected_state');
  });

  it('scene_request_event only creates a pending request payload', () => {
    const { result } = validator.validate(
      { name: 'scene_request_event', callId: 'c7', arguments: { eventId: 'OPEN_CAPSULE' } },
      ctx(),
    );
    expect(result.validation).toBe('accepted');
    expect(result.gamePayload).toMatchObject({
      type: 'scene_event_request',
      eventId: 'OPEN_CAPSULE',
      status: 'pending',
    });
  });

  it('rejects gestures not allowed in intro state', () => {
    const allowlist = introAllowlistFor('FIRST_VOICE_CONTACT');
    const { result } = validator.validate(
      { name: 'character_gesture', callId: 'c8', arguments: { gesture: 'wave' } },
      ctx({ sceneAllowlist: allowlist }),
    );
    expect(result.validation).toBe('rejected_state');
  });

  it('enforces rate limits', () => {
    const rateLimit = createRateLimitState();
    const base = ctx({ maxCallsPerMinute: 2, rateLimit });
    for (let i = 0; i < 2; i++) {
      const { result } = validator.validate(
        { name: 'character_emote', callId: `rate-${i}`, arguments: { emotion: 'calm' } },
        base,
      );
      expect(result.validation).toBe('accepted');
    }
    const { result } = validator.validate(
      { name: 'character_emote', callId: 'rate-overflow', arguments: { emotion: 'calm' } },
      base,
    );
    expect(result.validation).toBe('rejected_rate_limit');
  });

  it('is idempotent for duplicate callId', () => {
    const base = ctx();
    const payload = {
      name: 'character_emote' as const,
      callId: 'idem-1',
      arguments: { emotion: 'happy' as const },
    };
    validator.validate(payload, base);
    const { result } = validator.validate(payload, base);
    expect(result.validation).toBe('accepted');
    expect(base.rateLimit.callTimestamps).toHaveLength(1);
  });

  it('rejects timed-out calls', () => {
    const { result } = validator.validate(
      { name: 'character_emote', callId: 'timeout-1', arguments: { emotion: 'calm' } },
      ctx({ callStartedAtMs: Date.now() - 10_000, timeoutMs: 100 }),
    );
    expect(result.validation).toBe('rejected_timeout');
  });
});
