import type { AgentState, AgentToolResult } from '@pamagochi/contracts';

/** Minimal voice runtime surface for Phaser scenes and tests. */
export interface VoiceClient {
  connect(config: { url: string; token: string }): Promise<void>;
  disconnect(): Promise<void>;
  getAgentState(): AgentState;
  onAgentState(handler: (state: AgentState) => void): () => void;
  onToolResult(handler: (result: AgentToolResult) => void): () => void;
}
