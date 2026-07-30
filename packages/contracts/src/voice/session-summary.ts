import { z } from 'zod';

export const structuredSessionSummarySchema = z.object({
  topics: z.array(z.string().max(128)).max(10).default([]),
  gameEvents: z.array(z.string().max(200)).max(10).default([]),
  relationshipChange: z.string().max(500).nullable().default(null),
  nextContext: z.string().max(500).default(''),
});
export type StructuredSessionSummary = z.infer<typeof structuredSessionSummarySchema>;
