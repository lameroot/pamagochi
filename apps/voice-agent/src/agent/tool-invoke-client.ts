import type { AgentToolRequest, AgentToolResult } from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import { egressFetch } from '../safety/egress-fetch.js';

export class ToolInvokeClient {
  constructor(private readonly env: VoiceAgentEnv) {}

  async invoke(
    conversationSessionId: string,
    sceneKey: string,
    request: AgentToolRequest,
    turnId?: string,
    sceneState?: string,
  ): Promise<AgentToolResult> {
    const url = `${this.env.VOICE_AGENT_INTERNAL_API_URL.replace(/\/$/, '')}/sessions/${conversationSessionId}/tools`;
    const response = await egressFetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.VOICE_AGENT_SERVICE_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ sceneKey, sceneState, request, turnId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to invoke tool (status ${response.status})`);
    }
    const json: unknown = await response.json();
    return json as AgentToolResult;
  }
}
