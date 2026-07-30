import {
  appendConversationTurnRequestSchema,
  type AppendConversationTurnRequest,
  type AppendConversationTurnResponse,
  finalizeConversationSessionRequestSchema,
} from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';

export class TranscriptClient {
  constructor(private readonly env: VoiceAgentEnv) {}

  async appendTurn(
    conversationSessionId: string,
    turn: AppendConversationTurnRequest,
  ): Promise<AppendConversationTurnResponse> {
    const body = appendConversationTurnRequestSchema.parse(turn);
    const url = `${this.env.VOICE_AGENT_INTERNAL_API_URL.replace(/\/$/, '')}/sessions/${conversationSessionId}/turns`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.VOICE_AGENT_SERVICE_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to append turn (status ${response.status})`);
    }
    const json: unknown = await response.json();
    return json as AppendConversationTurnResponse;
  }

  async finalize(
    conversationSessionId: string,
    input: { status?: 'completed' | 'failed' | 'cancelled'; sessionSummary?: string } = {},
  ): Promise<void> {
    const body = finalizeConversationSessionRequestSchema.parse(input);
    const url = `${this.env.VOICE_AGENT_INTERNAL_API_URL.replace(/\/$/, '')}/sessions/${conversationSessionId}/finalize`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.VOICE_AGENT_SERVICE_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to finalize session (status ${response.status})`);
    }
  }
}
