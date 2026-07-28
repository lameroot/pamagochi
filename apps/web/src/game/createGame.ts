import Phaser from 'phaser';
import type { GameBridge } from './bridge/game-bridge.js';
import { GAME_WORLD_SIZE, MainScene } from './scenes/MainScene.js';

export interface CreateGameOptions {
  parent: HTMLElement;
  bridge: GameBridge;
  activeChildName: string;
}

export function createGame(options: CreateGameOptions): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: GAME_WORLD_SIZE.width,
    height: GAME_WORLD_SIZE.height,
    backgroundColor: '#bde0fe',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [MainScene],
  });

  game.scene.start('main', { bridge: options.bridge, activeChildName: options.activeChildName });

  return game;
}
