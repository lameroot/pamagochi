import type { GameRuntime, GameSceneKey } from '../config/runtime-config.js';

export type GameCommand =
  { type: 'restart-scene' } | { type: 'skip-intro' } | { type: 'set-muted'; muted: boolean };

export type GameEvent =
  | { type: 'scene-ready'; scene: GameSceneKey; runtime: GameRuntime }
  | { type: 'subtitle'; text: string }
  | { type: 'loading'; active: boolean; message?: string }
  | { type: 'asset-error'; assetKey: string };
