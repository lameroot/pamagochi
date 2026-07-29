import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { VoiceSessionContext } from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';
import { ageBandFromBirth } from '../game-sessions/age-band.js';
import { ServiceAuthGuard } from './service-auth.guard.js';

@Controller('internal/agent')
@UseGuards(ServiceAuthGuard)
export class InternalAgentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sessions/:gameSessionId/context')
  async getSessionContext(
    @Param('gameSessionId') gameSessionId: string,
  ): Promise<VoiceSessionContext> {
    const session = await this.prisma.client.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        child: true,
        conversationSessions: {
          where: { status: 'active' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Game session is not available');
    }
    if (session.child.deletedAt) {
      throw new NotFoundException('Child profile is not available');
    }

    let conversation = session.conversationSessions[0];
    if (!conversation) {
      conversation = await this.prisma.client.conversationSession.create({
        data: {
          childId: session.childId,
          gameSessionId: session.id,
          livekitRoomId: `game-${session.id}`,
          status: 'active',
          soulVersion: process.env.PAMAGOCHI_SOUL_VERSION ?? '0.1.0',
          safetyPolicyVersion: process.env.PAMAGOCHI_SAFETY_POLICY_VERSION ?? '0.1.0',
          llmProvider: process.env.VOICE_LLM_PROVIDER ?? 'deepseek',
          sttProvider: process.env.VOICE_STT_PROVIDER ?? 'deepgram',
          ttsProvider: process.env.VOICE_TTS_PROVIDER ?? 'elevenlabs',
        },
      });
    }

    return {
      protocolVersion: '1',
      gameSessionId: session.id,
      conversationSessionId: conversation.id,
      childId: session.childId,
      ageBand: ageBandFromBirth({
        birthYear: session.child.birthYear,
        birthDate: session.child.birthDate,
      }),
      primaryLanguage: session.child.primaryLanguage,
      displayName: session.child.displayName,
      soulVersion: conversation.soulVersion ?? '0.1.0',
      safetyPolicyVersion: conversation.safetyPolicyVersion ?? '0.1.0',
      livekitRoomName: conversation.livekitRoomId,
    };
  }
}
