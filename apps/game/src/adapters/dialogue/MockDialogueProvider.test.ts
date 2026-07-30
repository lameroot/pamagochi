import { describe, expect, it } from 'vitest';
import { MockDialogueProvider } from './MockDialogueProvider.js';
describe('MockDialogueProvider', () => {
  it('returns a data-driven safe response without network', async () => {
    const response = await new MockDialogueProvider().send({ objectId: 'window' });
    expect(response.actions[0]).toMatchObject({ type: 'look', targetId: 'window' });
  });
});
