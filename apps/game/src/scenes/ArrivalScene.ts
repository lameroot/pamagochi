import Phaser from 'phaser';
import { getGameServices } from './game-services.js';

/** Short skippable 2D arrival; no network or 3D renderer needed. */
export class ArrivalScene extends Phaser.Scene {
  constructor() {
    super('ArrivalScene');
  }

  create(): void {
    const { bridge, runtime, accessibility } = getGameServices(this);
    bridge.emit({ type: 'scene-ready', scene: 'ArrivalScene', runtime: runtime.runtime });
    this.cameras.main.setBackgroundColor('#061225');
    for (let index = 0; index < 42; index += 1)
      this.add.circle(
        (index * 83) % 1280,
        (index * 47) % 430,
        index % 5 === 0 ? 2 : 1,
        0xc7e8ff,
        0.65,
      );
    const capsule = this.add.container(-120, 350, [
      this.add.ellipse(0, 0, 150, 82, 0x4d7394),
      this.add.ellipse(0, 0, 90, 48, 0xffce78, 0.55),
    ]);
    this.tweens.add({ targets: capsule, x: 1400, y: 292, duration: 3800, ease: 'Sine.easeInOut' });
    if (accessibility.get().particles)
      this.add.particles(0, 0, '__DEFAULT', {
        x: { min: 0, max: 1280 },
        y: { min: 0, max: 720 },
        lifespan: 3200,
        speedY: 5,
        quantity: 1,
        frequency: 160,
        tint: 0x9ed4ff,
        scale: { start: 0.05, end: 0 },
      });
    this.add
      .text(640, 360, 'Спасательная капсула приближается к Земле', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#dbeafe',
      })
      .setOrigin(0.5);
    const skip = () => this.scene.start('HatchingScene');
    this.input.once('pointerdown', skip);
    this.input.keyboard?.once('keydown-ESC', skip);
  }
}
