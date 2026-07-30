import { describe, expect, it } from 'vitest';
import {
  INTRO_STATE_ORDER,
  applyIntroTransition,
  assertIntroTransition,
  canTransitionIntro,
  introStateSchema,
  isIntroCompleted,
} from './intro-state.js';

describe('intro state machine', () => {
  it('defines the full happy-path order', () => {
    expect(INTRO_STATE_ORDER).toEqual([
      'SHIP_DARK',
      'SHIP_POWERED',
      'VOICE_CONNECTION_READY',
      'FIRST_VOICE_CONTACT',
      'POWER_CELL_DISCOVERED',
      'POWER_RESTORED',
      'CAPSULE_OPENING',
      'FIRST_MEETING',
      'INTRO_COMPLETED',
    ]);
  });

  it('allows the happy path', () => {
    expect(canTransitionIntro('SHIP_DARK', 'SHIP_POWERED')).toBe(true);
    expect(canTransitionIntro('POWER_RESTORED', 'CAPSULE_OPENING')).toBe(true);
    expect(canTransitionIntro('FIRST_MEETING', 'INTRO_COMPLETED')).toBe(true);
  });

  it('is idempotent for same-state transitions', () => {
    expect(canTransitionIntro('FIRST_VOICE_CONTACT', 'FIRST_VOICE_CONTACT')).toBe(true);
    const result = applyIntroTransition('FIRST_VOICE_CONTACT', 'FIRST_VOICE_CONTACT');
    expect(result).toEqual({ ok: true, state: 'FIRST_VOICE_CONTACT', changed: false });
  });

  it('rejects out-of-order transitions', () => {
    expect(canTransitionIntro('SHIP_DARK', 'CAPSULE_OPENING')).toBe(false);
    expect(applyIntroTransition('SHIP_DARK', 'CAPSULE_OPENING')).toEqual({
      ok: false,
      reason: 'invalid_transition',
    });
    expect(() => assertIntroTransition('SHIP_DARK', 'CAPSULE_OPENING')).toThrow();
    expect(introStateSchema.safeParse('POWER_MISSING').success).toBe(false);
  });

  it('blocks transitions after INTRO_COMPLETED', () => {
    expect(applyIntroTransition('INTRO_COMPLETED', 'FIRST_MEETING')).toEqual({
      ok: false,
      reason: 'already_completed',
    });
    expect(isIntroCompleted('INTRO_COMPLETED')).toBe(true);
    expect(isIntroCompleted('FIRST_MEETING')).toBe(false);
  });

  it('walks the full chain via applyIntroTransition', () => {
    let state = INTRO_STATE_ORDER[0]!;
    for (let i = 1; i < INTRO_STATE_ORDER.length; i++) {
      const next = INTRO_STATE_ORDER[i]!;
      const result = applyIntroTransition(state, next);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state).toBe('INTRO_COMPLETED');
  });
});
