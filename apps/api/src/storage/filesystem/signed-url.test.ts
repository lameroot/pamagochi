import { describe, expect, it } from 'vitest';
import { signUrlParams, verifyUrlSignature } from './signed-url.js';

describe('signed url HMAC', () => {
  const secret = 'a'.repeat(32);

  it('verifies a signature generated with the same secret', () => {
    const params = {
      key: 'users/1/generated/a.png',
      method: 'GET' as const,
      expiresAtEpochSeconds: Date.now() / 1000 + 60,
    };
    const sig = signUrlParams(secret, params);
    expect(verifyUrlSignature(secret, params, sig)).toBe(true);
  });

  it('rejects a tampered key', () => {
    const params = {
      key: 'users/1/generated/a.png',
      method: 'GET' as const,
      expiresAtEpochSeconds: Date.now() / 1000 + 60,
    };
    const sig = signUrlParams(secret, params);
    expect(verifyUrlSignature(secret, { ...params, key: 'users/2/generated/a.png' }, sig)).toBe(
      false,
    );
  });

  it('rejects an expired signature', () => {
    const params = {
      key: 'users/1/generated/a.png',
      method: 'GET' as const,
      expiresAtEpochSeconds: Date.now() / 1000 - 5,
    };
    const sig = signUrlParams(secret, params);
    expect(verifyUrlSignature(secret, params, sig)).toBe(false);
  });

  it('rejects a signature produced with a different secret', () => {
    const params = {
      key: 'users/1/generated/a.png',
      method: 'GET' as const,
      expiresAtEpochSeconds: Date.now() / 1000 + 60,
    };
    const sig = signUrlParams('b'.repeat(32), params);
    expect(verifyUrlSignature(secret, params, sig)).toBe(false);
  });
});
