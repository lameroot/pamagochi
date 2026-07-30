import { Injectable, Logger } from '@nestjs/common';
import {
  extractMemoryProposals,
  renderSessionSummary,
  serializeSessionSummary,
  summarizeSession,
} from '@pamagochi/agent-core';
import { PrismaService } from '../database/prisma.service.js';
import { MemoryContextService } from './memory-context.service.js';

export const SESSION_FINALIZE_JOB = 'conversation-session.finalize';

export interface SessionFinalizePayload {
  conversationSessionId: string;
}

@Injectable()
export class SessionFinalizeService {
  private readonly logger = new Logger(SessionFinalizeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryContextService,
  ) {}

  async run(payload: SessionFinalizePayload): Promise<void> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: payload.conversationSessionId },
      include: {
        turns: { orderBy: { sequenceNo: 'asc' } },
        child: true,
      },
    });
    if (!session || session.child.deletedAt) return;
    if (session.status === 'cancelled') return;

    const transcript = this.memory.toTranscriptTurns(session.turns);
    const childTurnTexts = transcript.filter((t) => t.speaker === 'child').map((t) => t.text);

    let sessionSummary = session.sessionSummary;
    if (!sessionSummary && transcript.length > 0) {
      try {
        const structured = summarizeSession(transcript);
        sessionSummary = serializeSessionSummary(structured);
        // Also store human-readable form is embedded in JSON; render for logs only
        this.logger.log(
          `Summarized session ${session.id}: ${renderSessionSummary(structured).slice(0, 120)}`,
        );
      } catch (error) {
        this.logger.warn(
          `Summarization failed for ${session.id}; transcript preserved`,
          error instanceof Error ? error.message : undefined,
        );
      }
    }

    if (transcript.length > 0) {
      try {
        const existingFacts = (
          await this.prisma.client.memoryItem.findMany({
            where: { childId: session.childId, deletedAt: null, status: { not: 'deleted' } },
            select: { fact: true },
          })
        ).map((m) => m.fact);

        const proposals = extractMemoryProposals({ transcript, existingFacts });
        await this.memory.persistAutomaticProposals({
          childId: session.childId,
          conversationSessionId: session.id,
          proposals,
          childTurnTexts,
        });
      } catch (error) {
        this.logger.warn(
          `Memory extraction failed for ${session.id}; transcript preserved`,
          error instanceof Error ? error.message : undefined,
        );
      }
    }

    const endedAt = session.endedAt ?? new Date();
    await this.memory.updateRelationshipAfterSession({
      childId: session.childId,
      sessionEndedAt: endedAt,
      sharedEvent: sessionSummary ? 'completed_voice_session' : undefined,
    });

    await this.prisma.client.conversationSession.update({
      where: { id: session.id },
      data: {
        status: session.status === 'failed' ? 'failed' : 'completed',
        sessionSummary,
        endedAt,
      },
    });
  }
}
