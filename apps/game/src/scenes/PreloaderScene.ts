import Phaser from 'phaser';
import { getGameServices } from './game-services.js';

/** Shared asset loading boundary. Missing resources are surfaced, never thrown from a scene. */
export class PreloaderScene extends Phaser.Scene {
  private label?: Phaser.GameObjects.Text;
  private failedAssets: string[] = [];

  constructor() {
    super('PreloaderScene');
  }

  preload(): void {
    const { bridge } = getGameServices(this);
    bridge.emit({ type: 'loading', active: true, message: 'Готовим капсулу…' });

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      this.label?.setText(`Готовим капсулу… ${Math.round(progress * 100)}%`);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failedAssets.push(file.key);
      bridge.emit({ type: 'asset-error', assetKey: file.key });
    });
    this.load.svg('capsule-room', '/assets/environment/capsule-room.svg', {
      width: 1280,
      height: 720,
    });
    this.load.svg('capsule-room-foreground', '/assets/environment/capsule-room-foreground.svg', {
      width: 1280,
      height: 720,
    });
    this.load.svg('pamagochi-idle', '/assets/characters/pamagochi-idle.svg', {
      width: 160,
      height: 180,
    });
    this.load.svg('pamagochi-walk', '/assets/characters/pamagochi-walk.svg', {
      width: 160,
      height: 180,
    });
    this.load.svg('pamagochi-egg', '/assets/characters/pamagochi-egg.svg', {
      width: 220,
      height: 270,
    });
  }

  create(): void {
    const { runtime, bridge } = getGameServices(this);
    this.cameras.main.setBackgroundColor('#101827');
    this.label = this.add
      .text(640, 360, this.failedAssets.length ? 'Часть декораций не загрузилась' : 'Готово', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    bridge.emit({ type: 'loading', active: false });
    const target =
      runtime.startScene ??
      (runtime.runtime === 'local' || runtime.runtime === 'cloud'
        ? 'ShipCapsuleScene'
        : runtime.skipIntro
          ? 'HatchingScene'
          : 'HatchingScene');

    this.time.delayedCall(80, () => this.scene.start(target));
  }
}
