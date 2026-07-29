import { describe, expect, it } from 'vitest';
import type { SttProviderFactory } from './providers.js';

describe('provider interfaces', () => {
  it('allows a stub factory', () => {
    const factory: SttProviderFactory = {
      create: (config) => ({ providerId: config.provider }),
    };
    expect(factory.create({ provider: 'deepgram' }).providerId).toBe('deepgram');
  });
});
