import { Injectable } from '@nestjs/common';
import {
  agentToolResultSchema,
  type AgentToolRequest,
  type AgentToolResult,
  type AgentToolValidationResult,
} from '@pamagochi/contracts';
import {
  ToolValidator,
  createRateLimitState,
  type ToolRateLimitState,
} from '@pamagochi/agent-core';
import { introAllowlistFor, talkingLightAllowlist } from '@pamagochi/game-protocol';
import type { IntroState } from '@pamagochi/game-protocol';
import { PrismaService } from '../database/prisma.service.js';
import type { ToolValidationResult } from '@pamagochi/database';

interface RateBucket {
  state: ToolRateLimitState;
  windowStartMs: number;
}

const TOOL_TIMEOUT_MS = 5000;
const MAX_TOOL_CALLS_PER_WINDOW = 30;

function toPrismaValidation(result: AgentToolValidationResult): ToolValidationResult {
  return result as ToolValidationResult;
}

@Injectable()
export class ToolValidationService {
  private readonly validator = new ToolValidator();
  private readonly rateBuckets = new Map<string, RateBucket>();

  constructor(private readonly prisma: PrismaService) {}

  async validateAndAudit(input: {
    conversationSessionId: string;
    sceneKey: string;
    sceneState?: string;
    request: AgentToolRequest;
    turnId?: string;
    callStartedAtMs?: number;
  }): Promise<AgentToolResult> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: input.conversationSessionId },
      include: { child: true },
    });

    const fallback: AgentToolResult = {
      callId: input.request.callId,
      name: input.request.name,
      validation: 'rejected_state',
      safeMessage: 'Session is not active.',
    };

    if (!session || session.status !== 'active') {
      return this.audit(input.conversationSessionId, input.turnId, input.request, fallback);
    }

    const allowlist = this.resolveAllowlist(input.sceneKey, input.sceneState);
    const rateBucket = this.getRateBucket(input.conversationSessionId);

    const { result } = this.validator.validate(input.request, {
      sceneAllowlist: allowlist,
      childId: session.childId,
      conversationSessionId: input.conversationSessionId,
      callStartedAtMs: input.callStartedAtMs ?? Date.now(),
      timeoutMs: TOOL_TIMEOUT_MS,
      maxCallsPerMinute: MAX_TOOL_CALLS_PER_WINDOW,
      rateLimit: rateBucket.state,
    });

    return this.audit(input.conversationSessionId, input.turnId, input.request, result);
  }

  private resolveAllowlist(sceneKey: string, sceneState?: string) {
    if (sceneKey === 'talking-light') return talkingLightAllowlist();
    if (sceneKey === 'ship-capsule-intro') {
      const state = (sceneState ?? 'SHIP_DARK') as IntroState;
      return introAllowlistFor(state);
    }
    return talkingLightAllowlist();
  }

  private getRateBucket(conversationSessionId: string): RateBucket {
    const existing = this.rateBuckets.get(conversationSessionId);
    if (existing) return existing;
    const created: RateBucket = {
      state: createRateLimitState(),
      windowStartMs: Date.now(),
    };
    this.rateBuckets.set(conversationSessionId, created);
    return created;
  }

  private async audit(
    conversationSessionId: string,
    turnId: string | undefined,
    request: AgentToolRequest,
    result: AgentToolResult,
  ): Promise<AgentToolResult> {
    const validated = agentToolResultSchema.parse(result);
    await this.prisma.client.agentToolCall.create({
      data: {
        conversationSessionId,
        turnId: turnId ?? null,
        toolName: request.name,
        argumentsJson: 'arguments' in request ? request.arguments : {},
        validationResult: toPrismaValidation(validated.validation),
        resultJson: validated as object,
      },
    });
    return validated;
  }
}
