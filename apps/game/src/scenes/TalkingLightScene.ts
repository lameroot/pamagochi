import Phaser from 'phaser';
import type { AgentState } from '@pamagochi/contracts';

/** Technical E1 scene scaffold — glowing light without React UI. */
export class TalkingLightScene extends Phaser.Scene {
  private light?: Phaser.GameObjects.Arc;
  private agentState: AgentState = 'connecting';

  constructor() {
    super('TalkingLightScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1020');
    this.light = this.add.circle(480, 270, 48, 0x7dd3fc, 0.9);
    this.setAgentState('listening');
  }

  setAgentState(state: AgentState): void {
    this.agentState = state;
    if (!this.light) return;
    const colors: Record<AgentState, number> = {
      connecting: 0x64748b,
      listening: 0x38bdf8,
      thinking: 0xa78bfa,
      speaking: 0x34d399,
      interrupted: 0xfbbf24,
      reconnecting: 0xfb923c,
      unavailable: 0xf87171,
    };
    this.light.setFillStyle(colors[state], 0.95);
  }

  getAgentState(): AgentState {
    return this.agentState;
  }
}
