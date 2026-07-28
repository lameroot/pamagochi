export interface RewardTier {
  minScore: number;
  rewardKey: string;
}

/** Tiers must be sorted ascending by minScore by the caller. */
export function resolveReward(score: number, tiers: RewardTier[]): string | null {
  let matched: RewardTier | null = null;
  for (const tier of tiers) {
    if (score >= tier.minScore) {
      matched = tier;
    }
  }
  return matched ? matched.rewardKey : null;
}

export const DEFAULT_REWARD_TIERS: RewardTier[] = [
  { minScore: 0, rewardKey: 'sticker_bronze' },
  { minScore: 50, rewardKey: 'sticker_silver' },
  { minScore: 150, rewardKey: 'sticker_gold' },
];
