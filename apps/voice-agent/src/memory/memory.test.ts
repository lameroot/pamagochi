import { describe, expect, it } from 'vitest';
import { MemoryPolicyValidator } from './memory-policy-validator.js';
import { summarizeSession } from './session-summarizer.js';
import { extractMemoryProposals } from './memory-extractor.js';
import { selectMemoryForSession } from './memory-selector.js';

describe('voice-agent memory modules', () => {
  it('re-exports agent-core memory pipeline', () => {
    const transcript = [
      { id: 't1', speaker: 'child' as const, text: 'Я люблю роботов', sequenceNo: 0 },
    ];
    expect(summarizeSession(transcript).topics.length).toBeGreaterThan(0);
    const proposals = extractMemoryProposals({ transcript });
    expect(proposals).toHaveLength(1);
    expect(
      new MemoryPolicyValidator().validate(proposals[0]!, {
        existingFacts: [],
        childTurnTexts: ['Я люблю роботов'],
      }).accepted,
    ).toBe(true);
    expect(
      selectMemoryForSession({
        activeMemories: [],
        previousSummary: null,
        relationship: null,
      }).memoryItems,
    ).toEqual([]);
  });
});
