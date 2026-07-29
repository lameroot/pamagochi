import { webEnv } from '../lib/env.js';
import type { AuthClient } from './auth-client.js';
import { LocalAuthClient } from './local-auth-client.js';
import { SupabaseAuthClient } from './supabase-auth-client.js';

let cached: AuthClient | undefined;

export function getAuthClient(): AuthClient {
  if (!cached) {
    cached = webEnv.appProfile === 'cloud' ? new SupabaseAuthClient() : new LocalAuthClient();
  }
  return cached;
}
