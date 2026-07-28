/**
 * Pure leveling/experience logic. No side effects, no I/O, no framework dependencies.
 */

export interface LevelState {
  level: number;
  experience: number;
}

/** Experience required to go from `level` to `level + 1`. Simple quadratic curve. */
export function experienceToNextLevel(level: number): number {
  if (level < 0) throw new RangeError('level must be >= 0');
  return 50 + level * 25;
}

export function addExperience(state: LevelState, amount: number): LevelState {
  if (amount < 0) throw new RangeError('amount must be >= 0');

  let level = state.level;
  let experience = state.experience + amount;

  while (experience >= experienceToNextLevel(level)) {
    experience -= experienceToNextLevel(level);
    level += 1;
  }

  return { level, experience };
}

export function experienceProgressRatio(state: LevelState): number {
  const required = experienceToNextLevel(state.level);
  return required === 0 ? 0 : Math.min(1, state.experience / required);
}
