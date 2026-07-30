import { z } from 'zod';

export const childAvatarKeySchema = z.enum(['fox', 'owl', 'panda', 'dragon']);
export type ChildAvatarKey = z.infer<typeof childAvatarKeySchema>;

export const childProfileSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  displayName: z.string().min(1).max(40),
  avatarKey: childAvatarKeySchema,
  birthYear: z.number().int().min(2000).max(2100).nullable(),
  birthDate: z.string().date().nullable(),
  primaryLanguage: z.string().min(2).max(16),
  readingLevel: z.string().max(64).nullable(),
  mathLevel: z.string().max(64).nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChildProfileDto = z.infer<typeof childProfileSchema>;

export const createChildProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(40),
  avatarKey: childAvatarKeySchema,
  birthYear: z.number().int().min(2000).max(2100).nullable().optional(),
  birthDate: z.string().date().nullable().optional(),
  primaryLanguage: z.string().min(2).max(16).default('ru'),
  readingLevel: z.string().max(64).nullable().optional(),
  mathLevel: z.string().max(64).nullable().optional(),
});
export type CreateChildProfileRequest = z.infer<typeof createChildProfileRequestSchema>;

export const listChildProfilesResponseSchema = z.object({
  children: z.array(childProfileSchema),
});
export type ListChildProfilesResponse = z.infer<typeof listChildProfilesResponseSchema>;
