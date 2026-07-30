import { z } from 'zod';

export const safetySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type SafetySeverity = z.infer<typeof safetySeveritySchema>;

export const safetyCategorySchema = z.enum([
  'prompt_injection',
  'prompt_extraction',
  'tool_escalation',
  'memory_poisoning',
  'pii',
  'harmful_content',
  'external_contact',
  'secrecy_from_parents',
  'cost_exhaustion',
  'output_policy',
  'other',
]);
export type SafetyCategory = z.infer<typeof safetyCategorySchema>;

export const safetyEventSchema = z.object({
  id: z.string().min(1),
  childId: z.string().min(1),
  conversationSessionId: z.string().nullable(),
  turnId: z.string().nullable(),
  category: safetyCategorySchema,
  severity: safetySeveritySchema,
  detectedBy: z.string().min(1).max(64),
  inputExcerpt: z.string().max(280).nullable(),
  actionTaken: z.string().min(1).max(128),
  parentVisible: z.boolean(),
  createdAt: z.string().datetime(),
});
export type SafetyEventDto = z.infer<typeof safetyEventSchema>;

export const createSafetyEventRequestSchema = z.object({
  conversationSessionId: z.string().nullable().optional(),
  turnId: z.string().nullable().optional(),
  category: safetyCategorySchema,
  severity: safetySeveritySchema,
  detectedBy: z.string().min(1).max(64),
  inputExcerpt: z.string().max(280).nullable().optional(),
  actionTaken: z.string().min(1).max(128),
  parentVisible: z.boolean().default(true),
});
export type CreateSafetyEventRequest = z.infer<typeof createSafetyEventRequestSchema>;
