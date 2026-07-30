import { describe, expect, it } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoulLoader, formatSoulForPrompt } from './soul-loader.js';
import { SOUL_FORBIDDEN_KEYS } from './soul-schema.js';

const soulPath = join(dirname(fileURLToPath(import.meta.url)), 'pamagochi.soul.yaml');

describe('SoulLoader', () => {
  const loader = new SoulLoader();

  it('loads pamagochi.soul.yaml with version 0.1.0', () => {
    const loaded = loader.load({ filePath: soulPath });
    expect(loaded.document.version).toBe('0.1.0');
    expect(loaded.document.safety.immutable).toBe(true);
    expect(loaded.checksum).toHaveLength(64);
  });

  it('does not contain scene state, child memory, tools, or transcripts', () => {
    const loaded = loader.load({ filePath: soulPath });
    const keys = Object.keys(loaded.document);
    for (const forbidden of SOUL_FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
    const yamlLower = loaded.rawYaml.toLowerCase();
    expect(yamlLower).not.toMatch(/scene_state|child_memory|recent_turns|tools:/);
  });

  it('validates expected version and checksum', () => {
    const loaded = loader.load({ filePath: soulPath });
    expect(() =>
      loader.load({
        filePath: soulPath,
        expectedVersion: '9.9.9',
      }),
    ).toThrow(/version mismatch/);

    expect(() =>
      loader.load({
        filePath: soulPath,
        expectedChecksum: 'deadbeef',
      }),
    ).toThrow(/checksum mismatch/);

    expect(() =>
      loader.load({
        filePath: soulPath,
        expectedVersion: loaded.document.version,
        expectedChecksum: loaded.checksum,
      }),
    ).not.toThrow();
  });

  it('formats soul for prompt assembly', () => {
    const loaded = loader.load({ filePath: soulPath });
    const text = formatSoulForPrompt(loaded.document);
    expect(text).toContain('SOUL v0.1.0');
    expect(text).toContain('Памагочи');
  });
});
