import { Injectable } from '@nestjs/common';
import {
  memoryPolicyValidator,
  activeMemoryWhere,
  selectMemoryForSession,
  type TranscriptTurn,
} from '@pamagochi/agent-core';
import type {
  MemoryContextDto,
  MemoryItemDto,
  MemoryProposal,
  RelationshipStateDto,
} from '@pamagochi/contracts';
import type {
  MemoryCategory,
  MemoryChangedBy,
  MemoryItemStatus,
  MemorySource,
  RelationshipStage,
} from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

function toMemoryDto(item: {
  id: string;
  childId: string;
  category: MemoryCategory;
  fact: string;
  status: MemoryItemStatus;
  source: MemorySource;
  confidence: number;
  priority: number;
  pinned: boolean;
  sourceSessionId: string | null;
  sourceTurnIds: string[];
  reviewAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MemoryItemDto {
  return {
    id: item.id,
    childId: item.childId,
    category: item.category,
    fact: item.fact,
    status: item.status,
    source: item.source,
    confidence: item.confidence,
    priority: item.priority,
    pinned: item.pinned,
    sourceSessionId: item.sourceSessionId,
    sourceTurnIds: item.sourceTurnIds,
    reviewAfter: item.reviewAfter?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toRelationshipDto(state: {
  childId: string;
  stage: RelationshipStage;
  trustProgress: number;
  sharedEventsJson: unknown;
  lastSessionAt: Date | null;
  updatedAt: Date;
}): RelationshipStateDto {
  const sharedEvents = Array.isArray(state.sharedEventsJson)
    ? (state.sharedEventsJson as string[])
    : [];
  return {
    childId: state.childId,
    stage: state.stage,
    trustProgress: state.trustProgress,
    sharedEvents,
    lastSessionAt: state.lastSessionAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
  };
}

@Injectable()
export class MemoryContextService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveForChild(childId: string): Promise<MemoryItemDto[]> {
    const items = await this.prisma.client.memoryItem.findMany({
      where: activeMemoryWhere(childId),
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return items.map(toMemoryDto);
  }

  async buildMemoryContext(childId: string): Promise<MemoryContextDto> {
    const [activeMemories, relationship, lastSession] = await Promise.all([
      this.listActiveForChild(childId),
      this.prisma.client.relationshipState.findUnique({ where: { childId } }),
      this.prisma.client.conversationSession.findFirst({
        where: { childId, status: 'completed', sessionSummary: { not: null } },
        orderBy: { endedAt: 'desc' },
      }),
    ]);

    const selection = selectMemoryForSession({
      activeMemories,
      previousSummary: lastSession?.sessionSummary ?? null,
      relationship: relationship ? toRelationshipDto(relationship) : null,
    });

    return {
      previousSummary: selection.previousSummary,
      memoryItems: selection.memoryItems,
      relationship: selection.relationship,
      selectionReasons: selection.selectionReasons,
    };
  }

  async persistAutomaticProposals(input: {
    childId: string;
    conversationSessionId: string;
    proposals: MemoryProposal[];
    childTurnTexts: string[];
  }): Promise<MemoryItemDto[]> {
    const existing = await this.prisma.client.memoryItem.findMany({
      where: { childId: input.childId, deletedAt: null, status: { not: 'deleted' } },
      select: { fact: true },
    });
    const existingFacts = existing.map((e) => e.fact);
    const created: MemoryItemDto[] = [];

    for (const proposal of input.proposals) {
      const validation = memoryPolicyValidator.validate(proposal, {
        existingFacts: [...existingFacts, ...created.map((c) => c.fact)],
        childTurnTexts: input.childTurnTexts,
      });
      if (!validation.accepted) continue;

      const item = await this.prisma.client.memoryItem.create({
        data: {
          childId: input.childId,
          category: proposal.category,
          fact: proposal.fact,
          status: 'active',
          source: 'automatic',
          confidence: proposal.confidence,
          sourceSessionId: input.conversationSessionId,
          sourceTurnIds: proposal.sourceTurnIds,
          reviewAfter: validation.reviewAfter ? new Date(validation.reviewAfter) : null,
        },
      });

      await this.prisma.client.memoryVersion.create({
        data: {
          memoryItemId: item.id,
          previousFact: null,
          newFact: item.fact,
          changedBy: 'system' satisfies MemoryChangedBy,
          reason: proposal.rationale,
        },
      });

      created.push(toMemoryDto(item));
      existingFacts.push(item.fact);
    }

    return created;
  }

  async updateRelationshipAfterSession(input: {
    childId: string;
    sessionEndedAt: Date;
    trustDelta?: number;
    sharedEvent?: string;
  }): Promise<RelationshipStateDto> {
    const existing = await this.prisma.client.relationshipState.findUnique({
      where: { childId: input.childId },
    });

    const stageOrder: RelationshipStage[] = [
      'first_meeting',
      'acquainted',
      'friends',
      'close_friends',
    ];
    const trustProgress = Math.min(1, (existing?.trustProgress ?? 0) + (input.trustDelta ?? 0.05));
    const currentStage = existing?.stage ?? 'first_meeting';
    const stageIndex = stageOrder.indexOf(currentStage);
    const nextStage =
      trustProgress >= 0.75 && stageIndex < stageOrder.length - 1
        ? stageOrder[stageIndex + 1]!
        : trustProgress >= 0.35 && stageIndex < 1
          ? 'acquainted'
          : currentStage;

    const sharedEvents = Array.isArray(existing?.sharedEventsJson)
      ? [...(existing.sharedEventsJson as string[])]
      : [];
    if (input.sharedEvent && !sharedEvents.includes(input.sharedEvent)) {
      sharedEvents.push(input.sharedEvent.slice(0, 128));
    }

    const state = await this.prisma.client.relationshipState.upsert({
      where: { childId: input.childId },
      create: {
        childId: input.childId,
        stage: nextStage,
        trustProgress,
        sharedEventsJson: sharedEvents,
        lastSessionAt: input.sessionEndedAt,
      },
      update: {
        stage: nextStage,
        trustProgress,
        sharedEventsJson: sharedEvents,
        lastSessionAt: input.sessionEndedAt,
      },
    });

    return toRelationshipDto(state);
  }

  toTranscriptTurns(
    turns: Array<{
      id: string;
      speaker: TranscriptTurn['speaker'];
      text: string;
      sequenceNo: number;
    }>,
  ): TranscriptTurn[] {
    return turns.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: t.text,
      sequenceNo: t.sequenceNo,
    }));
  }
}
