import { z } from 'zod';

export const skillKeySchema = z.enum(['counting', 'reading', 'colors', 'shapes']);
export type SkillKey = z.infer<typeof skillKeySchema>;

export const skillProgressSchema = z.object({
  id: z.string(),
  childId: z.string(),
  skillKey: skillKeySchema,
  level: z.number().int().min(0),
  experience: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});
export type SkillProgressDto = z.infer<typeof skillProgressSchema>;
