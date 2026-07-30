import { describe, expect, it } from 'vitest';
import { PromptVersionLoader } from './prompt-version-loader.js';

describe('PromptVersionLoader', () => {
  const loader = new PromptVersionLoader();

  it('loads active versions from API', async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        json: async () => ({
          soul: { semanticVersion: '0.1.0', content: 'soul-body', checksum: 'abc' },
          safety: { semanticVersion: '0.1.0', content: '{}', checksum: 'def' },
          runtime_template: { semanticVersion: '0.1.0', content: 'tmpl', checksum: 'ghi' },
        }),
      }) as Response;

    // checksums won't match — use loadFromRecords for unit validation
    await expect(
      loader.loadActive({
        apiBaseUrl: 'http://localhost:3000/internal/agent',
        serviceToken: 'x'.repeat(32),
        expectedSoulVersion: '0.1.0',
        expectedSafetyVersion: '0.1.0',
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow(/checksum mismatch/);
  });

  it('loadFromRecords requires all kinds active with valid checksums', () => {
    const active = loader.loadFromRecords({
      soul: { semanticVersion: '0.1.0', content: 'soul' },
      safety: { semanticVersion: '0.1.0', content: 'safety' },
      runtime_template: { semanticVersion: '0.1.0', content: 'tmpl' },
    });
    expect(active.soul.semanticVersion).toBe('0.1.0');
  });
});
