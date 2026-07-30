import { z } from 'zod';

export const promptVersionKindSchema = z.enum(['soul', 'safety', 'runtime_template']);
export type PromptVersionKindDto = z.infer<typeof promptVersionKindSchema>;

export const promptVersionStatusSchema = z.enum(['draft', 'active', 'retired']);
export type PromptVersionStatusDto = z.infer<typeof promptVersionStatusSchema>;

export const promptVersionEntrySchema = z.object({
  semanticVersion: z.string().min(1).max(32),
  content: z.string().min(1),
  checksum: z.string().min(64).max(64),
  releaseNotes: z.string().max(2000).nullable().optional(),
});
export type PromptVersionEntryDto = z.infer<typeof promptVersionEntrySchema>;

export const activePromptVersionsResponseSchema = z.object({
  soul: promptVersionEntrySchema,
  safety: promptVersionEntrySchema,
  runtime_template: promptVersionEntrySchema,
});
export type ActivePromptVersionsResponse = z.infer<typeof activePromptVersionsResponseSchema>;
