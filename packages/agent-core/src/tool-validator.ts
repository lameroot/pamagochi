import {
  agentToolNameSchema,
  agentToolRequestSchema,
  type AgentToolName,
  type AgentToolRequest,
  type AgentToolResult,
  type AgentToolValidationResult,
} from '@pamagochi/contracts';
import type { SceneAllowlist } from '@pamagochi/game-protocol';

export interface ToolRateLimitState {
  /** Timestamps (ms) of accepted tool calls in the rolling window. */
  callTimestamps: number[];
  /** callId values already processed (idempotency). */
  seenCallIds: Set<string>;
}

export interface ToolValidationContext {
  sceneAllowlist: SceneAllowlist;
  childId: string;
  conversationSessionId: string;
  /** Wall-clock ms when the tool call was initiated (for timeout). */
  callStartedAtMs: number;
  timeoutMs: number;
  maxCallsPerMinute: number;
  rateLimit: ToolRateLimitState;
}

export interface ToolAuditEntry {
  callId: string;
  name: AgentToolName;
  validation: AgentToolValidationResult;
  childId: string;
  conversationSessionId: string;
  sceneKey: string;
  sceneState: string;
  timestamp: string;
}

const SAFE_REJECTION_MESSAGES: Record<AgentToolValidationResult, string> = {
  accepted: 'OK',
  rejected_schema: 'Я не могу сделать это действие сейчас.',
  rejected_allowlist: 'Это действие недоступно в этой сцене.',
  rejected_state: 'Сейчас это ещё нельзя сделать.',
  rejected_ownership: 'Я не вижу этот объект рядом.',
  rejected_rate_limit: 'Давай немного подождём перед следующим действием.',
  rejected_timeout: 'Действие заняло слишком много времени.',
  rejected_unknown_tool: 'Я не знаю такого действия.',
};

/**
 * Validates allowlisted voice-agent tools only.
 * No generic executor — scene_request_event creates a request payload only.
 */
export class ToolValidator {
  validate(
    raw: unknown,
    ctx: ToolValidationContext,
  ): { result: AgentToolResult; audit: ToolAuditEntry } {
    const now = Date.now();
    const baseAudit = {
      childId: ctx.childId,
      conversationSessionId: ctx.conversationSessionId,
      sceneKey: ctx.sceneAllowlist.sceneKey,
      sceneState: ctx.sceneAllowlist.state,
      timestamp: new Date(now).toISOString(),
    };

    if (now - ctx.callStartedAtMs > ctx.timeoutMs) {
      return this.reject('rejected_timeout', 'unknown', raw, baseAudit);
    }

    const nameParse = agentToolNameSchema.safeParse(
      typeof raw === 'object' && raw !== null && 'name' in raw
        ? (raw as { name: unknown }).name
        : undefined,
    );
    if (!nameParse.success) {
      return this.reject('rejected_unknown_tool', 'unknown', raw, baseAudit);
    }

    const parsed = agentToolRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return this.reject('rejected_schema', nameParse.data, raw, baseAudit);
    }

    const request = parsed.data;

    if (ctx.rateLimit.seenCallIds.has(request.callId)) {
      return this.acceptIdempotent(request, baseAudit);
    }

    if (!ctx.sceneAllowlist.allowedToolNames.includes(request.name)) {
      return this.reject('rejected_allowlist', request.name, request, baseAudit);
    }

    if (this.isRateLimited(ctx, now)) {
      return this.reject('rejected_rate_limit', request.name, request, baseAudit);
    }

    const ownership = this.validateOwnership(request, ctx.sceneAllowlist);
    if (ownership) {
      return this.reject(ownership, request.name, request, baseAudit);
    }

    const stateRejection = this.validateSceneState(request, ctx.sceneAllowlist);
    if (stateRejection) {
      return this.reject(stateRejection, request.name, request, baseAudit);
    }

    ctx.rateLimit.seenCallIds.add(request.callId);
    ctx.rateLimit.callTimestamps.push(now);

    const gamePayload = this.buildGamePayload(request, ctx);
    const result: AgentToolResult = {
      callId: request.callId,
      name: request.name,
      validation: 'accepted',
      safeMessage: SAFE_REJECTION_MESSAGES.accepted,
      gamePayload,
    };

