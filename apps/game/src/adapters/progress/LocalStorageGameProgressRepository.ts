import {
  emptyProgress,
  type GameProgress,
  type GameProgressRepository,
} from './GameProgressRepository.js';
const keyFor = (id: string) => `pamagochi:mock-progress:${id}`;
export class LocalStorageGameProgressRepository implements GameProgressRepository {
  async load(profileId: string): Promise<GameProgress> {
    try {
      const raw = localStorage.getItem(keyFor(profileId));
      if (!raw) return emptyProgress();
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return emptyProgress();
      const progress = value as Partial<GameProgress>;
      return {
        hatched: progress.hatched === true,
        interactedObjectIds: Array.isArray(progress.interactedObjectIds)
          ? progress.interactedObjectIds.filter((id): id is string => typeof id === 'string')
          : [],
      };
    } catch {
      return emptyProgress();
    }
  }
  async save(profileId: string, progress: GameProgress): Promise<void> {
    localStorage.setItem(keyFor(profileId), JSON.stringify(progress));
  }
}
