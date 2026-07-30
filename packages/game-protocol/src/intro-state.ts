import { z } from 'zod';

/** Deterministic first-meeting state machine (E5). Transitions validated by game/api. */
export const introStateSchema = z.enum([
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
export type IntroState = z.infer<typeof introStateSchema>;

/** Canonical progression order for restore / replay guards. */
export const INTRO_STATE_ORDER: readonly IntroState[] = [
  'SHIP_DARK',
  'SHIP_POWERED',
  'VOICE_CONNECTION_READY',
  'FIRST_VOICE_CONTACT',
  'POWER_CELL_DISCOVERED',
  'POWER_RESTORED',
  'CAPSULE_OPENING',
  'FIRST_MEETING',
  'INTRO_COMPLETED',
] as const;

const TRANSITIONS: Record<IntroState, readonly IntroState[]> = {
  SHIP_DARK: ['SHIP_POWERED'],
  SHIP_POWERED: ['VOICE_CONNECTION_READY'],
  VOICE_CONNECTION_READY: ['FIRST_VOICE_CONTACT'],
  FIRST_VOICE_CONTACT: ['POWER_CELL_DISCOVERED'],
  POWER_CELL_DISCOVERED: ['POWER_RESTORED'],
  POWER_RESTORED: ['CAPSULE_OPENING'],
  CAPSULE_OPENING: ['FIRST_MEETING'],
  FIRST_MEETING: ['INTRO_COMPLETED'],
  INTRO_COMPLETED: [],
};

export function isIntroState(value: string): value is IntroState {
  return introStateSchema.safeParse(value).success;
}

export function introStateIndex(state: IntroState): number {
  return INTRO_STATE_ORDER.indexOf(state);
}

export function canTransitionIntro(from: IntroState, to: IntroState): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertIntroTransition(from: IntroState, to: IntroState): void {
  if (!canTransitionIntro(from, to)) {
    throw new Error(`Invalid intro transition: ${from} -> ${to}`);
  }
}

export function allowedIntroTransitions(from: IntroState): readonly IntroState[] {
  return TRANSITIONS[from] ?? [];
}

export type IntroTransitionFailureReason = 'invalid_transition' | 'already_completed';

export type IntroTransitionResult =
  | { ok: true; state: IntroState; changed: boolean }
  | { ok: false; reason: IntroTransitionFailureReason };

/**
 * Applies a single intro transition. Idempotent when `from === to`.
 * Does not allow leaving INTRO_COMPLETED.
 */
export function applyIntroTransition(from: IntroState, to: IntroState): IntroTransitionResult {
  if (from === to) {
    return { ok: true, state: to, changed: false };
  }
  if (from === 'INTRO_COMPLETED') {
    return { ok: false, reason: 'already_completed' };
  }
  if (!canTransitionIntro(from, to)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  return { ok: true, state: to, changed: true };
}

export function isIntroCompleted(state: IntroState): boolean {
  return state === 'INTRO_COMPLETED';
}
