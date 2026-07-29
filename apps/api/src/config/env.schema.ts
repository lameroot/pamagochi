import { z } from 'zod';

const appProfileSchema = z.enum(['local', 'cloud']);
const authProviderSchema = z.enum(['local', 'supabase']);
const storageProviderSchema = z.enum(['filesystem', 'supabase-s3']);
const jobProviderSchema = z.enum(['inline']);

const booleanFromString = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const rawEnvSchema = z.object({
  APP_PROFILE: appProfileSchema,
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  PORT: z.coerce.number().int().positive().optional(),
  WEB_ORIGINS: z.string().min(1),

  AUTH_PROVIDER: authProviderSchema,
  DEV_AUTH_ENABLED: booleanFromString,
  DEV_AUTH_SECRET: z.string().optional(),
  DEV_USER_ID: z.string().optional(),
  DEV_USER_EMAIL: z.string().email().optional(),

  STORAGE_PROVIDER: storageProviderSchema,
  LOCAL_STORAGE_PATH: z.string().optional(),
  LOCAL_STORAGE_SIGNING_SECRET: z.string().optional(),

  JOB_PROVIDER: jobProviderSchema.default('inline'),

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_JWT_ISSUER: z.string().url().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_AUDIENCE: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  SUPABASE_S3_ENDPOINT: z.string().url().optional(),
  SUPABASE_S3_REGION: z.string().optional(),
  SUPABASE_S3_ACCESS_KEY: z.string().optional(),
  SUPABASE_S3_SECRET_KEY: z.string().optional(),

  GIT_COMMIT_SHA: z.string().optional(),
  BUILD_TIME: z.string().optional(),
});

export type RawEnv = z.infer<typeof rawEnvSchema>;

export class InvalidEnvironmentConfigurationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'InvalidEnvironmentConfigurationError';
  }
}

export interface WarningCollector {
  warnings: string[];
}

function assertForbiddenCombinations(env: RawEnv, warnings: string[]): string[] {
  const errors: string[] = [];

  if (env.APP_PROFILE === 'cloud' && env.AUTH_PROVIDER === 'local') {
    errors.push('APP_PROFILE=cloud cannot be combined with AUTH_PROVIDER=local');
  }

  if (env.APP_PROFILE === 'cloud' && env.DEV_AUTH_ENABLED) {
    errors.push('APP_PROFILE=cloud cannot be combined with DEV_AUTH_ENABLED=true');
  }

  if (env.APP_PROFILE === 'local' && env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      'SUPABASE_SERVICE_ROLE_KEY is set while APP_PROFILE=local; it will not be used and should be removed.',
    );
  }

  if (env.AUTH_PROVIDER === 'local' && env.DEV_AUTH_ENABLED && !env.DEV_AUTH_SECRET) {
    errors.push('DEV_AUTH_ENABLED=true requires DEV_AUTH_SECRET to be set');
  }

  if (env.DEV_AUTH_SECRET && Buffer.byteLength(env.DEV_AUTH_SECRET, 'utf8') < 32) {
    errors.push('DEV_AUTH_SECRET must be at least 32 bytes long');
  }

  if (env.STORAGE_PROVIDER === 'filesystem' && !env.LOCAL_STORAGE_SIGNING_SECRET) {
    errors.push('STORAGE_PROVIDER=filesystem requires LOCAL_STORAGE_SIGNING_SECRET to be set');
  }

  if (
    env.LOCAL_STORAGE_SIGNING_SECRET &&
    Buffer.byteLength(env.LOCAL_STORAGE_SIGNING_SECRET, 'utf8') < 32
  ) {
    errors.push('LOCAL_STORAGE_SIGNING_SECRET must be at least 32 bytes long');
  }

  if (env.AUTH_PROVIDER === 'supabase') {
    const requiredForSupabaseAuth: Array<keyof RawEnv> = [
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWKS_URL',
      'SUPABASE_JWT_AUDIENCE',
    ];
    for (const key of requiredForSupabaseAuth) {
      if (!env[key]) errors.push(`AUTH_PROVIDER=supabase requires ${key} to be set`);
    }
  }

  if (env.STORAGE_PROVIDER === 'supabase-s3') {
    const requiredForSupabaseStorage: Array<keyof RawEnv> = [
      'SUPABASE_STORAGE_BUCKET',
      'SUPABASE_S3_ENDPOINT',
      'SUPABASE_S3_REGION',
      'SUPABASE_S3_ACCESS_KEY',
      'SUPABASE_S3_SECRET_KEY',
    ];
    for (const key of requiredForSupabaseStorage) {
      if (!env[key]) errors.push(`STORAGE_PROVIDER=supabase-s3 requires ${key} to be set`);
    }
  }

  return errors;
}

export interface ParsedEnvResult {
  env: RawEnv;
  warnings: string[];
}

/**
 * Validates process.env at startup. Throws a descriptive
 * InvalidEnvironmentConfigurationError on any unknown value or forbidden
 * profile/provider combination, causing the process to exit early with a
 * clear message instead of failing later in a confusing way.
 */
export function parseEnv(source: NodeJS.ProcessEnv): ParsedEnvResult {
  const result = rawEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new InvalidEnvironmentConfigurationError(
      `Invalid environment configuration: ${issues.join('; ')}`,
      issues,
    );
  }

  const warnings: string[] = [];
  const errors = assertForbiddenCombinations(result.data, warnings);
  if (errors.length > 0) {
    throw new InvalidEnvironmentConfigurationError(
      `Forbidden environment configuration: ${errors.join('; ')}`,
      errors,
    );
  }

  return { env: result.data, warnings };
}
