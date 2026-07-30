import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.schema.js';

const baseLocalEnv = {
  APP_PROFILE: 'local',
  WEB_ORIGINS: 'http://localhost:5173',
  AUTH_PROVIDER: 'local',
  DEV_AUTH_ENABLED: 'true',
  DEV_AUTH_SECRET: 'a'.repeat(32),
  STORAGE_PROVIDER: 'filesystem',
  LOCAL_STORAGE_SIGNING_SECRET: 'b'.repeat(32),
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

describe('parseEnv', () => {
  it('accepts a valid local configuration', () => {
    const result = parseEnv(baseLocalEnv);
    expect(result.env.APP_PROFILE).toBe('local');
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects an unknown APP_PROFILE value', () => {
    expect(() => parseEnv({ ...baseLocalEnv, APP_PROFILE: 'staging' })).toThrow();
  });

  it('rejects APP_PROFILE=cloud combined with AUTH_PROVIDER=local', () => {
    expect(() =>
      parseEnv({ ...baseLocalEnv, APP_PROFILE: 'cloud', AUTH_PROVIDER: 'local' }),
    ).toThrow(/AUTH_PROVIDER=local/);
  });

  it('rejects APP_PROFILE=cloud combined with DEV_AUTH_ENABLED=true', () => {
    expect(() =>
      parseEnv({
        ...baseLocalEnv,
        APP_PROFILE: 'cloud',
        AUTH_PROVIDER: 'supabase',
        DEV_AUTH_ENABLED: 'true',
        SUPABASE_JWT_ISSUER: 'https://x.supabase.co/auth/v1',
        SUPABASE_JWKS_URL: 'https://x.supabase.co/auth/v1/.well-known/jwks.json',
        SUPABASE_JWT_AUDIENCE: 'authenticated',
      }),
    ).toThrow(/DEV_AUTH_ENABLED/);
  });

  it('warns (but does not throw) when APP_PROFILE=local has a stray SUPABASE_SERVICE_ROLE_KEY', () => {
    const result = parseEnv({ ...baseLocalEnv, SUPABASE_SERVICE_ROLE_KEY: 'leaked' });
    expect(result.warnings.some((w) => w.includes('SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
  });

  it('rejects a DEV_AUTH_SECRET shorter than 32 bytes', () => {
    expect(() => parseEnv({ ...baseLocalEnv, DEV_AUTH_SECRET: 'short' })).toThrow(/32 bytes/);
  });

  it('requires supabase settings when AUTH_PROVIDER=supabase', () => {
    expect(() =>
      parseEnv({
        ...baseLocalEnv,
        APP_PROFILE: 'cloud',
        AUTH_PROVIDER: 'supabase',
        DEV_AUTH_ENABLED: 'false',
      }),
    ).toThrow(/SUPABASE_JWT_ISSUER/);
  });
});

it('rejects partial LiveKit configuration', () => {
  expect(() => parseEnv({ ...baseLocalEnv, LIVEKIT_URL: 'wss://example.livekit.cloud' })).toThrow(
    /LIVEKIT_API_KEY/,
  );
});

it('accepts complete optional LiveKit configuration', () => {
  const result = parseEnv({
    ...baseLocalEnv,
    LIVEKIT_URL: 'wss://example.livekit.cloud',
    LIVEKIT_API_KEY: 'key',
    LIVEKIT_API_SECRET: 'secret',
    VOICE_AGENT_SERVICE_TOKEN: 'c'.repeat(32),
  });
  expect(result.env.LIVEKIT_URL).toContain('wss://');
});
