import { Injectable } from '@nestjs/common';
import type { PaginatedSafetyEventsResponse, SafetyEventsQuery } from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ParentSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(childId: string, query: SafetyEventsQuery): Promise<PaginatedSafetyEventsResponse> {
    const events = await this.prisma.client.safetyEvent.findMany({
      where: {
        childId,
        parentVisible: true,
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
    });

    const hasMore = events.length > query.limit;
    const page = hasMore ? events.slice(0, query.limit) : events;

    return {
      items: page.map((event) => ({
        id: event.id,
        childId: event.childId,
        conversationSessionId: event.conversationSessionId,
        turnId: event.turnId,
        category: event.category,
        severity: event.severity,
        detectedBy: event.detectedBy,
        inputExcerpt: event.inputExcerpt,
        actionTaken: event.actionTaken,
        parentVisible: event.parentVisible,
        createdAt: event.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}
