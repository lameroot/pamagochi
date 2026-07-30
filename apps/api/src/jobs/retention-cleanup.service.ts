import { Injectable, Logger } from '@nestjs/common';
import { isEligibleForHardDelete } from '@pamagochi/agent-core';
import { PrismaService } from '../database/prisma.service.js';

export const RETENTION_HARD_DELETE_JOB = 'retention.hard-delete';

export interface RetentionHardDeletePayload {
  /** Optional batch size per entity type (default 100). */
  batchSize?: number;
  /** Override "now" for tests. */
  nowIso?: string;
}

export interface RetentionHardDeleteResult {
  memoriesDeleted: number;
  conversationsPurged: number;
  expiredSessionsRevoked: number;
}

@Injectable()
export class RetentionCleanupService {
  private readonly logger = new Logger(RetentionCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(payload: RetentionHardDeletePayload = {}): Promise<RetentionHardDeleteResult> {
    const now = payload.nowIso ? new Date(payload.nowIso) : new Date();
    const batchSize = payload.batchSize ?? 100;

    const memoriesDeleted = await this.hardDeleteMemories(now, batchSize);
    const conversationsPurged = await this.purgeCancelledConversations(now, batchSize);
    const expiredSessionsRevoked = await this.revokeExpiredGameSessions(now, batchSize);

    this.logger.log(
      `Retention cleanup: memories=${memoriesDeleted} conversations=${conversationsPurged} sessions=${expiredSessionsRevoked}`,
    );

    return { memoriesDeleted, conversationsPurged, expiredSessionsRevoked };
  }

  private async hardDeleteMemories(now: Date, batchSize: number): Promise<number> {
    const candidates = await this.prisma.client.memoryItem.findMany({
      where: { status: 'deleted', deletedAt: { not: null } },
      select: { id: true, deletedAt: true },
      take: batchSize * 2,
    });

    const eligible = candidates.filter((m) => isEligibleForHardDelete(m.deletedAt, now));
    if (eligible.length === 0) return 0;

    const ids = eligible.slice(0, batchSize).map((m) => m.id);
    await this.prisma.client.$transaction([
      this.prisma.client.memoryVersion.deleteMany({ where: { memoryItemId: { in: ids } } }),
      this.prisma.client.memoryItem.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return ids.length;
  }

  private async purgeCancelledConversations(now: Date, batchSize: number): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);

    const sessions = await this.prisma.client.conversationSession.findMany({
      where: {
        status: 'cancelled',
        endedAt: { lte: cutoff },
      },
      select: { id: true },
      take: batchSize,
    });

    if (sessions.length === 0) return 0;

    const ids = sessions.map((s) => s.id);
    await this.prisma.client.$transaction([
      this.prisma.client.safetyEvent.updateMany({
        where: { conversationSessionId: { in: ids } },
        data: { conversationSessionId: null },
      }),
      this.prisma.client.conversationSession.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return ids.length;
  }

  private async revokeExpiredGameSessions(now: Date, batchSize: number): Promise<number> {
    const candidates = await this.prisma.client.gameSession.findMany({
      where: {
        status: { in: ['pending', 'active'] },
        expiresAt: { lte: now },
        revokedAt: null,
      },
      select: { id: true },
      take: batchSize,
    });
    if (candidates.length === 0) return 0;

    const ids = candidates.map((c) => c.id);
    const result = await this.prisma.client.gameSession.updateMany({
      where: { id: { in: ids } },
      data: { status: 'expired', revokedAt: now },
    });

    return result.count;
  }
}
