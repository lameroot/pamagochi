import { memoryProposalSchema, type MemoryProposal } from '@pamagochi/contracts';
import type { TranscriptTurn } from './session-summarizer.js';

const INTEREST_EXTRACTION: Array<{ pattern: RegExp; category: MemoryProposal['category'] }> = [
  {
    pattern: /(люблю|обожаю|нравится)\s+([а-яёa-z0-9\s-]{2,40})/i,
    category: 'interest',
  },
  {
    pattern: /(i love|i like)\s+([a-z0-9\s-]{2,40})/i,
    category: 'interest',
  },
  {
    pattern: /\b(любимый|favorite)\s+([а-яёa-z0-9\s-]{2,40})/i,
    category: 'favorite_game_object',
  },
  {
    pattern: /\b(мне\s+(\d{1,2})\s+лет|i am (\d{1,2}) years old)\b/i,
    category: 'preference',
  },
];

const COMMAND_PATTERNS: RegExp[] = [
  /^remember\s+that\b/i,
  /^запомни\s+что\b/i,
  /^system:\s*/i,
  /^ignore\s+previous\b/i,
];

function isCommandLike(text: string): boolean {
  return COMMAND_PATTERNS.some((p) => p.test(text.trim()));
}

function normalizeFact(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 280);
}

/**
 * Extracts memory proposals from transcript — treats commands as data, not instructions.
 */
export function extractMemoryProposals(input: {
  transcript: TranscriptTurn[];
  existingFacts?: string[];
}): MemoryProposal[] {
  const existing = new Set((input.existingFacts ?? []).map((f) => f.toLowerCase()));
  const proposals: MemoryProposal[] = [];

  for (const turn of input.transcript) {
    if (turn.speaker !== 'child') continue;
    const text = turn.text.trim();
    if (!text || isCommandLike(text)) continue;

    for (const rule of INTEREST_EXTRACTION) {
      const match = rule.pattern.exec(text);
      if (!match) continue;

      const subject = (match[2] ?? match[1] ?? '').trim();
      if (!subject || subject.length < 2) continue;

      const fact =
        rule.category === 'preference' && match[0]
          ? `Child mentioned: ${match[0].trim()}`
          : `Likes ${subject}`;

      const normalized = normalizeFact(fact);
      if (existing.has(normalized.toLowerCase())) continue;

      const proposal = memoryProposalSchema.parse({
        category: rule.category,
        fact: normalized,
        confidence: 0.85,
        sourceTurnIds: [turn.id],
        rationale: 'Explicit child statement in transcript',
      });
      proposals.push(proposal);
      existing.add(normalized.toLowerCase());
      break;
    }
  }

  return proposals;
}
