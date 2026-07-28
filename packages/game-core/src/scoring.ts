export interface ScoreEvent {
  basePoints: number;
  streak: number;
  isCorrect: boolean;
}

/** Streak multiplier caps at 2x after a streak of 10 correct answers in a row. */
export function computeStreakMultiplier(streak: number): number {
  const clampedStreak = Math.max(0, streak);
  return 1 + Math.min(clampedStreak, 10) * 0.1;
}

export function computeScoreDelta(event: ScoreEvent): number {
  if (!event.isCorrect) return 0;
  const multiplier = computeStreakMultiplier(event.streak);
  return Math.round(event.basePoints * multiplier);
}

export function nextStreak(streak: number, isCorrect: boolean): number {
  return isCorrect ? streak + 1 : 0;
}
