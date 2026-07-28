import { describe, expect, it } from 'vitest';
import { canTransitionQuest, transitionQuest } from './quest.js';

describe('quest transitions', () => {
  it('allows available -> in_progress -> completed', () => {
    expect(canTransitionQuest('available', 'in_progress')).toBe(true);
    expect(canTransitionQuest('in_progress', 'completed')).toBe(true);
  });

  it('disallows completed -> anything', () => {
    expect(canTransitionQuest('completed', 'in_progress')).toBe(false);
    expect(canTransitionQuest('completed', 'available')).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => transitionQuest('available', 'completed')).toThrow();
  });
});
