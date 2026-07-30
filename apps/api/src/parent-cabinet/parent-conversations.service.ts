import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConversationDetailDto,
  ConversationListItemDto,
  ConversationsQuery,
  PaginatedConversationsResponse,
} from '@pamagochi/contracts';
import type { ConversationSpeaker } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

const CHAIN_OF_THOUGHT_KEYS = new Set([
  'chainOfThought',
  'chain_of_thought',
  'reasoning',
  'internalReasoning',
  'cot',
]);

function sanitizeMetadata(metadataJson: unknown): Record<string, unknown> {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadataJson)) {
    if (!CHAIN_OF_THOUGHT_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function durationSeconds(startedAt: Date, endedAt: Date | null): number | null {
  if (!endedAt) return null;
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

@Injectable()
export class ParentConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(childId: string, query: ConversationsQuery): Promise<PaginatedConversationsResponse> {
    const sessions = await this.prisma.client.conversationSession.findMany({
      where: {
        childId,
        status: { not: 'cancelled' },
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: query.limit + 1,
      include: {
        _count: { select: { turns: true, safetyEvents: true } },
      },
    });

    const hasMore = sessions.length > query.limit;
    const page = hasMore ? sessions.slice(0, query.limit) : sessions;

    const items: ConversationListItemDto[] = page.map((session) => ({
      id: session.id,
      childId: session.childId,
      gameSessionId: session.gameSessionId,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      sessionSummary: session.sessionSummary,
      turnCount: session._count.turns,
      durationSeconds: durationSeconds(session.startedAt, session.endedAt),
      safetyFlagCount: session._count.safetyEvents,
    }));

    return {
      items,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getDetail(childId: string, conversationId: string): Promise<ConversationDetailDto> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationId },
      include: {
        turns: { orderBy: { sequenceNo: 'asc' } },
        toolCalls: { orderBy: { createdAt: 'asc' } },
        safetyEvents: {
          where: { parentVisible: true },
          orderBy: { createdAt: 'asc' },
        },
        memoryItems: {
          where: { status: { not: 'deleted' } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session || session.childId !== childId || session.status === 'cancelled') {
      throw new NotFoundException('Conversation was not found');
    }

    const interruptedTurnCount = session.turns.filter((t) => t.wasInterrupted).length;

    return {
      id: session.id,
      childId: session.childId,
      gameSessionId: session.gameSessionId,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationSeconds: durationSeconds(session.startedAt, session.endedAt),
      sessionSummary: session.sessionSummary,
      soulVersion: session.soulVersion,
      safetyPolicyVersion: session.safetyPolicyVersion,
      llmProvider: session.llmProvider,
      llmModel: session.llmModel,
      turnCount: session.turns.length,
      interruptedTurnCount,
      turns: session.turns.map((turn) => ({
        id: turn.id,
        conversationSessionId: turn.conversationSessionId,
        sequenceNo: turn.sequenceNo,
        speaker: turn.speaker as ConversationSpeaker,
        text: turn.text,
        startedAt: turn.startedAt.toISOString(),
        endedAt: turn.endedAt?.toISOString() ?? null,
        wasInterrupted: turn.wasInterrupted,
        playedTextLength: turn.playedTextLength,
        safetyFlags: turn.safetyFlags,
        metadata: sanitizeMetadata(turn.metadataJson),
        createdAt: turn.createdAt.toISOString(),
      })),
      toolActions: session.toolCalls.map((tool) => ({
        id: tool.id,
        toolName: tool.toolName,
        validationResult: tool.validationResult,
        createdAt: tool.createdAt.toISOString(),
      })),
      safetyEvents: session.safetyEvents.map((event) => ({
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
      proposedMemory: session.memoryItems.map((item) => ({
        id: item.id,
        category: item.category,
        fact: item.fact,
        status: item.status,
      })),
    };
  }
}
