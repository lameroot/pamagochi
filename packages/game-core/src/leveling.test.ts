import { describe, expect, it } from 'vitest';
import { addExperience, experienceProgressRatio, experienceToNextLevel } from './leveling.js';

describe('leveling', () => {
  it('computes increasing experience thresholds per level', () => {
    expect(experienceToNextLevel(0)).toBe(50);
    expect(experienceToNextLevel(1)).toBe(75);
    expect(experienceToNextLevel(2)).toBe(100);
  });

  it('adds experience without leveling up when below threshold', () => {
    const result = addExperience({ level: 0, experience: 10 }, 20);
    expect(result).toEqual({ level: 0, experience: 30 });
  });

  it('levels up once threshold is crossed', () => {
    const result = addExperience({ level: 0, experience: 40 }, 20);
    expect(result).toEqual({ level: 1, experience: 10 });
  });

  it('handles multiple level ups from a single large gain', () => {
    const result = addExperience({ level: 0, experience: 0 }, 200);
    expect(result.level).toBeGreaterThan(1);
  });

  it('rejects negative experience', () => {
    expect(() => addExperience({ level: 0, experience: 0 }, -5)).toThrow();
  });

  it('computes progress ratio', () => {
    expect(experienceProgressRatio({ level: 0, experience: 25 })).toBe(0.5);
  });
});
