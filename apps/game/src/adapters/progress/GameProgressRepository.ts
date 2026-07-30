export interface GameProgress {
  hatched: boolean;
  interactedObjectIds: string[];
}
export interface GameProgressRepository {
  load(profileId: string): Promise<GameProgress>;
  save(profileId: string, progress: GameProgress): Promise<void>;
}
export const emptyProgress = (): GameProgress => ({ hatched: false, interactedObjectIds: [] });
