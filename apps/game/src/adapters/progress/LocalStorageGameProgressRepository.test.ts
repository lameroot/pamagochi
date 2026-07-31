import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageGameProgressRepository } from './LocalStorageGameProgressRepository.js';

const store = new Map<string, string>();

afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

function installStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

describe('LocalStorageGameProgressRepository', () => {
  it('persists only the typed local mock progress for a profile', async () => {
    installStorage();
    const repository = new LocalStorageGameProgressRepository();
    await repository.save('child-1', { hatched: true, interactedObjectIds: ['window'] });
    await expect(repository.load('child-1')).resolves.toEqual({
      hatched: true,
      interactedObjectIds: ['window'],
    });
  });

  it('falls back safely when stored data is malformed', async () => {
    installStorage();
    store.set('pamagochi:mock-progress:child-1', '{bad json');
    await expect(new LocalStorageGameProgressRepository().load('child-1')).resolves.toEqual({
      hatched: false,
      interactedObjectIds: [],
    });
  });
});
