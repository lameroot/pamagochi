import type { VoiceAgentEnv } from '../config/env.schema.js';
import { egressFetch } from '../safety/egress-fetch.js';

export interface UsageDelta {
  costInputTokens?: number;
  costOutputTokens?: number;
  costTtsChars?: number;
  costSttSeconds?: number;
}

export class UsageClient {
  constructor(private readonly env: VoiceAgentEnv) {}

  async record(conversationSessionId: string, usage: UsageDelta): Promise<void> {
    const url = `${this.env.VOICE_AGENT_INTERNAL_API_URL.replace(/\/$/, '')}/sessions/${conversationSessionId}/usage`;
    const response = await egressFetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.VOICE_AGENT_SERVICE_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(usage),
    });
    if (!response.ok) {
      throw new Error(`Failed to record usage (status ${response.status})`);
    }
  }
}
