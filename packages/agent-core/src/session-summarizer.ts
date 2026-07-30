import {
  structuredSessionSummarySchema,
  type StructuredSessionSummary,
} from '@pamagochi/contracts';

export interface TranscriptTurn {
  id: string;
  speaker: 'child' | 'agent' | 'system_event';
  text: string;
  sequenceNo: number;
}

const INTEREST_PATTERNS: RegExp[] = [
  /\b(люблю|нравится|обожаю|интересуюсь)\b/i,
  /\b(i love|i like|my favorite)\b/i,
];

const GAME_EVENT_PATTERNS: RegExp[] = [
  /\b(наш[её]л|открыл|собрал|победил|прош[её]л)\b/i,
  /\b(found|opened|collected|won|completed)\b/i,
];

/**
 * Rule-based session summarizer — no tools or network.
 * Voice-agent may wrap this with an LLM in production.
 */
export function summarizeSession(transcript: TranscriptTurn[]): StructuredSessionSummary {
  const childTurns = transcript.filter((t) => t.speaker === 'child');
  const agentTurns = transcript.filter((t) => t.speaker === 'agent');
  const systemTurns = transcript.filter((t) => t.speaker === 'system_event');

  const topics: string[] = [];
  for (const turn of childTurns) {
    if (INTEREST_PATTERNS.some((p) => p.test(turn.text))) {
      const snippet = turn.text.trim().slice(0, 80);
      if (snippet && !topics.includes(snippet)) topics.push(snippet);
    }
  }
  if (topics.length === 0 && childTurns.length > 0) {
    topics.push(childTurns[0]!.text.trim().slice(0, 80));
  }

  const gameEvents: string[] = [];
  for (const turn of [...systemTurns, ...childTurns, ...agentTurns]) {
    if (GAME_EVENT_PATTERNS.some((p) => p.test(turn.text))) {
      const snippet = turn.text.trim().slice(0, 120);
      if (snippet && !gameEvents.includes(snippet)) gameEvents.push(snippet);
    }
  }

  const relationshipChange =
    childTurns.some((t) => /\b(друг|подруг|trust|друж)\b/i.test(t.text)) ||
    agentTurns.some((t) => /\b(рад|приятно|друг)\b/i.test(t.text))
      ? 'Warm rapport continued during the session.'
      : childTurns.length > 2
        ? 'Child engaged in conversation.'
        : null;

  const nextContext =
    topics.length > 0
      ? `Follow up on: ${topics[0]!.slice(0, 60)}`
      : 'Greet warmly and invite play.';

  return structuredSessionSummarySchema.parse({
    topics: topics.slice(0, 5),
    gameEvents: gameEvents.slice(0, 5),
    relationshipChange,
    nextContext,
  });
}

export function renderSessionSummary(summary: StructuredSessionSummary): string {
  const lines = [
    summary.topics.length > 0 ? `Topics: ${summary.topics.join('; ')}` : null,
    summary.gameEvents.length > 0 ? `Game events: ${summary.gameEvents.join('; ')}` : null,
    summary.relationshipChange ? `Relationship: ${summary.relationshipChange}` : null,
    summary.nextContext ? `Next: ${summary.nextContext}` : null,
  ].filter(Boolean);
  return lines.join('\n').slice(0, 4000);
}

export function parseStoredSessionSummary(stored: string | null): StructuredSessionSummary | null {
  if (!stored?.trim()) return null;
  try {
    const json: unknown = JSON.parse(stored);
    return structuredSessionSummarySchema.parse(json);
  } catch {
    return structuredSessionSummarySchema.parse({
      topics: [stored.slice(0, 128)],
      gameEvents: [],
      relationshipChange: null,
      nextContext: '',
    });
  }
}

export function serializeSessionSummary(summary: StructuredSessionSummary): string {
  return JSON.stringify(structuredSessionSummarySchema.parse(summary));
}
