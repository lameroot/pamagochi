import Phaser from 'phaser';
import type { AgentState, CharacterEmotion } from '@pamagochi/contracts';
import {
  agentStatePulseScale,
  emotionAccentColor,
  GameVoiceBridge,
} from '../protocol/game-voice-bridge.js';
import { fetchGameBootstrap, readLimitedGameTokenFromUrl } from '../protocol/bootstrap-client.js';
import { LiveKitVoiceClient } from '../voice/livekit-voice-client.js';
import type { VoiceClient } from '../voice/voice-client.js';

const BASE_STATE_COLORS: Record<AgentState, number> = {
  connecting: 0x64748b,
  listening: 0x38bdf8,
  thinking: 0xa78bfa,
  speaking: 0x34d399,
  interrupted: 0xfbbf24,
  reconnecting: 0xfb923c,
  unavailable: 0xf87171,
};

/** Technical E1 scene — glowing light, voice bridge, child-safe visuals only. */
export class TalkingLightScene extends Phaser.Scene {
  private light?: Phaser.GameObjects.Arc;
  private glow?: Phaser.GameObjects.Arc;
  private agentState: AgentState = 'connecting';
  private pulseTween?: Phaser.Tweens.Tween;
  private emoteTween?: Phaser.Tweens.Tween;
  private voiceBridge?: GameVoiceBridge;
  private voiceClient?: VoiceClient;

  constructor(
    private readonly voiceClientFactory: () => VoiceClient = () => new LiveKitVoiceClient(),
  ) {
    super('TalkingLightScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1020');
    this.glow = this.add.circle(480, 270, 72, 0x7dd3fc, 0.15);
    this.light = this.add.circle(480, 270, 48, 0x7dd3fc, 0.9);
    this.setAgentState('connecting');
    void this.bootstrapVoice();
  }

  shutdown(): void {
    this.voiceBridge?.detach();
    void this.voiceClient?.disconnect();
  }

  setAgentState(state: AgentState): void {
    this.agentState = state;
    if (!this.light) return;

    const color = BASE_STATE_COLORS[state];
    this.light.setFillStyle(color, 0.95);
    this.glow?.setFillStyle(color, state === 'unavailable' ? 0.08 : 0.18);

    this.pulseTween?.stop();
    const scale = agentStatePulseScale(state);
    this.pulseTween = this.tweens.add({
      targets: [this.light, this.glow].filter(Boolean),
      scaleX: scale,
      scaleY: scale,
      duration: state === 'thinking' ? 500 : 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getAgentState(): AgentState {
    return this.agentState;
  }

  playCharacterEmote(emotion: CharacterEmotion): void {
    if (!this.light) return;
    const accent = emotionAccentColor(emotion);
    this.emoteTween?.stop();
    this.light.setFillStyle(accent, 1);
    this.emoteTween = this.tweens.add({
      targets: this.light,
      alpha: { from: 1, to: 0.75 },
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 280,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.setAgentState(this.agentState);
      },
    });
  }

  private async bootstrapVoice(): Promise<void> {
    const token = readLimitedGameTokenFromUrl();
    if (!token) {
      this.setAgentState('unavailable');
      return;
    }

    try {
      const boot = await fetchGameBootstrap(token);
      this.voiceClient = this.voiceClientFactory();
      this.voiceBridge = new GameVoiceBridge(this.voiceClient, {
        onAgentState: (state) => this.setAgentState(state),
        onCharacterEmote: (emotion) => this.playCharacterEmote(emotion),
      });
      this.voiceBridge.attach();
      await this.voiceClient.connect({
        url: boot.livekit.url,
        token: boot.livekit.token,
      });
    } catch {
      this.setAgentState('unavailable');
    }
  }
}
