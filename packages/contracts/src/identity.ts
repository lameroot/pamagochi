import { z } from 'zod';

export const authProviderSchema = z.enum(['local', 'supabase']);
export type AuthProvider = z.infer<typeof authProviderSchema>;

/**
 * Identity resolved from a verified access token (local dev JWT or Supabase JWT).
 * `subject` maps 1:1 to `ParentAccount.authSubject`.
 */
export const authenticatedIdentitySchema = z.object({
  subject: z.string().min(1),
  email: z.string().email().optional(),
  roles: z.array(z.string()).default([]),
  provider: authProviderSchema,
});
export type AuthenticatedIdentity = z.infer<typeof authenticatedIdentitySchema>;
