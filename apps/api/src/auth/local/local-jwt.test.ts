import { describe, expect, it } from 'vitest';
import { LOCAL_JWT_AUDIENCE, LOCAL_JWT_ISSUER, signLocalJwt, verifyLocalJwt } from './local-jwt.js';

const secret = 'a'.repeat(32);

describe('local JWT', () => {
  it('signs and verifies a round trip', () => {
    const token = signLocalJwt({ subject: 'user-1', email: 'a@b.com', roles: ['parent'], secret });
    const payload = verifyLocalJwt(token, secret);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
    expect(payload.roles).toEqual(['parent']);
    expect(payload.iss).toBe(LOCAL_JWT_ISSUER);
    expect(payload.aud).toBe(LOCAL_JWT_AUDIENCE);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signLocalJwt({ subject: 'user-1', email: 'a@b.com', roles: [], secret });
    expect(() => verifyLocalJwt(token, 'b'.repeat(32))).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signLocalJwt({ subject: 'user-1', email: 'a@b.com', roles: [], secret });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyLocalJwt(tampered, secret)).toThrow();
  });
});
