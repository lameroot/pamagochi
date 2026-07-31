import { describe, expect, it } from 'vitest';
import { GameActionExecutor } from './GameActionExecutor.js';
describe('GameActionExecutor', () => {
  it('rejects unknown objects before executing a response', () => {
    const executed: string[] = [];
    const executor = new GameActionExecutor({
      hasObject: (id) => id === 'window',
      execute: (action) => executed.push(action.type),
    });
    expect(
      executor.executeResponse({
        text: 'x',
        emotion: 'curious',
        actions: [{ type: 'look', targetId: 'unknown' }],
      }),
    ).toBe(false);
    expect(executed).toEqual([]);
  });
});
