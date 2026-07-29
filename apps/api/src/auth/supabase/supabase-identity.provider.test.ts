import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../config/app-config.service.js';
import { SupabaseIdentityProvider } from './supabase-identity.provider.js';

const ISSUER = 'https://project-ref.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';

describe('SupabaseIdentityProvider (mock JWKS)', () => {
  let server: Server;
  let jwksUrl: string;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let provider: SupabaseIdentityProvider;

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-key-1';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';

    server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [publicJwk] }));
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    jwksUrl = `http://127.0.0.1:${port}/jwks.json`;

    process.env.APP_PROFILE = 'cloud';
    process.env.AUTH_PROVIDER = 'supabase';
    process.env.DEV_AUTH_ENABLED = 'false';
    process.env.WEB_ORIGINS = 'http://localhost:5173';
    process.env.STORAGE_PROVIDER = 'supabase-s3';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.SUPABASE_JWT_ISSUER = ISSUER;
    process.env.SUPABASE_JWKS_URL = jwksUrl;
    process.env.SUPABASE_JWT_AUDIENCE = AUDIENCE;
    process.env.SUPABASE_STORAGE_BUCKET = 'bucket';
    process.env.SUPABASE_S3_ENDPOINT = 'https://example.supabase.co/storage/v1/s3';
    process.env.SUPABASE_S3_REGION = 'eu-central-1';
    process.env.SUPABASE_S3_ACCESS_KEY = 'key';
    process.env.SUPABASE_S3_SECRET_KEY = 'secret';

    provider = new SupabaseIdentityProvider(new AppConfigService());
  });

  afterAll(() => {
    server.close();
  });

  async function signToken(overrides: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({ email: 'user@example.com', role: 'authenticated', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('supabase-user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  it('verifies a valid Supabase-issued JWT via JWKS', async () => {
    const token = await signToken();
    const identity = await provider.verifyAccessToken(token);
    expect(identity.subject).toBe('supabase-user-1');
    expect(identity.email).toBe('user@example.com');
    expect(identity.provider).toBe('supabase');
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await new SignJWT({ email: 'x@y.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('https://evil.example.com/auth/v1')
      .setAudience(AUDIENCE)
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(provider.verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await new SignJWT({ email: 'x@y.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('user-1')
      .setIssuedAt(0)
      .setExpirationTime(1)
      .sign(privateKey);

    await expect(provider.verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects a token signed with an unknown key', async () => {
    const otherKeyPair = await generateKeyPair('RS256');
    const token = await new SignJWT({ email: 'x@y.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(otherKeyPair.privateKey);

    await expect(provider.verifyAccessToken(token)).rejects.toThrow();
  });
});
