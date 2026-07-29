import { z } from 'zod';

export const parentAccountSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  createdAt: z.string().datetime(),
});
export type ParentAccountDto = z.infer<typeof parentAccountSchema>;

export const meResponseSchema = z.object({
  parent: parentAccountSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;
