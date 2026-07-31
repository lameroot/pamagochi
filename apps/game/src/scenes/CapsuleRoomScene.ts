import Phaser from 'phaser';
import { MockDialogueProvider } from '../adapters/dialogue/MockDialogueProvider.js';
import type { PetAction } from '../adapters/dialogue/DialogueProvider.js';
import { LocalStorageGameProgressRepository } from '../adapters/progress/LocalStorageGameProgressRepository.js';
import { Pamagochi } from '../entities/Pamagochi.js';
import type { InteractiveObjectDefinition } from '../prefabs/InteractiveObject.js';
import { GameActionExecutor } from '../systems/GameActionExecutor.js';
import { AudioManager } from '../systems/AudioManager.js';
import { getGameServices } from './game-services.js';

const WALKABLE_AREA = new Phaser.Geom.Rectangle(126, 470, 1030, 145);

/** First playable room: image-driven scene, Arcade collision, click/tap navigation. */
export class CapsuleRoomScene extends Phaser.Scene {
  private pet?: Pamagochi;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private foreground?: Phaser.GameObjects.Image;
  private debugZones?: Phaser.GameObjects.Graphics;
  private readonly dialogue = new MockDialogueProvider();
  private readonly progressRepository = new LocalStorageGameProgressRepository();
  private readonly interactiveObjects: Record<string, InteractiveObjectDefinition> = {
    console: {
      id: 'console',
      title: 'Консоль',
      interactionRadius: 92,
      enabled: true,
      prompt: 'Осмотреть консоль',
    },
    window: {
      id: 'window',
      title: 'Иллюминатор',
      interactionRadius: 120,
      enabled: true,
      prompt: 'Посмотреть в окно',
    },
    container: {
      id: 'container',
      title: 'Контейнер',
      interactionRadius: 90,
      enabled: true,
      prompt: 'Открыть контейнер',
    },
    egg_remains: {
      id: 'egg_remains',
      title: 'Остатки яйца',
      interactionRadius: 105,
      enabled: true,
      prompt: 'Осмотреть оболочку',
    },
  };

  constructor() {
    super('CapsuleRoomScene');
  }

