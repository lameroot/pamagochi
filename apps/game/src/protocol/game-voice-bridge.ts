import type { AgentState, AgentToolResult, CharacterEmotion } from '@pamagochi/contracts';
import type { VoiceClient } from '../voice/voice-client.js';

export interface GameVoiceBridgeHandlers {
  onAgentState(state: AgentState): void;
  onCharacterEmote?(emotion: CharacterEmotion): void;
  onCharacterGesture?(gesture: string): void;
  onHighlightObject?(objectId: string, intensity: string): void;
  onSceneEventRequest?(eventId: string, callId: string): void;
  onParentAttentionRequest?(reason: string, summary: string): void;
}

/** Maps voice runtime events to Phaser-friendly callbacks (no React). */
export class GameVoiceBridge {
  private readonly unsubs: Array<() => void> = [];

  constructor(
    private readonly client: VoiceClient,
    private readonly handlers: GameVoiceBridgeHandlers,
  ) {}

  attach(): void {
    this.unsubs.push(
      this.client.onAgentState((state) => {
        this.handlers.onAgentState(state);
      }),
    );
    this.unsubs.push(
      this.client.onToolResult((result) => {
        this.handleToolResult(result);
      }),
    );
    this.handlers.onAgentState(this.client.getAgentState());
  }

  detach(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
  }

  private handleToolResult(result: AgentToolResult): void {
    if (result.validation !== 'accepted' || !result.gamePayload) return;
    const payload = result.gamePayload;

    switch (result.name) {
      case 'character_emote': {
        const emotion = payload.emotion;
        if (typeof emotion === 'string') {
          this.handlers.onCharacterEmote?.(emotion as CharacterEmotion);
        }
        break;
      }
      case 'character_gesture': {
        const gesture = payload.gesture;
        if (typeof gesture === 'string') this.handlers.onCharacterGesture?.(gesture);
        break;
      }
      case 'scene_highlight_object': {
        const objectId = payload.objectId;
        const intensity = payload.intensity;
        if (typeof objectId === 'string') {
          this.handlers.onHighlightObject?.(
            objectId,
            typeof intensity === 'string' ? intensity : 'normal',
          );
        }
        break;
      }
      case 'scene_request_event': {
        const eventId = payload.eventId;
        if (typeof eventId === 'string') {
          this.handlers.onSceneEventRequest?.(eventId, result.callId);
        }
        break;
      }
      case 'request_parent_attention': {
        const reason = payload.reason;
        const summary = payload.shortSummary;
        if (typeof reason === 'string' && typeof summary === 'string') {
          this.handlers.onParentAttentionRequest?.(reason, summary);
        }
        break;
      }
      default:
        break;
    }
  }
}

/** Visual pulse speed per agent state (Phaser tween multiplier). */
export function agentStatePulseScale(state: AgentState): number {
  switch (state) {
    case 'connecting':
    case 'reconnecting':
      return 0.6;
    case 'listening':
      return 1;
    case 'thinking':
      return 1.4;
    case 'speaking':
      return 1.8;
    case 'interrupted':
      return 2.2;
    case 'unavailable':
      return 0.3;
    default:
      return 1;
  }
}

/** Emotion accent colors for character_emote tool results. */
export function emotionAccentColor(emotion: CharacterEmotion): number {
  const colors: Record<CharacterEmotion, number> = {
    curious: 0x38bdf8,
    happy: 0x34d399,
    confused: 0xa78bfa,
    surprised: 0xfbbf24,
    calm: 0x7dd3fc,
  };
  return colors[emotion];
}

export function agentStateAccentColor(state: AgentState): number {
  const colors: Record<AgentState, number> = {
    connecting: 0x64748b,
    listening: 0x38bdf8,
    thinking: 0xa78bfa,
    speaking: 0x34d399,
    interrupted: 0xfbbf24,
    reconnecting: 0xfb923c,
    unavailable: 0xf87171,
  };
  return colors[state];
}
