import { dialogueResponseSchema, type PetAction } from '../adapters/dialogue/DialogueProvider.js';
export interface GameActionExecutorTarget {
  hasObject(id: string): boolean;
  execute(action: PetAction): void;
}
export class GameActionExecutor {
  constructor(private readonly target: GameActionExecutorTarget) {}
  executeResponse(input: unknown): boolean {
    const parsed = dialogueResponseSchema.safeParse(input);
    if (!parsed.success) return false;
    for (const action of parsed.data.actions) {
      const id =
        action.type === 'move' || action.type === 'look'
          ? action.targetId
          : action.type === 'interact'
            ? action.objectId
            : undefined;
      if (id && !this.target.hasObject(id)) return false;
    }
    for (const action of parsed.data.actions) this.target.execute(action);
    return true;
  }
}
