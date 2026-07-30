import type { IntroState } from './intro-state.js';
import { applyIntroTransition } from './intro-state.js';

/** Agent-requestable scene events for ship-capsule intro (E5.4). */
export const INTRO_SCENE_EVENT_IDS = ['RESTORE_POWER', 'OPEN_CAPSULE', 'COMPLETE_INTRO'] as const;
export type IntroSceneEventId = (typeof INTRO_SCENE_EVENT_IDS)[number];

const EVENT_ALLOWED_IN_STATE: Record<IntroSceneEventId, readonly IntroState[]> = {
  RESTORE_POWER: ['POWER_CELL_DISCOVERED'],
  OPEN_CAPSULE: ['POWER_RESTORED'],
  COMPLETE_INTRO: ['FIRST_MEETING'],
};

/** State advanced when the game engine accepts a scene event. */
const EVENT_TARGET_STATE: Record<IntroSceneEventId, IntroState> = {
  RESTORE_POWER: 'POWER_RESTORED',
  OPEN_CAPSULE: 'CAPSULE_OPENING',
  COMPLETE_INTRO: 'INTRO_COMPLETED',
};

export function isIntroSceneEventId(value: string): value is IntroSceneEventId {
  return (INTRO_SCENE_EVENT_IDS as readonly string[]).includes(value);
}

export function introEventAllowedInState(state: IntroState, eventId: string): boolean {
  if (!isIntroSceneEventId(eventId)) return false;
  return EVENT_ALLOWED_IN_STATE[eventId].includes(state);
}

export type SceneEventDecision =
  | { accepted: true; eventId: IntroSceneEventId; nextState: IntroState }
  | { accepted: false; eventId: string; reason: 'unknown_event' | 'not_allowed_in_state' };

/**
 * Game engine gate for agent `scene_request_event` payloads.
 * Text/LLM cannot bypass — only validated state + allowlist matter.
 */
export function evaluateSceneEventRequest(state: IntroState, eventId: string): SceneEventDecision {
  if (!isIntroSceneEventId(eventId)) {
    return { accepted: false, eventId, reason: 'unknown_event' };
  }
  if (!introEventAllowedInState(state, eventId)) {
    return { accepted: false, eventId, reason: 'not_allowed_in_state' };
  }
  const nextState = EVENT_TARGET_STATE[eventId];
  const transition = applyIntroTransition(state, nextState);
  if (!transition.ok) {
    return { accepted: false, eventId, reason: 'not_allowed_in_state' };
  }
  return { accepted: true, eventId, nextState };
}
