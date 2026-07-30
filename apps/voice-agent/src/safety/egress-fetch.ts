import { assertEgressAllowed } from './egress-policy.js';

/**
 * fetch() wrapper that enforces the egress allowlist before every outbound call.
 */
export async function egressFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  assertEgressAllowed(url);
  return fetch(input, init);
}
