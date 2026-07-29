import Phaser from 'phaser';
import { applyDirectionalMove, clampToBounds, type Direction } from '@pamagochi/game-core';
import type { GameBridge } from '../bridge/game-bridge.js';

const MOVE_STEP_PX = 4;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 500;

export interface MainSceneConfig {
  bridge: GameBridge;
  activeChildName: string;
}

/**
 * Phaser owns only the canvas, scenes, game objects, input and animation
 * loop. All player-facing state (active child, forms, navigation) lives in
 * React and is passed in only through `MainSceneConfig` + the GameBridge.
 */
export class MainScene extends Phaser.Scene {
  private character?: Phaser.GameObjects.Arc;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private bridge!: GameBridge;
  private activeChildName = 'друг';
  private unsubscribe?: () => void;

  constructor() {
    super('main');
  }

  init(config: MainSceneConfig): void {
    this.bridge = config.bridge;
    this.activeChildName = config.activeChildName;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#bde0fe');

    this.add
      .text(WORLD_WIDTH / 2, 40, 'Памагочи: первый запуск', {
        fontSize: '28px',
        color: '#1d3557',
        fontFamily: 'sans-serif',
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(WORLD_WIDTH / 2, 80, `Активный профиль: ${this.activeChildName}`, {
        fontSize: '16px',
        color: '#457b9d',
        fontFamily: 'sans-serif',
      })
      .setOrigin(0.5, 0.5);

    this.character = this.add.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 24, 0xf4a261);

    this.cursors = this.input.keyboard?.createCursorKeys();

    this.unsubscribe = this.bridge.onReactToGameEvent((event) => {
      if (event.type === 'set-active-child') {
        this.activeChildName = event.childName;
      }
    });

    this.bridge.sendToReact({ type: 'scene-ready', sceneKey: 'main' });
  }

  override update(): void {
    if (!this.character || !this.cursors) return;

    let direction: Direction | undefined;
    if (this.cursors.left.isDown) direction = 'left';
    else if (this.cursors.right.isDown) direction = 'right';
    else if (this.cursors.up.isDown) direction = 'up';
    else if (this.cursors.down.isDown) direction = 'down';

    if (!direction) return;

    const moved = applyDirectionalMove(
      { x: this.character.x, y: this.character.y },
      direction,
      MOVE_STEP_PX,
    );
    const clamped = clampToBounds(moved, {
      minX: 24,
      maxX: WORLD_WIDTH - 24,
      minY: 24,
      maxY: WORLD_HEIGHT - 24,
    });
    this.character.setPosition(clamped.x, clamped.y);
  }

  shutdown(): void {
    this.unsubscribe?.();
  }
}

export const GAME_WORLD_SIZE = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
