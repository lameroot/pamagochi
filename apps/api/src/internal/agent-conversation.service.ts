import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppendConversationTurnRequest,
  AppendConversationTurnResponse,
  ConversationTurnDto,
  FinalizeConversationSessionRequest,
} from '@pamagochi/contracts';
import type { ConversationSpeaker, ConversationSessionStatus } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

function toTurnDto(turn: {
  id: string;
  conversationSessionId: string;
  sequenceNo: number;
  speaker: ConversationSpeaker;
  text: string;
  startedAt: Date;
  endedAt: Date | null;
  wasInterrupted: boolean;
  playedTextLength: number | null;
  safetyFlags: string[];
  metadataJson: unknown;
  createdAt: Date;
}): ConversationTurnDto {
  return {
    id: turn.id,
    conversationSessionId: turn.conversationSessionId,
    sequenceNo: turn.sequenceNo,
    speaker: turn.speaker,
    text: turn.text,
    startedAt: turn.startedAt.toISOString(),
    endedAt: turn.endedAt?.toISOString() ?? null,
    wasInterrupted: turn.wasInterrupted,
    playedTextLength: turn.playedTextLength,
    safetyFlags: turn.safetyFlags,
    metadata:
      turn.metadataJson &&
      typeof turn.metadataJson === 'object' &&
      !Array.isArray(turn.metadataJson)
        ? (turn.metadataJson as Record<string, unknown>)
        : {},
    createdAt: turn.createdAt.toISOString(),
  };
}

@Injectable()
export class AgentConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async appendTurn(
    conversationSessionId: string,
    body: AppendConversationTurnRequest,
  ): Promise<AppendConversationTurnResponse> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
    });
    if (!session || session.status === 'completed' || session.status === 'cancelled') {
      throw new NotFoundException('Conversation session is not available');
    }

    const existing = await this.prisma.client.conversationTurn.findFirst({
      where: {
        conversationSessionId,
        idempotencyKey: body.idempotencyKey,
      },
    });
    if (existing) {
      return { turn: toTurnDto(existing), created: false };
    }

    const turn = await this.prisma.client.conversationTurn.create({
      data: {
        conversationSessionId,
        sequenceNo: body.sequenceNo,
        speaker: body.speaker,
        text: body.text,
        startedAt: new Date(body.startedAt),
        endedAt: body.endedAt ? new Date(body.endedAt) : null,
        wasInterrupted: body.wasInterrupted,
        playedTextLength: body.playedTextLength ?? null,
        safetyFlags: body.safetyFlags,
        metadataJson: body.metadata as object,
        idempotencyKey: body.idempotencyKey,
      },
    });

    return { turn: toTurnDto(turn), created: true };
  }

  async finalize(
    conversationSessionId: string,
    body: FinalizeConversationSessionRequest,
  ): Promise<{ id: string; status: ConversationSessionStatus }> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
    });
    if (!session) {
      throw new NotFoundException('Conversation session is not available');
    }

    const status = body.status as ConversationSessionStatus;
    const updated = await this.prisma.client.conversationSession.update({
      where: { id: conversationSessionId },
      data: {
        status,
        endedAt: new Date(),
        sessionSummary: body.sessionSummary ?? session.sessionSummary,
      },
    });

    return { id: updated.id, status: updated.status };
  }
}
