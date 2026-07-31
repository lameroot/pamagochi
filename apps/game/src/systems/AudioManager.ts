import type Phaser from 'phaser';
import type { AccessibilityManager } from './AccessibilityManager.js';
/** Safe audio gateway: missing/unavailable assets are a no-op, never a scene crash. */
export class AudioManager {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly accessibility: AccessibilityManager,
  ) {}
  play(key: string, volume = 0.35): void {
    if (this.accessibility.get().sound && this.scene.cache.audio.exists(key))
      this.scene.sound.play(key, { volume });
  }

  /**
   * Small original procedural cues for the offline slice. They avoid adding
   * unlicensed binary assets and degrade silently on platforms without Web Audio.
   */
  playCue(cue: 'hatch' | 'interact'): void {
    if (!this.accessibility.get().sound) return;
    const Context = globalThis.AudioContext;
    if (!Context) return;
    try {
      const context = new Context();
      const now = context.currentTime;
      const frequencies = cue === 'hatch' ? [392, 523, 659] : [440, 587];
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.09;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.17);
      });
      this.scene.time.delayedCall(500, () => void context.close());
    } catch {
      // Audio is optional; browser gesture/autoplay limitations must not break play.
    }
  }
}
