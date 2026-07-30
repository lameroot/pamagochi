import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppendConversationTurnRequest,
  AppendConversationTurnResponse,
  ConversationTurnDto,
  FinalizeConversationSessionRequest,
} from '@pamagochi/contracts';
import type { ConversationSpeaker, ConversationSessionStatus } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import { SESSION_FINALIZE_JOB } from './session-finalize.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
  ) {}

  async appendTurn(
    conversationSessionId: string,
    body: AppendConversationTurnRequest,
  ): Promise<AppendConversationTurnResponse> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
      include: { child: true },
    });
    if (
      !session ||
      session.child.deletedAt ||
      session.status === 'completed' ||
      session.status === 'cancelled'
    ) {
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

  async listTurns(conversationSessionId: string): Promise<ConversationTurnDto[]> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
    });
    if (!session) {
      throw new NotFoundException('Conversation session is not available');
    }

    const turns = await this.prisma.client.conversationTurn.findMany({
      where: { conversationSessionId },
      orderBy: { sequenceNo: 'asc' },
    });
    return turns.map(toTurnDto);
  }

  async finalize(
    conversationSessionId: string,
    body: FinalizeConversationSessionRequest,
  ): Promise<{ id: string; status: ConversationSessionStatus }> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
      include: { child: true },
    });
    if (!session || session.child.deletedAt) {
      throw new NotFoundException('Conversation session is not available');
    }

    const terminalStatuses: ConversationSessionStatus[] = ['completed', 'failed', 'cancelled'];
    if (terminalStatuses.includes(session.status)) {
      return { id: session.id, status: session.status };
    }

    const targetStatus = body.status as ConversationSessionStatus;
    const isFailure = targetStatus === 'failed' || targetStatus === 'cancelled';

    const updated = await this.prisma.client.conversationSession.update({
      where: { id: conversationSessionId },
      data: {
        status: isFailure ? targetStatus : 'finalizing',
        endedAt: new Date(),
        sessionSummary: body.sessionSummary ?? session.sessionSummary,
      },
    });

    if (!isFailure) {
      void this.jobs.dispatch(SESSION_FINALIZE_JOB, { conversationSessionId });
    } else {
      await this.prisma.client.conversationSession.update({
        where: { id: conversationSessionId },
        data: { status: targetStatus },
      });
    }

    return { id: updated.id, status: isFailure ? targetStatus : 'finalizing' };
  }

  async recordUsage(
    conversationSessionId: string,
    usage: {
      costInputTokens?: number;
      costOutputTokens?: number;
      costTtsChars?: number;
      costSttSeconds?: number;
    },
  ): Promise<void> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationSessionId },
    });
    if (!session) return;

    await this.prisma.client.conversationSession.update({
      where: { id: conversationSessionId },
      data: {
        costInputTokens: { increment: usage.costInputTokens ?? 0 },
        costOutputTokens: { increment: usage.costOutputTokens ?? 0 },
        costTtsChars: { increment: usage.costTtsChars ?? 0 },
        costSttSeconds: { increment: usage.costSttSeconds ?? 0 },
      },
    });
  }
}
