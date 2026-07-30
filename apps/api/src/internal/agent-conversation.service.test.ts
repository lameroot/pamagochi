import { describe, expect, it, vi } from 'vitest';
import { AgentConversationService } from './agent-conversation.service.js';
import { SESSION_FINALIZE_JOB } from './session-finalize.service.js';

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
          findUnique: async () => ({ id: 'cs1', status: 'active', child: { deletedAt: null } }),
        },
        conversationTurn: {
          findFirst: async () => existingTurn,
          create: async () => {
            throw new Error('should not create duplicate');
          },
        },
      },
    };

    const jobs = { dispatch: vi.fn() };
    const service = new AgentConversationService(prisma as never, jobs as never);
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

  it('finalize is idempotent for terminal sessions', async () => {
    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({
            id: 'cs1',
            status: 'completed',
            child: { deletedAt: null },
          }),
          update: async () => {
            throw new Error('should not update');
          },
        },
      },
    };
    const jobs = { dispatch: vi.fn() };
    const service = new AgentConversationService(prisma as never, jobs as never);
    const result = await service.finalize('cs1', { status: 'completed' });
    expect(result.status).toBe('completed');
    expect(jobs.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches finalize job for active sessions', async () => {
    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({
            id: 'cs1',
            status: 'active',
            sessionSummary: null,
            child: { deletedAt: null },
          }),
          update: async () => ({ id: 'cs1', status: 'finalizing' }),
        },
      },
    };
    const jobs = { dispatch: vi.fn() };
    const service = new AgentConversationService(prisma as never, jobs as never);
    const result = await service.finalize('cs1', { status: 'completed' });
    expect(result.status).toBe('finalizing');
    expect(jobs.dispatch).toHaveBeenCalledWith(SESSION_FINALIZE_JOB, {
      conversationSessionId: 'cs1',
    });
  });

  it('does not redispatch finalize job for a session already finalizing', async () => {
    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({
            id: 'cs1',
            status: 'finalizing',
            child: { deletedAt: null },
          }),
          update: async () => {
            throw new Error('should not update');
          },
        },
      },
    };
    const jobs = { dispatch: vi.fn() };
    const service = new AgentConversationService(prisma as never, jobs as never);
    const result = await service.finalize('cs1', { status: 'completed' });
    expect(result.status).toBe('finalizing');
    expect(jobs.dispatch).not.toHaveBeenCalled();
  });

  it('rejects appending turns to a session that is finalizing', async () => {
    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({ id: 'cs1', status: 'finalizing', child: { deletedAt: null } }),
        },
        conversationTurn: {
          findFirst: async () => {
            throw new Error('should not be reached');
          },
        },
      },
    };
    const jobs = { dispatch: vi.fn() };
    const service = new AgentConversationService(prisma as never, jobs as never);
    await expect(
      service.appendTurn('cs1', {
        idempotencyKey: 'key-1',
        sequenceNo: 0,
        speaker: 'child',
        text: 'hi',
        startedAt: '2026-01-01T00:00:00.000Z',
        wasInterrupted: false,
        safetyFlags: [],
        metadata: {},
      }),
    ).rejects.toThrow();
  });
});
