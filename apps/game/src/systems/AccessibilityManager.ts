export interface EffectsSettings {
  particles: boolean;
  cameraShake: boolean;
  intenseFlashes: boolean;
  sound: boolean;
}
const defaults: EffectsSettings = {
  particles: true,
  cameraShake: true,
  intenseFlashes: false,
  sound: true,
};
export class AccessibilityManager {
  private settings: EffectsSettings = { ...defaults };
  get(): EffectsSettings {
    return { ...this.settings };
  }
  set(next: Partial<EffectsSettings>): EffectsSettings {
    this.settings = { ...this.settings, ...next };
    return this.get();
  }
}
