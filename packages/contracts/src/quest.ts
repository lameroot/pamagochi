import { z } from 'zod';

export const questStatusSchema = z.enum(['available', 'in_progress', 'completed']);
export type QuestStatus = z.infer<typeof questStatusSchema>;

export const questProgressSchema = z.object({
  id: z.string(),
  childId: z.string(),
  questKey: z.string(),
  status: questStatusSchema,
  score: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});
export type QuestProgressDto = z.infer<typeof questProgressSchema>;
