import type { MemoryCategory, MemoryProposal } from '@pamagochi/contracts';

export type MemoryProvenance = 'child_stated' | 'agent_inferred';

export interface PolicyValidationContext {
  existingFacts: string[];
  childTurnTexts: string[];
  now?: Date;
}

export interface PolicyValidationResult {
  accepted: boolean;
  rejectionReason?: string;
  reviewAfter: string | null;
  provenance: MemoryProvenance;
}

const ALLOWED_CATEGORIES = new Set<MemoryCategory>([
  'interest',
  'preference',
  'achievement',
  'relationship_event',
  'favorite_game_object',
  'learning_preference',
  'parent_note',
]);

const FORBIDDEN_CONTENT: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, reason: 'PII: phone number' },
  { pattern: /\b\d{10,}\b/, reason: 'PII: long number' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, reason: 'PII: email' },
  { pattern: /\b(api[_-]?key|secret|password|token)\s*[:=]/i, reason: 'secret' },
  { pattern: /\b(sk-[a-zA-Z0-9]{10,})\b/, reason: 'secret' },
  {
    pattern: /\b(ignore|disregard)\s+(all\s+)?(previous|prior)\s+instructions/i,
    reason: 'instruction',
  },
  { pattern: /\b(system|developer|admin)\s+mode\b/i, reason: 'instruction' },
  { pattern: /\bremember\s+forever\b/i, reason: 'memory poisoning' },
  { pattern: /\b(hurt|kill|suicide|self[- ]?harm)\b/i, reason: 'harmful content' },
  {
    pattern: /\b(religion|politics|political|god|church|mosque|election)\b/i,
    reason: 'religion/politics',
  },
  { pattern: /\b(diagnos|medicine|hospital|therapy|illness|sick)\b/i, reason: 'health' },
  { pattern: /\b(don'?t\s+tell|keep\s+secret\s+from)\s+(mom|dad|parent)/i, reason: 'secrecy' },
  { pattern: /\b(fight|war|weapon|gun|knife)\b/i, reason: 'dangerous content' },
];

const MIN_CONFIDENCE = 0.5;
const MAX_CONFIDENCE = 1;
const INFERRED_MAX_CONFIDENCE = 0.7;

function normalizeFact(fact: string): string {
  return fact.trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectProvenance(proposal: MemoryProposal, childTurnTexts: string[]): MemoryProvenance {
  if (proposal.sourceTurnIds.length > 0) return 'child_stated';
  const factCore = normalizeFact(proposal.fact);
  const childStated = childTurnTexts.some((t) => normalizeFact(t).includes(factCore.slice(0, 20)));
  return childStated ? 'child_stated' : 'agent_inferred';
}

function computeReviewAfter(
  provenance: MemoryProvenance,
  confidence: number,
  now: Date,
): string | null {
  if (provenance === 'agent_inferred' || confidence < 0.8) {
    const review = new Date(now);
    review.setDate(review.getDate() + 30);
    return review.toISOString();
  }
  return null;
}

export class MemoryPolicyValidator {
  validate(proposal: MemoryProposal, context: PolicyValidationContext): PolicyValidationResult {
    const now = context.now ?? new Date();

    if (!ALLOWED_CATEGORIES.has(proposal.category)) {
      return {
        accepted: false,
        rejectionReason: `Category not allowed: ${proposal.category}`,
        reviewAfter: null,
        provenance: 'agent_inferred',
      };
    }

    if (proposal.fact.length < 2 || proposal.fact.length > 280) {
      return {
        accepted: false,
        rejectionReason: 'Fact length out of bounds',
        reviewAfter: null,
        provenance: 'agent_inferred',
      };
    }

    if (proposal.confidence < MIN_CONFIDENCE || proposal.confidence > MAX_CONFIDENCE) {
      return {
        accepted: false,
        rejectionReason: 'Confidence out of bounds',
        reviewAfter: null,
        provenance: 'agent_inferred',
      };
    }

    for (const rule of FORBIDDEN_CONTENT) {
      if (rule.pattern.test(proposal.fact) || rule.pattern.test(proposal.rationale)) {
        return {
          accepted: false,
          rejectionReason: rule.reason,
          reviewAfter: null,
          provenance: 'agent_inferred',
        };
      }
    }

    const provenance = detectProvenance(proposal, context.childTurnTexts);
    if (provenance === 'agent_inferred' && proposal.confidence > INFERRED_MAX_CONFIDENCE) {
      return {
        accepted: false,
        rejectionReason: 'Agent inference confidence too high',
        reviewAfter: null,
        provenance,
      };
    }

    const normalized = normalizeFact(proposal.fact);
    if (context.existingFacts.some((f) => normalizeFact(f) === normalized)) {
      return {
        accepted: false,
        rejectionReason: 'Duplicate fact',
        reviewAfter: null,
        provenance,
      };
    }

    return {
      accepted: true,
      reviewAfter: computeReviewAfter(provenance, proposal.confidence, now),
      provenance,
    };
  }
}

export const memoryPolicyValidator = new MemoryPolicyValidator();
