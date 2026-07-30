import { describe, expect, it } from 'vitest';
import {
  computePromptChecksum,
  requireActivePromptVersions,
  type PromptVersionRecord,
} from './prompt-versions.js';

function record(
  kind: PromptVersionRecord['kind'],
  content: string,
  status: PromptVersionRecord['status'] = 'active',
): PromptVersionRecord {
  return {
    kind,
    semanticVersion: '0.1.0',
    content,
    checksum: computePromptChecksum(content),
    status,
  };
}

describe('prompt-versions', () => {
  it('computes stable SHA-256 checksums', () => {
    const a = computePromptChecksum('hello');
    const b = computePromptChecksum('hello');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('requires active versions for all kinds', () => {
    const active = requireActivePromptVersions({
      soul: record('soul', 'soul-content'),
      safety: record('safety', '{"version":"0.1.0"}'),
      runtime_template: record('runtime_template', 'template'),
    });
    expect(active.soul.content).toBe('soul-content');
  });

  it('throws when a kind is missing or not active', () => {
    expect(() =>
      requireActivePromptVersions({
        soul: record('soul', 'x'),
        safety: record('safety', 'y', 'draft'),
      }),
    ).toThrow(/Missing active agent_prompt_versions/);
  });

  it('throws on checksum mismatch', () => {
    expect(() =>
      requireActivePromptVersions({
        soul: { ...record('soul', 'x'), checksum: 'bad' },
        safety: record('safety', 'y'),
        runtime_template: record('runtime_template', 'z'),
      }),
    ).toThrow(/checksum mismatch/);
  });
});
