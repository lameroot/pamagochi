import Phaser from 'phaser';
import type { AgentState, CharacterEmotion, IntroProgressDto } from '@pamagochi/contracts';
import type { IntroState } from '@pamagochi/game-protocol';
import {
  agentStateAccentColor,
  agentStatePulseScale,
  emotionAccentColor,
  GameVoiceBridge,
} from '../protocol/game-voice-bridge.js';
import { fetchGameBootstrap, readLimitedGameTokenFromUrl } from '../protocol/bootstrap-client.js';
import { LiveKitVoiceClient } from '../voice/livekit-voice-client.js';
import type { VoiceClient } from '../voice/voice-client.js';
import { IntroEngine } from '../intro/intro-engine.js';
import {
  createHttpIntroProgressClient,
  type IntroProgressClient,
} from '../intro/intro-progress-client.js';

interface SceneObjects {
  hull: Phaser.GameObjects.Rectangle;
  floor: Phaser.GameObjects.Rectangle;
  capsule: Phaser.GameObjects.Ellipse;
  capsuleGlass: Phaser.GameObjects.Ellipse;
  voiceLight: Phaser.GameObjects.Arc;
  voiceGlow: Phaser.GameObjects.Arc;
  console: Phaser.GameObjects.Rectangle;
  consoleLabel: Phaser.GameObjects.Text;
  powerCell: Phaser.GameObjects.Rectangle;
  powerSlot: Phaser.GameObjects.Rectangle;
  character: Phaser.GameObjects.Ellipse;
  statusText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  highlightRing?: Phaser.GameObjects.Arc;
}

/** Ship + capsule first-meeting scene (E5) — Phaser-only UX, no React/HTML controls. */
export class ShipCapsuleScene extends Phaser.Scene {
  private objects?: SceneObjects;
  private intro?: IntroEngine;
  private voiceBridge?: GameVoiceBridge;
  private voiceClient?: VoiceClient;
  private agentState: AgentState = 'connecting';
  private pulseTween?: Phaser.Tweens.Tween;
  private limitedToken: string | null = null;
  private progressClient?: IntroProgressClient;

  constructor(
    private readonly deps: {
      voiceClientFactory?: () => VoiceClient;
      progressClientFactory?: (token: string) => IntroProgressClient;
    } = {},
  ) {
    super('ShipCapsuleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#050810');
    this.objects = this.buildSceneGraph();
    this.limitedToken = readLimitedGameTokenFromUrl();
    void this.bootstrap();
  }

  shutdown(): void {
    this.voiceBridge?.detach();
    void this.voiceClient?.disconnect();
    this.pulseTween?.stop();
  }

  getIntroState(): IntroState | undefined {
    return this.intro?.getState();
  }

  getAgentState(): AgentState {
    return this.agentState;
  }

