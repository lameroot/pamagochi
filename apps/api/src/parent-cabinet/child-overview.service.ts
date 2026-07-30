import { Injectable } from '@nestjs/common';
import type { ChildOverviewDto } from '@pamagochi/contracts';
import type { ChildProfile } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';
import { ageBandFromBirth } from '../game-sessions/age-band.js';

@Injectable()
export class ChildOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async build(child: ChildProfile): Promise<ChildOverviewDto> {
    const lastSession = await this.prisma.client.conversationSession.findFirst({
      where: { childId: child.id, status: { not: 'cancelled' } },
      orderBy: { startedAt: 'desc' },
    });

    const activeGameSession = await this.prisma.client.gameSession.findFirst({
      where: {
        childId: child.id,
        status: { in: ['pending', 'active'] },
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      childId: child.id,
      displayName: child.displayName,
      ageBand: ageBandFromBirth({
        birthYear: child.birthYear,
        birthDate: child.birthDate,
      }),
      avatarKey: child.avatarKey,
      lastSession: lastSession
        ? {
            conversationId: lastSession.id,
            startedAt: lastSession.startedAt.toISOString(),
            endedAt: lastSession.endedAt?.toISOString() ?? null,
            sessionSummary: lastSession.sessionSummary,
            status: lastSession.status,
          }
        : null,
      activeGameSessionId: activeGameSession?.id ?? null,
    };
  }
}
