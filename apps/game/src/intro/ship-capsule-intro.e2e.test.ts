import { describe, expect, it } from 'vitest';
import { IntroEngine } from '../intro/intro-engine.js';
import { MockIntroProgressClient } from '../intro/intro-progress-client.js';
import { evaluateSceneEventRequest } from '@pamagochi/game-protocol';

const baseProgress = {
  state: 'POWER_RESTORED' as const,
  sharedEvents: [],
  completed: false,
  updatedAt: new Date().toISOString(),
};

describe('ship-capsule intro E2E (unit)', () => {
  it('walks player path without HTML dialog menus', async () => {
    const client = new MockIntroProgressClient({
      state: 'SHIP_DARK',
      sharedEvents: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });

    expect(await engine.advanceTo('SHIP_POWERED')).toBe(true);
    expect(await engine.advanceTo('VOICE_CONNECTION_READY')).toBe(true);
    expect(await engine.advanceTo('FIRST_VOICE_CONTACT')).toBe(true);
    expect(await engine.advanceTo('POWER_CELL_DISCOVERED')).toBe(true);
    expect(await engine.advanceTo('POWER_RESTORED')).toBe(true);
    expect(engine.getState()).toBe('POWER_RESTORED');
  });

  it('rejects OPEN_CAPSULE when power is missing — LLM cannot bypass', async () => {
    const client = new MockIntroProgressClient({
      state: 'FIRST_VOICE_CONTACT',
      sharedEvents: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });

    expect(evaluateSceneEventRequest('FIRST_VOICE_CONTACT', 'OPEN_CAPSULE').accepted).toBe(false);
    expect(await engine.handleSceneEventRequest('OPEN_CAPSULE', 'call-1')).toBe(false);
    expect(engine.getState()).toBe('FIRST_VOICE_CONTACT');
  });

  it('accepts agent OPEN_CAPSULE request only after power restored', async () => {
    const client = new MockIntroProgressClient(baseProgress);
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });

    expect(await engine.handleSceneEventRequest('OPEN_CAPSULE', 'call-2')).toBe(true);
    expect(engine.getState()).toBe('CAPSULE_OPENING');
  });

  it('restores persisted state without replaying events', async () => {
    const client = new MockIntroProgressClient({
      state: 'POWER_CELL_DISCOVERED',
      sharedEvents: ['power_cell_discovered'],
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });
    expect(engine.getState()).toBe('POWER_CELL_DISCOVERED');
    expect(engine.getProgress().sharedEvents).toContain('power_cell_discovered');
  });

  it('completes intro idempotently', async () => {
    const client = new MockIntroProgressClient({
      state: 'FIRST_MEETING',
      sharedEvents: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });
    expect(await engine.advanceTo('INTRO_COMPLETED')).toBe(true);
    expect(await engine.advanceTo('INTRO_COMPLETED')).toBe(true);
    expect(engine.getState()).toBe('INTRO_COMPLETED');
  });

  it('walks full SHIP_DARK → INTRO_COMPLETED without dialog menus', async () => {
    const client = new MockIntroProgressClient({
      state: 'SHIP_DARK',
      sharedEvents: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    const engine = new IntroEngine({ initialProgress: client.getProgress(), client });

    const path = [
      'SHIP_POWERED',
      'VOICE_CONNECTION_READY',
      'FIRST_VOICE_CONTACT',
      'POWER_CELL_DISCOVERED',
      'POWER_RESTORED',
      'CAPSULE_OPENING',
      'FIRST_MEETING',
      'INTRO_COMPLETED',
    ] as const;

    for (const state of path) {
      expect(await engine.advanceTo(state)).toBe(true);
    }
    expect(engine.getState()).toBe('INTRO_COMPLETED');
    expect(engine.getProgress().completed).toBe(true);
  });
});
