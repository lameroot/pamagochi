import { describe, expect, it } from 'vitest';
import { DEFAULT_REWARD_TIERS, resolveReward } from './rewards.js';

describe('resolveReward', () => {
  it('resolves the highest matching tier', () => {
    expect(resolveReward(0, DEFAULT_REWARD_TIERS)).toBe('sticker_bronze');
    expect(resolveReward(75, DEFAULT_REWARD_TIERS)).toBe('sticker_silver');
    expect(resolveReward(500, DEFAULT_REWARD_TIERS)).toBe('sticker_gold');
  });

  it('returns null when no tier matches', () => {
    expect(resolveReward(-1, [{ minScore: 0, rewardKey: 'x' }])).toBe(null);
  });
});
