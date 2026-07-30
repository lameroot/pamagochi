import { describe, expect, it } from 'vitest';
import { parseGameRuntimeConfig, resolveStartScene } from './runtime-config.js';

describe('parseGameRuntimeConfig', () => {
  it('uses safe mock defaults for an empty environment', () => {
    expect(parseGameRuntimeConfig({})).toEqual({
      runtime: 'mock',
      debug: false,
      startScene: undefined,
      skipIntro: false,
    });
  });

  it('accepts only known runtimes and scene keys', () => {
    expect(
      parseGameRuntimeConfig({
        VITE_GAME_RUNTIME: 'cloud',
        VITE_GAME_DEBUG: 'true',
        VITE_GAME_START_SCENE: 'CapsuleRoomScene',
      }),
    ).toMatchObject({ runtime: 'cloud', debug: true, startScene: 'CapsuleRoomScene' });
    expect(parseGameRuntimeConfig({ VITE_GAME_RUNTIME: 'unknown' }).runtime).toBe('mock');
  });

  it('does not expose unregistered start scene values', () => {
    expect(resolveStartScene('ShipCapsuleScene')).toBeUndefined();
    expect(resolveStartScene('ArrivalScene')).toBe('ArrivalScene');
  });
});
