import Phaser from 'phaser';
import { PetStateMachine, type PetState } from '../systems/PetStateMachine.js';

export type PamagochiState = 'idle' | 'walking';

export class Pamagochi extends Phaser.Physics.Arcade.Sprite {
  private petState: PamagochiState = 'idle';
  private readonly stateMachine = new PetStateMachine();
  private emotionTween?: Phaser.Tweens.Tween;
  private destination?: Phaser.Math.Vector2;
  private readonly walkingSpeed = 210;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'pamagochi-idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.86).setDepth(20);
    this.setSize(66, 86).setOffset(47, 72);
    this.play('pamagochi-idle');
    this.stateMachine.transition('idle');
  }

  getState(): PamagochiState {
    return this.petState;
  }

  getPetState(): PetState {
    return this.stateMachine.getState();
  }

  /** Visual-safe state change; unsupported transitions leave the pet unchanged. */
  setPetState(next: PetState): boolean {
    if (!this.stateMachine.transition(next)) return false;
    this.emotionTween?.stop();
    if (next === 'walking') {
      this.petState = 'walking';
      this.play('pamagochi-walk', true);
      return true;
    }
    this.petState = 'idle';
    this.play('pamagochi-idle', true);
    const profile: Partial<Record<PetState, { scale: number; angle: number; duration: number }>> = {
      spawning: { scale: 0.84, angle: 0, duration: 280 },
      listening: { scale: 1.04, angle: -5, duration: 320 },
      thinking: { scale: 0.98, angle: 4, duration: 420 },
      speaking: { scale: 1.05, angle: 0, duration: 180 },
      curious: { scale: 1.04, angle: -8, duration: 360 },
      happy: { scale: 1.12, angle: 0, duration: 220 },
      afraid: { scale: 0.9, angle: 5, duration: 190 },
      tired: { scale: 0.93, angle: 0, duration: 520 },
      sleeping: { scale: 0.9, angle: 0, duration: 760 },
      interacting: { scale: 1.04, angle: 5, duration: 260 },
    };
    const visual = profile[next];
    if (visual) {
      this.emotionTween = this.scene.tweens.add({
        targets: this,
        scaleX: visual.scale,
        scaleY: visual.scale,
        angle: visual.angle,
        duration: visual.duration,
        yoyo: true,
        repeat: next === 'sleeping' ? -1 : 1,
        ease: 'Sine.easeInOut',
      });
    }
    return true;
  }

  walkTo(destination: Phaser.Math.Vector2): void {
    this.destination = destination;
    this.petState = 'walking';
    this.play('pamagochi-walk', true);
  }

  halt(): void {
    this.destination = undefined;
    (this.body as Phaser.Physics.Arcade.Body | null)?.stop();
    this.petState = 'idle';
    this.stateMachine.interrupt();
    this.play('pamagochi-idle', true);
  }

  /** DevTools-only visual preview. Gameplay transitions must use setPetState(). */
  previewPetState(next: PetState): void {
    this.halt();
    if (next === 'spawning') {
      this.setScale(0.84);
      return;
    }
    this.setPetState(next);
  }

  override update(): void {
    if (!this.destination) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.destination.x,
      this.destination.y,
    );
    if (
      distance < 10 ||
      body.blocked.left ||
      body.blocked.right ||
      body.blocked.up ||
      body.blocked.down
    ) {
      this.halt();
      return;
    }
    this.scene.physics.moveTo(this, this.destination.x, this.destination.y, this.walkingSpeed);
    this.setFlipX(body.velocity.x < 0);
  }
}