    return {
      result,
      audit: { ...baseAudit, callId: request.callId, name: request.name, validation: 'accepted' },
    };
  }

  private acceptIdempotent(
    request: AgentToolRequest,
    baseAudit: Omit<ToolAuditEntry, 'callId' | 'name' | 'validation'>,
  ): { result: AgentToolResult; audit: ToolAuditEntry } {
    const result: AgentToolResult = {
      callId: request.callId,
      name: request.name,
      validation: 'accepted',
      safeMessage: SAFE_REJECTION_MESSAGES.accepted,
    };
    return {
      result,
      audit: { ...baseAudit, callId: request.callId, name: request.name, validation: 'accepted' },
    };
  }

  private reject(
    validation: AgentToolValidationResult,
    name: AgentToolName | 'unknown',
    raw: unknown,
    baseAudit: Omit<ToolAuditEntry, 'callId' | 'name' | 'validation'>,
  ): { result: AgentToolResult; audit: ToolAuditEntry } {
    const callId =
      typeof raw === 'object' && raw !== null && 'callId' in raw
        ? String((raw as { callId: unknown }).callId)
        : 'unknown';
    const toolName = name === 'unknown' ? 'character_emote' : name;
    const result: AgentToolResult = {
      callId,
      name: toolName,
      validation,
      safeMessage: SAFE_REJECTION_MESSAGES[validation],
    };
    return {
      result,
      audit: {
        ...baseAudit,
        callId,
        name: toolName,
        validation,
      },
    };
  }

  private isRateLimited(ctx: ToolValidationContext, now: number): boolean {
    const windowStart = now - 60_000;
    ctx.rateLimit.callTimestamps = ctx.rateLimit.callTimestamps.filter((t) => t >= windowStart);
    return ctx.rateLimit.callTimestamps.length >= ctx.maxCallsPerMinute;
  }

  private validateOwnership(
    request: AgentToolRequest,
    allowlist: SceneAllowlist,
  ): AgentToolValidationResult | null {
    switch (request.name) {
      case 'character_look_at':
        if (!allowlist.visibleObjectIds.includes(request.arguments.targetId)) {
          return 'rejected_ownership';
        }
        return null;
      case 'scene_highlight_object':
        if (!allowlist.interactiveObjectIds.includes(request.arguments.objectId)) {
          return 'rejected_ownership';
        }
        return null;
      case 'scene_request_event':
        if (!allowlist.allowedEventIds.includes(request.arguments.eventId)) {
          return 'rejected_state';
        }
        return null;
      default:
        return null;
    }
  }

  private validateSceneState(
    request: AgentToolRequest,
    allowlist: SceneAllowlist,
  ): AgentToolValidationResult | null {
    if (request.name === 'scene_request_event') {
      if (allowlist.allowedEventIds.length === 0) {
        return 'rejected_state';
      }
    }
    return null;
  }

  /** scene_request_event only emits a request — never mutates world state directly. */
  private buildGamePayload(
    request: AgentToolRequest,
    ctx: ToolValidationContext,
  ): Record<string, unknown> | undefined {
    switch (request.name) {
      case 'character_emote':
        return { type: 'character_emote', emotion: request.arguments.emotion };
      case 'character_look_at':
        return { type: 'character_look_at', targetId: request.arguments.targetId };
      case 'character_gesture':
        return { type: 'character_gesture', gesture: request.arguments.gesture };
      case 'scene_highlight_object':
        return {
          type: 'scene_highlight_object',
          objectId: request.arguments.objectId,
          intensity: request.arguments.intensity,
        };
      case 'scene_request_event':
        return {
          type: 'scene_event_request',
          eventId: request.arguments.eventId,
          sceneKey: ctx.sceneAllowlist.sceneKey,
          sceneState: ctx.sceneAllowlist.state,
          status: 'pending',
        };
      case 'request_parent_attention':
        return {
          type: 'parent_attention_request',
          reason: request.arguments.reason,
          shortSummary: request.arguments.shortSummary,
        };
      default:
        return undefined;
    }
  }
}

export function createRateLimitState(): ToolRateLimitState {
  return { callTimestamps: [], seenCallIds: new Set() };
}
