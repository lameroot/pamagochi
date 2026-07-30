import Phaser from 'phaser';
import type { GameBridge } from '../bridge/GameBridge.js';
import type { GameRuntimeConfig } from './runtime-config.js';
import type { ServiceContainer } from '../services/ServiceContainer.js';

export const GAME_WORLD_SIZE = { width: 1280, height: 720 } as const;

export interface CreateGameConfigOptions {
  parent: HTMLElement;
  runtime: GameRuntimeConfig;
  bridge: GameBridge;
  services: ServiceContainer;
  scenes: Phaser.Types.Scenes.SceneType[];
}

export function createGameConfig(options: CreateGameConfigOptions): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: options.parent,
    width: GAME_WORLD_SIZE.width,
    height: GAME_WORLD_SIZE.height,
    backgroundColor: '#101827',
    physics: { default: 'arcade', arcade: { debug: options.runtime.debug } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: options.scenes,
    callbacks: {
      preBoot: (game) => {
        game.registry.set('services', options.services);
      },
    },
  };
}
