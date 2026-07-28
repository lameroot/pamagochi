import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from './api-client.js';
import { ApiClient } from './api-client.js';

const schema = z.object({ ok: z.literal(true) });

describe('ApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches a bearer token when one is available', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient('http://api.local', async () => 'token-123');
    const result = await client.request('/api/x', schema);

    expect(result).toEqual({ ok: true });
    const call: unknown[] | undefined = fetchMock.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('throws a typed ApiError on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'CHILD_NOT_FOUND', message: 'nope', requestId: 'r1' },
            }),
            { status: 404 },
          ),
      ),
    );

    const client = new ApiClient('http://api.local', async () => null);
    await expect(client.request('/api/x', schema)).rejects.toMatchObject({
      code: 'CHILD_NOT_FOUND',
      status: 404,
    } satisfies Partial<ApiError>);
  });

  it('throws on a response that does not match the expected schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })),
    );

    const client = new ApiClient('http://api.local', async () => null);
    await expect(client.request('/api/x', schema)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE_SHAPE',
    });
  });
});
