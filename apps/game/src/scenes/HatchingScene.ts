import Phaser from 'phaser';
import { Pamagochi } from '../entities/Pamagochi.js';
import { PetStateMachine } from '../systems/PetStateMachine.js';
import { AudioManager } from '../systems/AudioManager.js';
import { getGameServices } from './game-services.js';

/** Runtime shell for the interactive hatching sequence implemented in E7.4. */
export class HatchingScene extends Phaser.Scene {
  private hatched = false;
  constructor() {
    super('HatchingScene');
  }

  create(): void {
    const { bridge, runtime } = getGameServices(this);
    bridge.emit({ type: 'scene-ready', scene: 'HatchingScene', runtime: runtime.runtime });
    this.cameras.main.setBackgroundColor('#101827');
    if (!this.scene.isActive('GameHudScene')) this.scene.launch('GameHudScene');
    const glow = this.add.circle(640, 370, 120, 0xffcf73, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    const egg = this.add.image(640, 455, 'pamagochi-egg').setInteractive({ useHandCursor: true });
    this.add
      .text(640, 115, 'Капсула просыпается', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);
    this.add
      .text(640, 170, 'Коснись яйца, чтобы разбудить Памагочи', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);
    egg.on('pointerdown', () => this.hatch(egg, glow));
    this.input.keyboard?.once('keydown-SPACE', () => this.hatch(egg, glow));
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('CapsuleRoomScene'));
    if (import.meta.env.DEV)
      this.input.keyboard?.on('keydown-F2', () => this.scene.launch('DevToolsScene'));
  }

  private hatch(egg: Phaser.GameObjects.Image, glow: Phaser.GameObjects.Arc): void {
    if (this.hatched) return;
    this.hatched = true;
    const { bridge, accessibility } = getGameServices(this);
    new AudioManager(this, accessibility).playCue('hatch');
    bridge.emit({ type: 'subtitle', text: 'Яйцо начинает светиться…' });
    this.tweens.add({
      targets: [egg, glow],
      scaleX: 1.12,
      scaleY: 0.9,
      duration: 110,
      yoyo: true,
      repeat: 4,
    });
    this.time.delayedCall(700, () => {
      egg.destroy();
      glow.setAlpha(0.42);
      const pet = new Pamagochi(this, 640, 550);
      const state = new PetStateMachine();
      state.transition('idle');
      pet.setPetState('happy');
      this.tweens.add({ targets: pet, y: 510, duration: 440, ease: 'Back.Out' });
      bridge.emit({ type: 'subtitle', text: 'Привет… Ты меня разбудил? А где мы?' });
      this.time.delayedCall(2200, () => this.scene.start('CapsuleRoomScene'));
    });
  }
}
