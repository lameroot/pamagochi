import { describe, expect, it } from 'vitest';
import { computeScoreDelta, computeStreakMultiplier, nextStreak } from './scoring.js';

describe('scoring', () => {
  it('gives zero points for incorrect answers', () => {
    expect(computeScoreDelta({ basePoints: 10, streak: 5, isCorrect: false })).toBe(0);
  });

  it('applies streak multiplier to correct answers', () => {
    expect(computeScoreDelta({ basePoints: 10, streak: 0, isCorrect: true })).toBe(10);
    expect(computeScoreDelta({ basePoints: 10, streak: 10, isCorrect: true })).toBe(20);
  });

  it('caps streak multiplier at 10 streak', () => {
    expect(computeStreakMultiplier(100)).toBe(2);
  });

  it('resets streak on incorrect answer', () => {
    expect(nextStreak(5, false)).toBe(0);
    expect(nextStreak(5, true)).toBe(6);
  });
});
