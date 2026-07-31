import Phaser from 'phaser';
import { PET_STATES, type PetState } from '../systems/PetStateMachine.js';
import { CapsuleRoomScene } from './CapsuleRoomScene.js';
import { getGameServices } from './game-services.js';

/** Development-only overlay. It is not registered in production builds. */
export class DevToolsScene extends Phaser.Scene {
  private stateIndex = 0;
  private zonesVisible = false;
  private status?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'DevToolsScene', active: false });
  }

  create(): void {
    const { accessibility } = getGameServices(this);
    const panel = this.add.rectangle(18, 18, 600, 538, 0x0b1220, 0.94).setOrigin(0).setDepth(1000);
    panel.setStrokeStyle(1, 0x8bb6ce, 0.7);
    this.add
      .text(38, 36, 'DEVTOOLS  ·  F2 закрыть  ·  только development', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e0f2fe',
      })
      .setDepth(1001);
    const actions: Array<[string, () => void]> = [
      ['1  ArrivalScene', () => this.openScene('ArrivalScene')],
      ['2  HatchingScene', () => this.openScene('HatchingScene')],
      ['3  CapsuleRoomScene', () => this.openScene('CapsuleRoomScene')],
      ['R  перезапустить сцену', () => this.restartActiveScene()],
      ['A / J  skip Arrival / finish hatch', () => this.openScene('CapsuleRoomScene')],
      ['N  следующий pet state/emotion', () => this.previewNextState()],
      ['M  mock phrase + PetAction', () => this.room()?.devTriggerMockInteraction()],
      ['T  teleport в центр комнаты', () => this.room()?.devTeleport(640, 565)],
      ['D / Z  physics + navigation zones', () => this.toggleZones()],
      ['P  частицы', () => accessibility.set({ particles: !accessibility.get().particles })],
      ['S  звук', () => accessibility.set({ sound: !accessibility.get().sound })],
      ['+ / -  animation speed', () => this.changeTimeScale(0.2)],
      ['C  clear localStorage', () => window.localStorage.clear()],
      ['Y  copy game state', () => void this.copyState()],
    ];
    actions.forEach(([label], index) =>
      this.add
        .text(40, 76 + index * 25, label, {
          fontFamily: 'system-ui',
          fontSize: '16px',
          color: '#cbd5e1',
        })
        .setDepth(1001),
    );
    this.status = this.add
      .text(40, 478, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#93c5fd',
      })
      .setDepth(1001);
    this.input.keyboard?.on('keydown-F2', () => this.scene.stop());
    this.input.keyboard?.on('keydown-ONE', actions[0]![1]);
    this.input.keyboard?.on('keydown-TWO', actions[1]![1]);
    this.input.keyboard?.on('keydown-THREE', actions[2]![1]);
    this.input.keyboard?.on('keydown-R', actions[3]![1]);
    this.input.keyboard?.on('keydown-A', actions[4]![1]);
    this.input.keyboard?.on('keydown-J', actions[4]![1]);
    this.input.keyboard?.on('keydown-N', actions[5]![1]);
    this.input.keyboard?.on('keydown-M', actions[6]![1]);
    this.input.keyboard?.on('keydown-T', actions[7]![1]);
    this.input.keyboard?.on('keydown-D', actions[8]![1]);
    this.input.keyboard?.on('keydown-Z', actions[8]![1]);
    this.input.keyboard?.on('keydown-P', actions[9]![1]);
    this.input.keyboard?.on('keydown-S', actions[10]![1]);
    this.input.keyboard?.on('keydown-PLUS', actions[11]![1]);
    this.input.keyboard?.on('keydown-MINUS', () => this.changeTimeScale(-0.2));
    this.input.keyboard?.on('keydown-C', actions[12]![1]);
    this.input.keyboard?.on('keydown-Y', actions[13]![1]);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.refreshStatus, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.events.off(Phaser.Scenes.Events.UPDATE, this.refreshStatus, this),
    );
  }

  private openScene(scene: string): void {
    this.scene.stop();
    this.scene.start(scene);
  }

  private restartActiveScene(): void {
    const active = this.scene.manager
      .getScenes(true)
      .find((scene) => !['DevToolsScene', 'GameHudScene'].includes(scene.scene.key));
    active?.scene.restart();
  }

  private room(): CapsuleRoomScene | undefined {
    const scene = this.scene.manager.getScene('CapsuleRoomScene') as CapsuleRoomScene;
    return scene.scene.isActive() ? scene : undefined;
  }

  private previewNextState(): void {
    this.stateIndex = (this.stateIndex + 1) % PET_STATES.length;
    this.room()?.devPreviewPetState(PET_STATES[this.stateIndex] as PetState);
  }

  private toggleZones(): void {
    this.zonesVisible = !this.zonesVisible;
    this.room()?.devShowInteractionZones(this.zonesVisible);
  }

  private changeTimeScale(delta: number): void {
    this.tweens.timeScale = Phaser.Math.Clamp(this.tweens.timeScale + delta, 0.2, 3);
  }

  private async copyState(): Promise<void> {
    const { accessibility, runtime } = getGameServices(this);
    await navigator.clipboard?.writeText(
      JSON.stringify({
        scene: this.scene.manager.getScenes(true).map((scene) => scene.scene.key),
        runtime,
        accessibility: accessibility.get(),
      }),
    );
  }

  private refreshStatus(): void {
    if (!this.status) return;
    const { accessibility } = getGameServices(this);
    this.status.setText(
      `FPS ${Math.round(this.game.loop.actualFps)} · zones ${this.zonesVisible ? 'on' : 'off'} · particles ${accessibility.get().particles ? 'on' : 'off'} · sound ${accessibility.get().sound ? 'on' : 'off'} · speed ${this.tweens.timeScale.toFixed(1)}x`,
    );
  }
}
