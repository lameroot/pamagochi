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

export function canTransitionIntro(from: IntroState, to: IntroState): boolean {
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
