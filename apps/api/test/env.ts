export function applyLocalTestEnv(): void {
  process.env.APP_PROFILE = 'local';
  process.env.NODE_ENV = 'test';
  process.env.API_PORT = process.env.API_PORT ?? '3100';
  process.env.WEB_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.DEV_AUTH_ENABLED = 'true';
  process.env.DEV_AUTH_SECRET =
    process.env.DEV_AUTH_SECRET ?? 'test-secret-please-generate-32-bytes-min';
  process.env.DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';
  process.env.DEV_USER_EMAIL = process.env.DEV_USER_EMAIL ?? 'developer@pamagochi.local';
  process.env.STORAGE_PROVIDER = 'filesystem';
  process.env.LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH ?? '.data/storage-test';
  process.env.LOCAL_STORAGE_SIGNING_SECRET =
    process.env.LOCAL_STORAGE_SIGNING_SECRET ?? 'test-secret-please-generate-32-bytes-min';
  process.env.JOB_PROVIDER = 'inline';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://pamagochi_test:pamagochi_test@localhost:5433/pamagochi_test';
}
