import { describe, expect, it } from 'vitest';
import { assertIntroTransition, canTransitionIntro, introStateSchema } from './intro-state.js';

describe('intro state machine', () => {
  it('allows the happy path', () => {
    expect(canTransitionIntro('SHIP_DARK', 'SHIP_POWERED')).toBe(true);
    expect(canTransitionIntro('POWER_RESTORED', 'CAPSULE_OPENING')).toBe(true);
    expect(canTransitionIntro('FIRST_MEETING', 'INTRO_COMPLETED')).toBe(true);
  });

  it('rejects out-of-order transitions', () => {
    expect(canTransitionIntro('SHIP_DARK', 'CAPSULE_OPENING')).toBe(false);
    expect(() => assertIntroTransition('POWER_MISSING' as never, 'CAPSULE_OPENING')).toThrow();
    expect(introStateSchema.safeParse('POWER_MISSING').success).toBe(false);
  });
});
