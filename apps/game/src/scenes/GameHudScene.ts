import Phaser from 'phaser';
import { getGameServices } from './game-services.js';

/** Reserved parallel HUD scene. Its full subtitles and controls arrive with E7.4. */
export class GameHudScene extends Phaser.Scene {
  private subtitle?: Phaser.GameObjects.Text;
  constructor() {
    super({ key: 'GameHudScene', active: false });
  }

  create(): void {
    const { bridge, runtime } = getGameServices(this);
    this.add
      .text(22, 20, runtime.runtime.toUpperCase(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#dbeafe',
        backgroundColor: '#1e293b',
      })
      .setPadding(10, 6);
    this.add
      .text(22, 63, 'Микрофон: mock', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#cbd5e1',
      })
      .setPadding(6, 4);
    this.add
      .text(1258, 22, 'Esc — пропустить сцену', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#cbd5e1',
      })
      .setOrigin(1, 0)
      .setPadding(6, 4);
    this.subtitle = this.add
      .text(640, 620, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fff',
        stroke: '#111827',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 920 },
      })
      .setOrigin(0.5)
      .setDepth(100);
    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === 'subtitle') this.subtitle?.setText(event.text);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }
}
