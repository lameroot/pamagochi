import { describe, expect, it } from 'vitest';
import { introAllowlistFor } from './scene-allowlist.js';
import { evaluateSceneEventRequest } from './scene-events.js';

describe('scene event gate', () => {
  it('rejects OPEN_CAPSULE without power', () => {
    expect(evaluateSceneEventRequest('SHIP_DARK', 'OPEN_CAPSULE')).toEqual({
      accepted: false,
      eventId: 'OPEN_CAPSULE',
      reason: 'not_allowed_in_state',
    });
    expect(evaluateSceneEventRequest('FIRST_VOICE_CONTACT', 'OPEN_CAPSULE')).toEqual({
      accepted: false,
      eventId: 'OPEN_CAPSULE',
      reason: 'not_allowed_in_state',
    });
  });

  it('accepts OPEN_CAPSULE only in POWER_RESTORED', () => {
    expect(evaluateSceneEventRequest('POWER_RESTORED', 'OPEN_CAPSULE')).toEqual({
      accepted: true,
      eventId: 'OPEN_CAPSULE',
      nextState: 'CAPSULE_OPENING',
    });
  });

  it('accepts RESTORE_POWER only after discovery', () => {
    expect(evaluateSceneEventRequest('POWER_CELL_DISCOVERED', 'RESTORE_POWER')).toEqual({
      accepted: true,
      eventId: 'RESTORE_POWER',
      nextState: 'POWER_RESTORED',
    });
  });

  it('rejects unknown events', () => {
    expect(evaluateSceneEventRequest('POWER_RESTORED', 'FORCE_OPEN')).toEqual({
      accepted: false,
      eventId: 'FORCE_OPEN',
      reason: 'unknown_event',
    });
  });
});

describe('introAllowlistFor', () => {
  it('exposes OPEN_CAPSULE only when power is restored', () => {
    expect(introAllowlistFor('POWER_RESTORED').allowedEventIds).toContain('OPEN_CAPSULE');
    expect(introAllowlistFor('SHIP_DARK').allowedEventIds).not.toContain('OPEN_CAPSULE');
    expect(introAllowlistFor('FIRST_VOICE_CONTACT').allowedEventIds).not.toContain('OPEN_CAPSULE');
  });

  it('limits gestures before first meeting', () => {
    expect(introAllowlistFor('SHIP_DARK').allowedGestureIds).toBeUndefined();
    expect(introAllowlistFor('FIRST_MEETING').allowedGestureIds).toContain('wave');
  });
});
