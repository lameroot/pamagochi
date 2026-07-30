import { describe, expect, it, vi } from 'vitest';
import { RetentionCleanupService } from './retention-cleanup.service.js';

describe('RetentionCleanupService (E6.4)', () => {
  it('hard-deletes memory past retention window', async () => {
    const oldDeletedAt = new Date('2026-01-01T00:00:00.000Z');
    const memoryVersionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const memoryItemDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      client: {
        memoryItem: {
          findMany: async () => [{ id: 'm1', deletedAt: oldDeletedAt }],
          deleteMany: memoryItemDeleteMany,
        },
        memoryVersion: { deleteMany: memoryVersionDeleteMany },
        conversationSession: {
          findMany: async () => [],
        },
        gameSession: {
          findMany: async () => [],
          updateMany: async () => ({ count: 0 }),
        },
        $transaction: async (ops: unknown[]) => {
          for (const op of ops) await op;
        },
      },
    };

    const service = new RetentionCleanupService(prisma as never);
    const result = await service.run({ nowIso: '2026-07-30T00:00:00.000Z' });

    expect(result.memoriesDeleted).toBe(1);
    expect(memoryVersionDeleteMany).toHaveBeenCalled();
    expect(memoryItemDeleteMany).toHaveBeenCalled();
  });

  it('is idempotent when nothing eligible', async () => {
    const prisma = {
      client: {
        memoryItem: { findMany: async () => [] },
        conversationSession: { findMany: async () => [] },
        gameSession: {
          findMany: async () => [],
          updateMany: async () => ({ count: 0 }),
        },
      },
    };
    const service = new RetentionCleanupService(prisma as never);
    const r1 = await service.run();
    const r2 = await service.run();
    expect(r1).toEqual({ memoriesDeleted: 0, conversationsPurged: 0, expiredSessionsRevoked: 0 });
    expect(r2).toEqual(r1);
  });
});
