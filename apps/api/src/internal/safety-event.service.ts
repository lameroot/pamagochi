import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSafetyEventRequest, SafetyEventDto } from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';
import type { SafetyCategory, SafetySeverity } from '@pamagochi/database';

function toDto(event: {
  id: string;
  childId: string;
  conversationSessionId: string | null;
  turnId: string | null;
  category: SafetyCategory;
  severity: SafetySeverity;
  detectedBy: string;
  inputExcerpt: string | null;
  actionTaken: string;
  parentVisible: boolean;
  createdAt: Date;
}): SafetyEventDto {
  return {
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
  };
}

@Injectable()
export class SafetyEventService {
  constructor(private readonly prisma: PrismaService) {}

  async createForSession(
    conversationSessionId: string,
    body: CreateSafetyEventRequest,
  ): Promise<SafetyEventDto> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
      include: { child: true },
    });
    if (!session || session.child.deletedAt) {
      throw new NotFoundException('Conversation session is not available');
    }

    if (body.turnId) {
      const turn = await this.prisma.client.conversationTurn.findFirst({
        where: { id: body.turnId, conversationSessionId },
      });
      if (!turn) {
        throw new NotFoundException('Turn is not available for this session');
      }
    }

    const event = await this.prisma.client.safetyEvent.create({
      data: {
        childId: session.childId,
        conversationSessionId,
        turnId: body.turnId ?? null,
        category: body.category,
        severity: body.severity,
        detectedBy: body.detectedBy,
        inputExcerpt: body.inputExcerpt?.slice(0, 280) ?? null,
        actionTaken: body.actionTaken,
        parentVisible: body.parentVisible,
      },
    });

    return toDto(event);
  }

  async listForChild(childId: string, parentId: string): Promise<SafetyEventDto[]> {
    const child = await this.prisma.client.childProfile.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parentId || child.deletedAt) {
      throw new NotFoundException('Child profile was not found');
    }

    const events = await this.prisma.client.safetyEvent.findMany({
      where: { childId, parentVisible: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return events.map(toDto);
  }
}