  create(): void {
    const { bridge, runtime } = getGameServices(this);
    if (!this.scene.isActive('GameHudScene')) this.scene.launch('GameHudScene');
    bridge.emit({ type: 'scene-ready', scene: 'CapsuleRoomScene', runtime: runtime.runtime });
    this.cameras.main.setBackgroundColor('#07101f');
    this.add.image(640, 360, 'capsule-room').setDepth(0);
    this.foreground = this.add.image(640, 360, 'capsule-room-foreground').setDepth(25);
    this.createAnimations();
    this.pet = new Pamagochi(this, 642, 565);
    this.createCollisionWorld();
    this.createInteractiveZones();

    this.add
      .text(640, 670, 'Нажми на свободный пол, чтобы показать Памагочи комнату', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '19px',
        color: '#eff6ff',
        stroke: '#142033',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.pet || !WALKABLE_AREA.contains(pointer.worldX, pointer.worldY)) return;
      this.pet.walkTo(this.nearestWalkablePoint(pointer.worldX, pointer.worldY));
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Gentle 2.5D foreground response; capped so it never affects navigation coordinates.
      this.foreground?.setPosition(
        640 + (pointer.x - 640) * 0.012,
        360 + (pointer.y - 360) * 0.008,
      );
    });
    this.cursorKeys = this.input.keyboard?.createCursorKeys();
    if (import.meta.env.DEV)
      this.input.keyboard?.on('keydown-F2', () => this.scene.launch('DevToolsScene'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.removeAllListeners());
  }

  override update(): void {
    this.pet?.update();
    if (!this.pet || !this.cursorKeys) return;
    const x = Number(this.cursorKeys.right.isDown) - Number(this.cursorKeys.left.isDown);
    const y = Number(this.cursorKeys.down.isDown) - Number(this.cursorKeys.up.isDown);
    if (x || y) {
      this.pet.walkTo(this.nearestWalkablePoint(this.pet.x + x * 6, this.pet.y + y * 6));
    }
  }

  /** Public development hooks. They are only invoked by the dev-only scene. */
  devTeleport(x: number, y: number): void {
    if (!this.pet) return;
    const point = this.nearestWalkablePoint(x, y);
    this.pet.halt();
    this.pet.setPosition(point.x, point.y);
  }

  devPreviewPetState(state: import('../systems/PetStateMachine.js').PetState): void {
    this.pet?.previewPetState(state);
  }

  devShowInteractionZones(visible: boolean): void {
    this.debugZones?.setVisible(visible);
  }

  devTriggerMockInteraction(): void {
    void this.interact('console', new Phaser.Math.Vector2(248, 530));
  }

  private createAnimations(): void {
    if (!this.anims.exists('pamagochi-idle')) {
      this.anims.create({
        key: 'pamagochi-idle',
        frames: [{ key: 'pamagochi-idle' }],
        frameRate: 1,
        repeat: -1,
      });
    }
    if (!this.anims.exists('pamagochi-walk')) {
      this.anims.create({
        key: 'pamagochi-walk',
        frames: [{ key: 'pamagochi-idle' }, { key: 'pamagochi-walk' }],
        frameRate: 7,
        repeat: -1,
      });
    }
  }

  private createCollisionWorld(): void {
    this.physics.world.setBounds(
      WALKABLE_AREA.x,
      WALKABLE_AREA.y,
      WALKABLE_AREA.width,
      WALKABLE_AREA.height,
    );
    const obstacles: Phaser.GameObjects.Zone[] = [];
    const obstacleBounds = [
      [150, 545, 154, 154],
      [645, 550, 275, 130],
      [947, 548, 245, 132],
      [1160, 548, 125, 150],
    ] as const;
    for (const [x, y, width, height] of obstacleBounds) {
      const obstacle = this.add.zone(x, y, width, height).setVisible(false);
      this.physics.add.existing(obstacle, true);
      obstacles.push(obstacle);
    }
    for (const obstacle of obstacles) {
      if (this.pet) this.physics.add.collider(this.pet, obstacle);
    }
  }

  private nearestWalkablePoint(x: number, y: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, WALKABLE_AREA.left + 24, WALKABLE_AREA.right - 24),
      Phaser.Math.Clamp(y, WALKABLE_AREA.top + 48, WALKABLE_AREA.bottom - 16),
    );
  }

  private createInteractiveZones(): void {
    const locations: Record<string, Phaser.Math.Vector2> = {
      console: new Phaser.Math.Vector2(248, 530),
      window: new Phaser.Math.Vector2(934, 515),
      container: new Phaser.Math.Vector2(150, 560),
      egg_remains: new Phaser.Math.Vector2(525, 565),
    };
    this.debugZones = this.add.graphics().setDepth(60).setVisible(false);
    this.debugZones.lineStyle(2, 0x5eead4, 0.9);
    this.debugZones.strokeRectShape(WALKABLE_AREA);
    for (const [id, point] of Object.entries(locations)) {
      const definition = this.interactiveObjects[id];
      if (!definition) continue;
      const zone = this.add
        .zone(point.x, point.y, definition.interactionRadius * 2, 120)
        .setInteractive({ useHandCursor: true });
      zone.on(
        'pointerdown',
        (_: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          void this.interact(id, point);
        },
      );
      this.debugZones.strokeEllipse(point.x, point.y, definition.interactionRadius * 2, 120);
      this.debugZones.fillStyle(0x5eead4, 0.8).fillCircle(point.x, point.y, 4);
    }
  }

  private async interact(objectId: string, point: Phaser.Math.Vector2): Promise<void> {
    if (!this.pet || !this.interactiveObjects[objectId]?.enabled) return;
    const { bridge, accessibility } = getGameServices(this);
    this.pet.walkTo(point);
    this.playInteractionReaction(point);
    new AudioManager(this, accessibility).playCue('interact');
    bridge.emit({ type: 'subtitle', text: this.interactiveObjects[objectId].prompt ?? '' });
    this.time.delayedCall(650, async () => {
      const response = await this.dialogue.send({ objectId });
      const executor = new GameActionExecutor({
        hasObject: (id) => Boolean(this.interactiveObjects[id]),
        execute: (action: PetAction) => {
          if (action.type === 'speak') bridge.emit({ type: 'subtitle', text: action.text });
          if (action.type === 'look' || action.type === 'interact')
            this.pet?.setPetState('interacting');
          if (action.type === 'emote')
            this.pet?.setPetState(
              action.emotion === 'happy' || action.emotion === 'excited' ? 'happy' : 'curious',
            );
        },
      });
      executor.executeResponse(response);
      const progress = await this.progressRepository.load('mock-player');
      if (!progress.interactedObjectIds.includes(objectId)) {
        progress.interactedObjectIds.push(objectId);
        await this.progressRepository.save('mock-player', progress);
      }
    });
  }

  private playInteractionReaction(point: Phaser.Math.Vector2): void {
    const glow = this.add.circle(point.x, point.y - 42, 12, 0x8be9fd, 0.5).setDepth(35);
    this.tweens.add({
      targets: glow,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 380,
      ease: 'Sine.Out',
      onComplete: () => glow.destroy(),
    });
  }
}
