import { Injectable, Logger } from '@nestjs/common';
import type { AppProfile, AuthProvider } from '@pamagochi/contracts';
import { parseEnv, type RawEnv } from './env.schema.js';

/**
 * Central, validated application configuration. Never expose raw env values
 * or secrets through logging/introspection endpoints.
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly env: RawEnv;

  constructor() {
    const { env, warnings } = parseEnv(process.env);
    this.env = env;
    for (const warning of warnings) {
      this.logger.warn(warning);
    }
  }

  get appProfile(): AppProfile {
    return this.env.APP_PROFILE;
  }

  get authProvider(): AuthProvider {
    return this.env.AUTH_PROVIDER;
  }

  get storageProvider(): 'filesystem' | 'supabase-s3' {
    return this.env.STORAGE_PROVIDER;
  }

  get jobProvider(): 'inline' {
    return this.env.JOB_PROVIDER;
  }

  get port(): number {
    return this.env.PORT ?? this.env.API_PORT;
  }

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get webOrigins(): string[] {
    return this.env.WEB_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get devAuthEnabled(): boolean {
    return (
      this.appProfile === 'local' && this.authProvider === 'local' && this.env.DEV_AUTH_ENABLED
    );
  }

  get devAuthSecret(): string {
    if (!this.env.DEV_AUTH_SECRET) throw new Error('DEV_AUTH_SECRET is not configured');
    return this.env.DEV_AUTH_SECRET;
  }

  get devUserId(): string {
    return this.env.DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';
  }

  get devUserEmail(): string {
    return this.env.DEV_USER_EMAIL ?? 'developer@pamagochi.local';
  }

  get localStoragePath(): string {
    return this.env.LOCAL_STORAGE_PATH ?? '.data/storage';
  }

  get localStorageSigningSecret(): string {
    if (!this.env.LOCAL_STORAGE_SIGNING_SECRET) {
      throw new Error('LOCAL_STORAGE_SIGNING_SECRET is not configured');
    }
    return this.env.LOCAL_STORAGE_SIGNING_SECRET;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get supabase() {
    return {
      jwtIssuer: this.env.SUPABASE_JWT_ISSUER,
      jwksUrl: this.env.SUPABASE_JWKS_URL,
      jwtAudience: this.env.SUPABASE_JWT_AUDIENCE,
      storageBucket: this.env.SUPABASE_STORAGE_BUCKET,
      s3Endpoint: this.env.SUPABASE_S3_ENDPOINT,
      s3Region: this.env.SUPABASE_S3_REGION,
      s3AccessKey: this.env.SUPABASE_S3_ACCESS_KEY,
      s3SecretKey: this.env.SUPABASE_S3_SECRET_KEY,
    };
  }

  get commitSha(): string {
    return this.env.GIT_COMMIT_SHA ?? 'unknown';
  }

  get buildTime(): string {
    return this.env.BUILD_TIME ?? 'unknown';
  }

  get livekitUrl(): string | undefined {
    return this.env.LIVEKIT_URL;
  }

  get livekitCredentials(): { apiKey?: string; apiSecret?: string } {
    return {
      apiKey: this.env.LIVEKIT_API_KEY,
      apiSecret: this.env.LIVEKIT_API_SECRET,
    };
  }

  get voiceAgentServiceToken(): string | undefined {
    return this.env.VOICE_AGENT_SERVICE_TOKEN;
  }

  get voiceSessionMaxDurationSeconds(): number {
    return this.env.VOICE_SESSION_MAX_DURATION_SECONDS ?? 1800;
  }

  get voiceMaxConcurrentSessionsPerChild(): number {
    return this.env.VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD ?? 1;
  }
}
