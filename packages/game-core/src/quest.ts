export type QuestState = 'available' | 'in_progress' | 'completed';

const ALLOWED_TRANSITIONS: Record<QuestState, QuestState[]> = {
  available: ['in_progress'],
  in_progress: ['completed', 'available'],
  completed: [],
};

export function canTransitionQuest(from: QuestState, to: QuestState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionQuest(from: QuestState, to: QuestState): QuestState {
  if (!canTransitionQuest(from, to)) {
    throw new Error(`Invalid quest transition: ${from} -> ${to}`);
  }
  return to;
}
