import { voiceSessionContextSchema, type VoiceSessionContext } from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import { egressFetch } from '../safety/egress-fetch.js';

export class SessionContextClient {
  constructor(private readonly env: VoiceAgentEnv) {}

  async fetch(gameSessionId: string): Promise<VoiceSessionContext> {
    const url = `${this.env.VOICE_AGENT_INTERNAL_API_URL.replace(/\/$/, '')}/sessions/${gameSessionId}/context`;
    const response = await egressFetch(url, {
      headers: {
        authorization: `Bearer ${this.env.VOICE_AGENT_SERVICE_TOKEN}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session context (status ${response.status})`);
    }

    const json: unknown = await response.json();
    return voiceSessionContextSchema.parse(json);
  }
}