  setAgentState(state: AgentState): void {
    this.agentState = state;
    const objs = this.objects;
    if (!objs) return;

    const color = agentStateAccentColor(state);
    objs.voiceLight.setFillStyle(color, state === 'unavailable' ? 0.35 : 0.95);
    objs.voiceGlow.setFillStyle(color, state === 'unavailable' ? 0.05 : 0.2);

    this.pulseTween?.stop();
    const scale = agentStatePulseScale(state);
    this.pulseTween = this.tweens.add({
      targets: [objs.voiceLight, objs.voiceGlow],
      scaleX: scale,
      scaleY: scale,
      duration: state === 'thinking' ? 500 : state === 'reconnecting' ? 1200 : 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (state === 'unavailable') {
      objs.hintText.setText('Попроси взрослого помочь с подключением');
      objs.hintText.setVisible(true);
    } else if (state === 'reconnecting') {
      objs.hintText.setText('Связь восстанавливается…');
      objs.hintText.setVisible(true);
    } else {
      objs.hintText.setVisible(false);
    }
  }

  playCharacterEmote(emotion: CharacterEmotion): void {
    const objs = this.objects;
    if (!objs) return;
    const accent = emotionAccentColor(emotion);
    objs.voiceLight.setFillStyle(accent, 1);
    this.tweens.add({
      targets: objs.voiceLight,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 240,
      yoyo: true,
      onComplete: () => this.setAgentState(this.agentState),
    });
  }

  private buildSceneGraph(): SceneObjects {
    const cx = 480;
    const floorY = 420;

    const hull = this.add.rectangle(cx, 270, 900, 480, 0x111827, 0.9).setStrokeStyle(2, 0x1e293b);
    const floor = this.add.rectangle(cx, floorY, 860, 24, 0x334155);

    const capsule = this.add
      .ellipse(cx, 300, 180, 260, 0x0f172a)
      .setStrokeStyle(3, 0x475569)
      .setInteractive({ useHandCursor: true });

    const capsuleGlass = this.add.ellipse(cx, 300, 150, 220, 0x38bdf8, 0.08);

    const voiceGlow = this.add.circle(cx, 280, 40, 0x7dd3fc, 0.15);
    const voiceLight = this.add.circle(cx, 280, 24, 0x7dd3fc, 0.9);

    const console = this.add
      .rectangle(780, 360, 120, 80, 0x1e3a5f)
      .setStrokeStyle(2, 0x38bdf8)
      .setInteractive({ useHandCursor: true });

    const consoleLabel = this.add
      .text(780, 360, 'PWR', { fontSize: '20px', color: '#7dd3fc' })
      .setOrigin(0.5);

    const powerCell = this.add
      .rectangle(200, 360, 48, 72, 0x22c55e, 0)
      .setStrokeStyle(2, 0x22c55e, 0)
      .setInteractive({ useHandCursor: true });

    const powerSlot = this.add
      .rectangle(720, 360, 56, 56, 0x14532d, 0.4)
      .setStrokeStyle(2, 0x22c55e, 0.3);

    const character = this.add.ellipse(cx, 290, 60, 80, 0xfbbf24, 0).setStrokeStyle(2, 0xfbbf24, 0);

    const statusText = this.add
      .text(24, 20, '', { fontSize: '14px', color: '#94a3b8' })
      .setVisible(false);

    const hintText = this.add
      .text(cx, 500, '', { fontSize: '16px', color: '#fbbf24', align: 'center' })
      .setOrigin(0.5)
      .setVisible(false);

    console.on('pointerdown', () => void this.onConsoleActivated());
    powerCell.on('pointerdown', () => void this.onPowerCellTapped());
    powerSlot.on('pointerdown', () => void this.onPowerCellInserted());
    capsule.on('pointerdown', () => void this.onCapsuleTapped());

    return {
      hull,
      floor,
      capsule,
      capsuleGlass,
      voiceLight,
      voiceGlow,
      console,
      consoleLabel,
      powerCell,
      powerSlot,
      character,
      statusText,
      hintText,
    };
  }

  private async bootstrap(): Promise<void> {
    if (!this.limitedToken) {
      this.setAgentState('unavailable');
      return;
    }

    try {
      const boot = await fetchGameBootstrap(this.limitedToken);
      const progress: IntroProgressDto = boot.introProgress ?? {
        state: 'SHIP_DARK',
        sharedEvents: [],
        completed: false,
        updatedAt: new Date().toISOString(),
      };

      this.progressClient =
        this.deps.progressClientFactory?.(this.limitedToken) ??
        (await createHttpIntroProgressClient(this.limitedToken));

      this.intro = new IntroEngine({
        initialProgress: progress,
        client: this.progressClient,
        onStateChange: (state) => this.applyIntroVisuals(state),
      });
      this.intro.onStateChange((state) => this.applyIntroVisuals(state));
      this.applyIntroVisuals(this.intro.getState());

      const voiceFactory = this.deps.voiceClientFactory ?? (() => new LiveKitVoiceClient());
      this.voiceClient = voiceFactory();
      this.voiceBridge = new GameVoiceBridge(this.voiceClient, {
        onAgentState: (state) => this.setAgentState(state),
        onCharacterEmote: (emotion) => this.playCharacterEmote(emotion),
        onCharacterGesture: (gesture) => this.playGesture(gesture),
        onHighlightObject: (objectId) => this.flashHighlight(objectId),
        onSceneEventRequest: (eventId, callId) => {
          void this.intro?.handleSceneEventRequest(eventId, callId);
        },
        onParentAttentionRequest: () => {
          this.objects?.hintText.setText('Позови взрослого — нужна помощь').setVisible(true);
        },
      });
      this.voiceBridge.attach();

      await this.voiceClient.connect({
        url: boot.livekit.url,
        token: boot.livekit.token,
      });

      if (this.intro.getState() === 'SHIP_POWERED') {
        await this.intro.advanceTo('VOICE_CONNECTION_READY', {
          idempotencyKey: `voice-ready-${boot.gameSessionId}`,
          sharedEvent: 'voice_link_ready',
        });
      }
      if (
        this.intro.getState() === 'VOICE_CONNECTION_READY' &&
        this.voiceClient.getAgentState() === 'listening'
      ) {
        await this.intro.advanceTo('FIRST_VOICE_CONTACT', {
          idempotencyKey: `first-voice-${boot.gameSessionId}`,
          sharedEvent: 'first_voice_contact',
        });
      }
    } catch {
      this.setAgentState('unavailable');
    }
  }

  private applyIntroVisuals(state: IntroState): void {
    const objs = this.objects;
    if (!objs) return;

    const dark = state === 'SHIP_DARK';
    objs.hull.setFillStyle(dark ? 0x050810 : 0x111827, 0.95);
    objs.console.setAlpha(dark ? 0.6 : 1);
    objs.voiceLight.setAlpha(['SHIP_DARK', 'SHIP_POWERED'].includes(state) ? 0.2 : 1);

    const showPowerCell = [
      'FIRST_VOICE_CONTACT',
      'POWER_CELL_DISCOVERED',
      'POWER_RESTORED',
    ].includes(state);
    objs.powerCell.setAlpha(showPowerCell ? 1 : 0);
    objs.powerCell.setFillStyle(0x22c55e, showPowerCell ? 0.85 : 0);
    objs.powerCell.setStrokeStyle(2, 0x22c55e, showPowerCell ? 1 : 0);

    const powerRestored = [
      'POWER_RESTORED',
      'CAPSULE_OPENING',
      'FIRST_MEETING',
      'INTRO_COMPLETED',
    ].includes(state);
    objs.powerSlot.setFillStyle(0x14532d, powerRestored ? 0.8 : 0.4);

    const capsuleOpen = ['CAPSULE_OPENING', 'FIRST_MEETING', 'INTRO_COMPLETED'].includes(state);
    objs.capsuleGlass.setAlpha(capsuleOpen ? 0.02 : 0.08);
    objs.character.setAlpha(capsuleOpen ? 0.95 : 0);

    if (state === 'CAPSULE_OPENING') {
      this.tweens.add({
        targets: [objs.capsule, objs.capsuleGlass],
        scaleY: 0.6,
        y: 320,
        duration: 1800,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          void this.intro?.advanceTo('FIRST_MEETING', {
            idempotencyKey: `capsule-opened-${Date.now()}`,
            sharedEvent: 'capsule_opened',
          });
        },
      });
    }

    objs.statusText.setVisible(false);
  }

  private async onConsoleActivated(): Promise<void> {
    if (!this.intro) return;
    const state = this.intro.getState();
    if (state === 'SHIP_DARK') {
      await this.intro.advanceTo('SHIP_POWERED', {
        idempotencyKey: `console-power-${Date.now()}`,
        sharedEvent: 'ship_powered',
      });
      this.tweens.add({
        targets: this.objects!.hull,
        alpha: { from: 0.7, to: 1 },
        duration: 600,
      });
    }
  }

  private async onPowerCellTapped(): Promise<void> {
    if (!this.intro) return;
    if (this.intro.getState() === 'FIRST_VOICE_CONTACT') {
      await this.intro.advanceTo('POWER_CELL_DISCOVERED', {
        idempotencyKey: `power-discovered-${Date.now()}`,
        sharedEvent: 'power_cell_discovered',
      });
      this.objects?.powerCell.setPosition(680, 360);
    }
  }

  private async onPowerCellInserted(): Promise<void> {
    if (!this.intro) return;
    if (this.intro.getState() === 'POWER_CELL_DISCOVERED') {
      await this.intro.advanceTo('POWER_RESTORED', {
        idempotencyKey: `power-restored-${Date.now()}`,
        sharedEvent: 'power_restored',
      });
    }
  }

  private async onCapsuleTapped(): Promise<void> {
    if (!this.intro) return;
    if (this.intro.getState() === 'POWER_RESTORED') {
      await this.intro.advanceTo('CAPSULE_OPENING', {
        idempotencyKey: `capsule-open-player-${Date.now()}`,
        sharedEvent: 'OPEN_CAPSULE',
      });
    }
    if (this.intro.getState() === 'FIRST_MEETING') {
      await this.intro.advanceTo('INTRO_COMPLETED', {
        idempotencyKey: `intro-complete-${Date.now()}`,
        sharedEvent: 'COMPLETE_INTRO',
      });
    }
  }

  private playGesture(gesture: string): void {
    const objs = this.objects;
    if (!objs) return;
    const target = objs.character.alpha > 0 ? objs.character : objs.voiceLight;
    if (gesture === 'wave' || gesture === 'nod') {
      this.tweens.add({
        targets: target,
        angle: gesture === 'wave' ? 12 : 0,
        yoyo: true,
        duration: 200,
      });
    }
  }

  private flashHighlight(objectId: string): void {
    const objs = this.objects;
    if (!objs) return;
    objs.highlightRing?.destroy();
    const target =
      objectId === 'power_cell'
        ? objs.powerCell
        : objectId === 'ship_console'
          ? objs.console
          : objs.capsule;
    const ring = this.add.circle(target.x, target.y, 60, 0xfbbf24, 0);
    ring.setStrokeStyle(3, 0xfbbf24, 0.9);
    objs.highlightRing = ring;
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 900,
      onComplete: () => ring.destroy(),
    });
  }
}
