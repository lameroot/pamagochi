import Phaser from 'phaser';
import { TalkingLightScene } from './scenes/TalkingLightScene.js';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#0b1020',
    scene: [TalkingLightScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
