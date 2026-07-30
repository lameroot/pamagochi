import Phaser from 'phaser';
import { getGameServices } from './game-services.js';

/** Reads the already-parsed runtime config and hands off to loading exactly once. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const { runtime } = getGameServices(this);
    this.registry.set('runtime', runtime);
    this.scene.start('PreloaderScene');
  }
}
