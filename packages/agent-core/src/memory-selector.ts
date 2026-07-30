import type { MemoryContextDto, MemoryItemDto } from '@pamagochi/contracts';

const MIN_ITEMS = 5;
const MAX_ITEMS = 15;

export interface MemorySelectionInput {
  activeMemories: MemoryItemDto[];
  previousSummary: string | null;
  relationship: MemoryContextDto['relationship'];
  now?: Date;
}

export interface MemorySelectionResult {
  previousSummary: string | null;
  memoryItems: MemoryItemDto[];
  relationship: MemoryContextDto['relationship'];
  selectionReasons: string[];
}

function isSelectable(item: MemoryItemDto): boolean {
  return item.status === 'active';
}

function scoreItem(item: MemoryItemDto, now: Date): number {
  let score = item.priority;
  if (item.pinned) score += 1000;
  const ageDays = (now.getTime() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - ageDays);
  return score;
}

/**
 * Selects 5–15 active memory items for the next session context.
 * Deleted/disabled items are excluded; selection is stable and explainable.
 */
export function selectMemoryForSession(input: MemorySelectionInput): MemorySelectionResult {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const eligible = input.activeMemories.filter((m) => isSelectable(m));

  const pinned = eligible.filter((m) => m.pinned);
  if (pinned.length > 0) {
    reasons.push(`Included ${pinned.length} pinned item(s)`);
  }

  const sorted = [...eligible].sort((a, b) => {
    const scoreDiff = scoreItem(b, now) - scoreItem(a, now);
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  });

  const selected: MemoryItemDto[] = [];
  const seen = new Set<string>();

  for (const item of pinned) {
    if (selected.length >= MAX_ITEMS) break;
    selected.push(item);
    seen.add(item.id);
  }

  for (const item of sorted) {
    if (selected.length >= MAX_ITEMS) break;
    if (seen.has(item.id)) continue;
    selected.push(item);
    seen.add(item.id);
  }

  if (selected.length < MIN_ITEMS) {
    for (const item of sorted) {
      if (selected.length >= MIN_ITEMS) break;
      if (seen.has(item.id)) continue;
      selected.push(item);
      seen.add(item.id);
    }
  }

  reasons.push(`Selected ${selected.length} of ${eligible.length} eligible active memories`);
  if (input.previousSummary) {
    reasons.push('Included last session summary');
  }
  if (input.relationship) {
    reasons.push(`Relationship stage: ${input.relationship.stage}`);
  }

  return {
    previousSummary: input.previousSummary,
    memoryItems: selected.slice(0, MAX_ITEMS),
    relationship: input.relationship,
    selectionReasons: reasons,
  };
}
