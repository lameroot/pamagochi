export type WebAppProfile = 'local' | 'cloud';

function readEnv(key: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[key];
}

export const webEnv = {
  appProfile: (readEnv('VITE_APP_PROFILE') ?? 'local') as WebAppProfile,
  apiUrl: readEnv('VITE_API_URL') ?? 'http://localhost:3000',
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
};
