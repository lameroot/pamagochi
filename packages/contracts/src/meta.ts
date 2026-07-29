import { z } from 'zod';
import { authProviderSchema } from './identity.js';

export const appProfileSchema = z.enum(['local', 'cloud']);
export type AppProfile = z.infer<typeof appProfileSchema>;

export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
});
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;

export const readinessCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['ok', 'fail']),
  message: z.string().optional(),
});
export type ReadinessCheck = z.infer<typeof readinessCheckSchema>;

export const readinessResponseSchema = z.object({
  status: z.enum(['ok', 'fail']),
  checks: z.array(readinessCheckSchema),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const versionResponseSchema = z.object({
  appName: z.literal('pamagochi-api'),
  apiVersion: z.string(),
  commitSha: z.string(),
  buildTime: z.string(),
  appProfile: appProfileSchema,
  authProvider: authProviderSchema,
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;
