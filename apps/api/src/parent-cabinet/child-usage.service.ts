import { Injectable } from '@nestjs/common';
import { aggregateSessionCosts } from '@pamagochi/agent-core';
import type { ChildUsageSummaryDto } from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ChildUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailySummary(childId: string): Promise<ChildUsageSummaryDto> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

    const sessions = await this.prisma.client.conversationSession.findMany({
      where: {
        childId,
        startedAt: { gte: periodStart, lt: periodEnd },
        status: { in: ['active', 'finalizing', 'completed', 'failed'] },
      },
      select: {
        costInputTokens: true,
        costOutputTokens: true,
        costTtsChars: true,
        costSttSeconds: true,
      },
    });

    const totals = aggregateSessionCosts(sessions);

    return {
      childId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      sessionCount: sessions.length,
      totals: {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        ttsChars: totals.ttsChars,
        sttSeconds: totals.sttSeconds,
        estimatedCostUsd: Math.round(totals.estimatedCostUsd * 1_000_000) / 1_000_000,
      },
    };
  }

  async getGlobalDailySummary(): Promise<{
    periodStart: string;
    periodEnd: string;
    sessionCount: number;
    totals: ChildUsageSummaryDto['totals'];
  }> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

    const sessions = await this.prisma.client.conversationSession.findMany({
      where: {
        startedAt: { gte: periodStart, lt: periodEnd },
        status: { in: ['active', 'finalizing', 'completed', 'failed'] },
      },
      select: {
        costInputTokens: true,
        costOutputTokens: true,
        costTtsChars: true,
        costSttSeconds: true,
      },
    });

    const totals = aggregateSessionCosts(sessions);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      sessionCount: sessions.length,
      totals: {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        ttsChars: totals.ttsChars,
        sttSeconds: totals.sttSeconds,
        estimatedCostUsd: Math.round(totals.estimatedCostUsd * 1_000_000) / 1_000_000,
      },
    };
  }
}
