import { randomUUID } from 'node:crypto';
import type { AgeBand, CreateSafetyEventRequest } from '@pamagochi/contracts';
import { DEFAULT_SAFETY_POLICY, type SafetyPolicyDocument } from '@pamagochi/safety-contracts';

export interface OutputSafetyContext {
  childId: string;
  conversationSessionId: string | null;
  turnId?: string | null;
  ageBand: AgeBand;
}

export interface OutputSafetyResult {
  text: string;
  wasModified: boolean;
  safetyEvent: CreateSafetyEventRequest | null;
}

const FORBIDDEN_OUTPUT_PATTERNS: RegExp[] = [
  /\b(system\s+prompt|SOUL|immutable\s+rules)\b/i,
  /\b(api[_-]?key|secret|password|token)\s*[:=]\s*\S+/gi,
  /\b(sk-[a-zA-Z0-9]{10,})\b/g,
  /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
  /\bhttps?:\/\/\S+/gi,
  /\b(curl|wget|bash|powershell|rm\s+-rf)\b/i,
  /\b(self[- ]?harm|suicide|kill\s+yourself|hurt\s+myself|hurt\s+yourself)\b/i,
  /\b(weapon|gun|knife)\b/i,
];

const YOUNG_CHILD_FORBIDDEN: RegExp[] = [/\b(scary|nightmare|blood|die|death)\b/i];

export interface OutputSafetyOptions {
  policy?: SafetyPolicyDocument;
  /** When classifier/rules throw, use fail-safe fallback. */
  failSafeOnError?: boolean;
}

/**
 * Output safety checks before TTS. Replaces forbidden content with a safe line.
 */
export class OutputSafety {
  private readonly policy: SafetyPolicyDocument;

  constructor(options: OutputSafetyOptions = {}) {
    this.policy = options.policy ?? DEFAULT_SAFETY_POLICY;
  }

  evaluate(text: string, ctx: OutputSafetyContext): OutputSafetyResult {
    try {
      return this.evaluateInternal(text, ctx);
    } catch {
      return this.failSafe(ctx, 'classifier_failure');
    }
  }

  private evaluateInternal(text: string, ctx: OutputSafetyContext): OutputSafetyResult {
    const violations = this.detectViolations(text, ctx.ageBand);
    if (violations.length === 0) {
      return { text: text.trim(), wasModified: false, safetyEvent: null };
    }

    return {
      text: this.policy.childFacingFallbackLine,
      wasModified: true,
      safetyEvent: {
        conversationSessionId: ctx.conversationSessionId,
        turnId: ctx.turnId ?? null,
        category: 'output_policy',
        severity: 'medium',
        detectedBy: 'output-safety-rules',
        inputExcerpt: text.slice(0, 280),
        actionTaken: 'replaced_with_safe_line',
        parentVisible: true,
      },
    };
  }

  private detectViolations(text: string, ageBand: AgeBand): string[] {
    const hits: string[] = [];
    for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
      const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
      if (re.test(text)) hits.push(pattern.source);
    }
    if (ageBand === '3-5') {
      for (const pattern of YOUNG_CHILD_FORBIDDEN) {
        const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
        if (re.test(text)) hits.push(pattern.source);
      }
    }
    for (const topic of this.policy.forbiddenTopics) {
      if (text.toLowerCase().includes(topic.toLowerCase())) {
        hits.push(`topic:${topic}`);
      }
    }
    return hits;
  }

  private failSafe(ctx: OutputSafetyContext, reason: string): OutputSafetyResult {
    return {
      text: this.policy.childFacingFallbackLine,
      wasModified: true,
      safetyEvent: {
        conversationSessionId: ctx.conversationSessionId,
        turnId: ctx.turnId ?? null,
        category: 'output_policy',
        severity: 'high',
        detectedBy: 'output-safety-failsafe',
        inputExcerpt: null,
        actionTaken: reason,
        parentVisible: false,
      },
    };
  }
}

export function createOutputSafetyEventId(): string {
  return randomUUID();
}
