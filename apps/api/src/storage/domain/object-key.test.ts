import { describe, expect, it } from 'vitest';
import { assertSafeObjectKey, buildObjectKey, sanitizeFileNameSegment } from './object-key.js';

describe('sanitizeFileNameSegment', () => {
  it('strips directory components', () => {
    expect(sanitizeFileNameSegment('../../etc/passwd')).not.toContain('/');
  });

  it('replaces unsafe characters', () => {
    expect(sanitizeFileNameSegment('my file<>.png')).toBe('my_file__.png');
  });
});

describe('buildObjectKey', () => {
  it('namespaces by owner kind and id', () => {
    const key = buildObjectKey('parent', 'parent-123', 'avatar.png');
    expect(key.startsWith('users/parent-123/generated/')).toBe(true);
  });

  it('never produces a key with traversal segments even with malicious file names', () => {
    const key = buildObjectKey('child', 'child-456', '../../../etc/passwd');
    expect(() => assertSafeObjectKey(key)).not.toThrow();
    expect(key).not.toContain('..');
  });
});

describe('assertSafeObjectKey', () => {
  it('accepts well-formed relative keys', () => {
    expect(() => assertSafeObjectKey('users/abc/generated/file.png')).not.toThrow();
  });

  it('rejects absolute paths', () => {
    expect(() => assertSafeObjectKey('/etc/passwd')).toThrow();
  });

  it('rejects traversal segments', () => {
    expect(() => assertSafeObjectKey('users/../../etc/passwd')).toThrow();
    expect(() => assertSafeObjectKey('users/./x')).toThrow();
  });

  it('rejects backslashes', () => {
    expect(() => assertSafeObjectKey('users\\..\\x')).toThrow();
  });
});
