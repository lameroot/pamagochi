import Phaser from 'phaser';
import { ShipCapsuleScene } from './scenes/ShipCapsuleScene.js';
import { TalkingLightScene } from './scenes/TalkingLightScene.js';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#0b1020',
    scene: [ShipCapsuleScene, TalkingLightScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}

/** Starts the correct first scene based on bootstrap (used in tests). */
export function sceneKeyFromBootstrap(sceneKey: string): string {
  return sceneKey === 'talking-light' ? 'TalkingLightScene' : 'ShipCapsuleScene';
}
