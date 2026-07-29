import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { webEnv } from '../lib/env.js';
import type { AuthClient } from './auth-client.js';

/**
 * Cloud-profile auth adapter backed by Supabase Auth. Session persistence
 * and automatic access-token refresh are handled internally by
 * `@supabase/supabase-js` (persistSession + autoRefreshToken, both default
 * to true in the browser).
 */
export class SupabaseAuthClient implements AuthClient {
  readonly mode = 'cloud' as const;
  readonly client: SupabaseClient;

  constructor() {
    if (!webEnv.supabaseUrl || !webEnv.supabaseAnonKey) {
      throw new Error(
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for the cloud profile',
      );
    }
    this.client = createClient(webEnv.supabaseUrl, webEnv.supabaseAnonKey);
  }

  isDevMode(): boolean {
    return false;
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error ?? new Error('Sign-in failed');
    return data.session;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}
