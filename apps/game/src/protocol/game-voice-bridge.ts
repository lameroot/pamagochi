import type { AgentState, AgentToolResult, CharacterEmotion } from '@pamagochi/contracts';
import type { VoiceClient } from '../voice/voice-client.js';

export interface GameVoiceBridgeHandlers {
  onAgentState(state: AgentState): void;
  onCharacterEmote?(emotion: CharacterEmotion): void;
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
    if (result.validation !== 'accepted') return;
    if (result.name !== 'character_emote') return;
    const emotion = result.gamePayload?.emotion;
    if (typeof emotion !== 'string') return;
    this.handlers.onCharacterEmote?.(emotion as CharacterEmotion);
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
