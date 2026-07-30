import { describe, expect, it } from 'vitest';
import { AgentConversationService } from './agent-conversation.service.js';

describe('AgentConversationService', () => {
  it('returns existing turn for duplicate idempotency key', async () => {
    const existingTurn = {
      id: 'turn-1',
      conversationSessionId: 'cs1',
      sequenceNo: 0,
      speaker: 'child' as const,
      text: 'hi',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      endedAt: null,
      wasInterrupted: false,
      playedTextLength: null,
      safetyFlags: [],
      metadataJson: {},
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    };

    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({ id: 'cs1', status: 'active' }),
        },
        conversationTurn: {
          findFirst: async () => existingTurn,
          create: async () => {
            throw new Error('should not create duplicate');
          },
        },
      },
    };

    const service = new AgentConversationService(prisma as never);
    const result = await service.appendTurn('cs1', {
      idempotencyKey: 'key-1',
      sequenceNo: 0,
      speaker: 'child',
      text: 'hi',
      startedAt: '2026-01-01T00:00:00.000Z',
      wasInterrupted: false,
      safetyFlags: [],
      metadata: {},
    });

    expect(result.created).toBe(false);
    expect(result.turn.id).toBe('turn-1');
  });
});
