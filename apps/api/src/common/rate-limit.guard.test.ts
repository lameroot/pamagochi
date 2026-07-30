import { describe, expect, it } from 'vitest';
import {
  AuthRateLimitGuard,
  InternalApiRateLimitGuard,
  ParentApiRateLimitGuard,
} from './rate-limit.guard.js';

function mockContext(ip: string, auth?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        headers: auth ? { authorization: auth } : {},
      }),
    }),
  } as never;
}

describe('rate-limit guards (E6.2)', () => {
  it('AuthRateLimitGuard blocks after max requests', () => {
    const guard = new AuthRateLimitGuard();
    const ctx = mockContext('10.0.0.1');
    for (let i = 0; i < 10; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
    expect(() => guard.canActivate(ctx)).toThrow(/Too many requests/);
  });

  it('ParentApiRateLimitGuard keys by bearer prefix', () => {
    const guard = new ParentApiRateLimitGuard();
    const ctx = mockContext('10.0.0.2', 'Bearer parent-token-abc123');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('InternalApiRateLimitGuard allows high throughput', () => {
    const guard = new InternalApiRateLimitGuard();
    const ctx = mockContext('10.0.0.3', 'Bearer svc-token-xyz');
    for (let i = 0; i < 100; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });
});
