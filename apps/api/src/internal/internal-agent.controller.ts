import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  agentToolRequestSchema,
  appendConversationTurnRequestSchema,
  createSafetyEventRequestSchema,
  finalizeConversationSessionRequestSchema,
  type ActivePromptVersionsResponse,
  type AgentToolResult,
  type AppendConversationTurnResponse,
  type SafetyEventDto,
  type VoiceSessionContext,
} from '@pamagochi/contracts';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';
import { ageBandFromBirth } from '../game-sessions/age-band.js';
import { MemoryContextService } from './memory-context.service.js';
import { AgentConversationService } from './agent-conversation.service.js';
import { PromptVersionService } from './prompt-version.service.js';
import { SafetyEventService } from './safety-event.service.js';
import { ServiceAuthGuard } from './service-auth.guard.js';
import { ToolValidationService } from './tool-validation.service.js';

const invokeToolBodySchema = z.object({
  sceneKey: z.string().min(1).max(64),
  sceneState: z.string().min(1).max(64).optional(),
  request: agentToolRequestSchema,
  turnId: z.string().min(1).optional(),
  callStartedAtMs: z.number().int().positive().optional(),
});

@Controller('internal/agent')
@UseGuards(ServiceAuthGuard)
export class InternalAgentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversation: AgentConversationService,
    private readonly tools: ToolValidationService,
    private readonly promptVersions: PromptVersionService,
    private readonly safetyEvents: SafetyEventService,
    private readonly memory: MemoryContextService,
  ) {}

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

    const memoryContext = await this.memory.buildMemoryContext(session.childId);

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
      memoryContext,
    };
  }

  @Post('sessions/:conversationSessionId/turns')
  async appendTurn(
    @Param('conversationSessionId') conversationSessionId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AppendConversationTurnResponse> {
    const parsed = appendConversationTurnRequestSchema.parse(body);
    const result = await this.conversation.appendTurn(conversationSessionId, parsed);
    void res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }

  @Post('sessions/:conversationSessionId/finalize')
  async finalizeSession(
    @Param('conversationSessionId') conversationSessionId: string,
    @Body() body: unknown,
  ): Promise<{ id: string; status: string }> {
    const parsed = finalizeConversationSessionRequestSchema.parse(body);
    return this.conversation.finalize(conversationSessionId, parsed);
  }

  @Post('sessions/:conversationSessionId/safety-events')
  async createSafetyEvent(
    @Param('conversationSessionId') conversationSessionId: string,
    @Body() body: unknown,
  ): Promise<SafetyEventDto> {
    const parsed = createSafetyEventRequestSchema.parse(body);
    return this.safetyEvents.createForSession(conversationSessionId, parsed);
  }

  @Post('sessions/:conversationSessionId/tools')
  async invokeTool(
    @Param('conversationSessionId') conversationSessionId: string,
    @Body() body: unknown,
  ): Promise<AgentToolResult> {
    const parsed = invokeToolBodySchema.parse(body);
    return this.tools.validateAndAudit({
      conversationSessionId,
      sceneKey: parsed.sceneKey,
      sceneState: parsed.sceneState,
      request: parsed.request,
      turnId: parsed.turnId,
      callStartedAtMs: parsed.callStartedAtMs,
    });
  }

  @Get('prompt-versions/active')
  getActivePromptVersions(): ActivePromptVersionsResponse {
    return this.promptVersions.getActiveSnapshot();
  }
}
