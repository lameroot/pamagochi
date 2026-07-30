import { describe, expect, it, vi } from 'vitest';
import { assertEgressAllowed } from './egress-policy.js';
import { egressFetch } from './egress-fetch.js';

describe('egressFetch', () => {
  it('blocks disallowed hosts before calling fetch', async () => {
    expect(() => assertEgressAllowed('https://evil.example/x')).toThrow(/Egress blocked/);
    await expect(egressFetch('https://evil.example/x')).rejects.toThrow(/Egress blocked/);
  });

  it('allows internal API hosts', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 })) as typeof fetch;
    try {
      const res = await egressFetch('http://localhost:3000/internal/agent/usage');
      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});
