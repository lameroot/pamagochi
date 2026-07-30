import { randomUUID } from 'node:crypto';
import type { CreateSafetyEventRequest, SafetyCategory } from '@pamagochi/contracts';
import { DEFAULT_SAFETY_POLICY } from '@pamagochi/safety-contracts';

export interface InputSafetyContext {
  childId: string;
  conversationSessionId: string | null;
  turnId?: string | null;
}

export interface InputSafetyResult {
  allowed: boolean;
  /** Sanitized text forwarded to LLM when allowed. */
  sanitizedText: string;
  /** Short in-character refusal when blocked. */
  refusalLine: string | null;
  safetyEvent: CreateSafetyEventRequest | null;
  categories: SafetyCategory[];
}

const JAILBREAK_PATTERNS: Array<{ pattern: RegExp; category: SafetyCategory }> = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    category: 'prompt_injection',
  },
  { pattern: /disregard\s+(your\s+)?(rules|safety|policy)/i, category: 'prompt_injection' },
  {
    pattern: /you\s+are\s+now\s+(in\s+)?(developer|admin|unrestricted)\s+mode/i,
    category: 'prompt_injection',
  },
  { pattern: /\bDAN\b.*\bmode\b/i, category: 'prompt_injection' },
  {
    pattern: /(show|reveal|print|repeat)\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
    category: 'prompt_extraction',
  },
  { pattern: /what\s+(are|is)\s+your\s+(system\s+)?instructions/i, category: 'prompt_extraction' },
  { pattern: /\b(tool|function)\s*:\s*\w+/i, category: 'tool_escalation' },
  { pattern: /\bexecute_action\b|\brun_shell\b|\bcurl\b|\bwget\b/i, category: 'tool_escalation' },
  { pattern: /\b(api[_-]?key|secret|password|token)\s*[:=]/i, category: 'prompt_extraction' },
  { pattern: /\b(sk-[a-zA-Z0-9]{10,})\b/, category: 'prompt_extraction' },
  { pattern: /don'?t\s+tell\s+(my\s+)?(mom|dad|parent)/i, category: 'secrecy_from_parents' },
  { pattern: /keep\s+this\s+(a\s+)?secret\s+from/i, category: 'secrecy_from_parents' },
  {
    pattern:
      /\b(phone|email|address|whatsapp|telegram|discord)\b.*\b(give|send|share)\b|\b(give|send|share)\b.*\b(phone|email|address|whatsapp|telegram|discord)\b/i,
    category: 'external_contact',
  },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, category: 'pii' },
  { pattern: /\b\d{10,}\b/, category: 'pii' },
  {
    pattern: /\b(hurt\s+myself|hurt\s+yourself|self[- ]?harm|suicide)\b/i,
    category: 'harmful_content',
  },
  {
    pattern:
      /\b(forever|without\s+stopping|infinite|nonstop)\b.*\b(story|talk|speak|repeat)\b|\brepeat\b.*\b(forever|without\s+stopping)\b/i,
    category: 'cost_exhaustion',
  },
  { pattern: /remember\s+forever\s+that\s+i\s+am\s+the\s+admin/i, category: 'memory_poisoning' },
  { pattern: /\\u[0-9a-f]{4}/i, category: 'prompt_injection' },
  { pattern: /base64\s*[:=]/i, category: 'prompt_injection' },
];

const REFUSAL_LINE = 'Хм, давай лучше поговорим о приключении на корабле!';

/**
 * Rule-based input safety before LLM. Does not change toolset or policies.
 */
export class InputSafety {
  constructor(
    private readonly fallbackLine: string = DEFAULT_SAFETY_POLICY.childFacingFallbackLine,
  ) {}

  evaluate(text: string, ctx: InputSafetyContext): InputSafetyResult {
    const categories = this.detectCategories(text);
    if (categories.length === 0) {
      return {
        allowed: true,
        sanitizedText: text.trim(),
        refusalLine: null,
        safetyEvent: null,
        categories: [],
      };
    }

    const primary = categories[0] ?? 'other';
    return {
      allowed: false,
      sanitizedText: '',
      refusalLine: REFUSAL_LINE,
      categories,
      safetyEvent: {
        conversationSessionId: ctx.conversationSessionId,
        turnId: ctx.turnId ?? null,
        category: primary,
        severity: this.severityFor(primary),
        detectedBy: 'input-safety-rules',
        inputExcerpt: text.slice(0, 280),
        actionTaken: 'blocked_input_short_refusal',
        parentVisible: primary !== 'prompt_injection',
      },
    };
  }

  private detectCategories(text: string): SafetyCategory[] {
    const found = new Set<SafetyCategory>();
    for (const { pattern, category } of JAILBREAK_PATTERNS) {
      if (pattern.test(text)) found.add(category);
    }
    return [...found];
  }

  private severityFor(category: SafetyCategory): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case 'prompt_extraction':
      case 'tool_escalation':
      case 'secrecy_from_parents':
        return 'high';
      case 'pii':
      case 'external_contact':
        return 'critical';
      case 'memory_poisoning':
        return 'medium';
      default:
        return 'medium';
    }
  }
}

export function createSafetyEventId(): string {
  return randomUUID();
}
