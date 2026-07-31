import { z } from 'zod';

export const gameRuntimeSchema = z.enum(['mock', 'local', 'cloud']);
export type GameRuntime = z.infer<typeof gameRuntimeSchema>;

export const GAME_SCENE_KEYS = ['ArrivalScene', 'HatchingScene', 'CapsuleRoomScene'] as const;
export type GameSceneKey = (typeof GAME_SCENE_KEYS)[number];

export interface GameRuntimeConfig {
  runtime: GameRuntime;
  debug: boolean;
  startScene?: GameSceneKey;
  skipIntro: boolean;
}

type RuntimeEnvironment = Record<string, string | boolean | undefined>;

const truthy = new Set(['1', 'true', 'yes']);

function asBoolean(value: string | boolean | undefined): boolean {
  return value === true || (typeof value === 'string' && truthy.has(value.toLowerCase()));
}

export function resolveStartScene(value: string | null | undefined): GameSceneKey | undefined {
  return GAME_SCENE_KEYS.find((sceneKey) => sceneKey === value);
}

/** Parses environment once at boot; Phaser scenes receive config through services. */
export function parseGameRuntimeConfig(environment: RuntimeEnvironment): GameRuntimeConfig {
  const runtime = gameRuntimeSchema.catch('mock').parse(environment.VITE_GAME_RUNTIME ?? 'mock');
  const urlStart =
    typeof window === 'undefined'
      ? undefined
      : new URLSearchParams(window.location.search).get('start');
  const startScene =
    resolveStartScene(urlStart) ??
    resolveStartScene(String(environment.VITE_GAME_START_SCENE ?? ''));

  return {
    runtime,
    debug: asBoolean(environment.VITE_GAME_DEBUG),
    startScene,
    skipIntro: asBoolean(environment.VITE_GAME_SKIP_INTRO),
  };
}

export function getGameRuntimeConfig(): GameRuntimeConfig {
  return parseGameRuntimeConfig(import.meta.env);
}
