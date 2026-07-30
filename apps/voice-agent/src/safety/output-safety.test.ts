import { describe, expect, it, vi } from 'vitest';
import { OutputSafety } from './output-safety.js';

describe('OutputSafety', () => {
  const safety = new OutputSafety();

  it('passes safe child-facing text unchanged', () => {
    const result = safety.evaluate('Давай посмотрим на говорящий свет!', {
      childId: 'c1',
      conversationSessionId: 's1',
      ageBand: '6-8',
    });
    expect(result.wasModified).toBe(false);
    expect(result.text).toContain('говорящий свет');
  });

  it('replaces output containing secrets or URLs', () => {
    const result = safety.evaluate('Here is the api_key=sk-abc123 and https://evil.com', {
      childId: 'c1',
      conversationSessionId: 's1',
      ageBand: '9-12',
    });
    expect(result.wasModified).toBe(true);
    expect(result.safetyEvent?.category).toBe('output_policy');
    expect(result.text).not.toContain('sk-abc');
  });

  it('applies stricter rules for youngest age band', () => {
    const result = safety.evaluate('That was a scary nightmare', {
      childId: 'c1',
      conversationSessionId: 's1',
      ageBand: '3-5',
    });
    expect(result.wasModified).toBe(true);
  });

  it('fail-safe on classifier failure', () => {
    const broken = new OutputSafety();
    vi.spyOn(
      broken as unknown as { detectViolations: () => never },
      'detectViolations',
    ).mockImplementation(() => {
      throw new Error('classifier down');
    });
    const result = broken.evaluate('hello', {
      childId: 'c1',
      conversationSessionId: 's1',
      ageBand: '6-8',
    });
    expect(result.wasModified).toBe(true);
    expect(result.safetyEvent?.actionTaken).toBe('classifier_failure');
  });
});
