import { z } from 'zod';

export const memoryCategorySchema = z.enum([
  'interest',
  'preference',
  'achievement',
  'relationship_event',
  'favorite_game_object',
  'learning_preference',
  'parent_note',
]);
export type MemoryCategory = z.infer<typeof memoryCategorySchema>;

export const memoryItemStatusSchema = z.enum(['active', 'disabled', 'deleted']);
export type MemoryItemStatus = z.infer<typeof memoryItemStatusSchema>;

export const memorySourceSchema = z.enum(['automatic', 'parent']);
export type MemorySource = z.infer<typeof memorySourceSchema>;

export const memoryItemSchema = z.object({
  id: z.string().min(1),
  childId: z.string().min(1),
  category: memoryCategorySchema,
  fact: z.string().min(1).max(280),
  status: memoryItemStatusSchema,
  source: memorySourceSchema,
  confidence: z.number().min(0).max(1),
  priority: z.number().int().min(0).max(100).default(0),
  pinned: z.boolean().default(false),
  sourceSessionId: z.string().nullable(),
  sourceTurnIds: z.array(z.string()).default([]),
  reviewAfter: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemoryItemDto = z.infer<typeof memoryItemSchema>;

export const memoryProposalSchema = z.object({
  category: memoryCategorySchema,
  fact: z.string().min(1).max(280),
  confidence: z.number().min(0).max(1),
  sourceTurnIds: z.array(z.string()).default([]),
  rationale: z.string().max(500),
});
export type MemoryProposal = z.infer<typeof memoryProposalSchema>;

export const relationshipStageSchema = z.enum([
  'first_meeting',
  'acquainted',
  'friends',
  'close_friends',
]);
export type RelationshipStage = z.infer<typeof relationshipStageSchema>;

export const relationshipStateSchema = z.object({
  childId: z.string().min(1),
  stage: relationshipStageSchema,
  trustProgress: z.number().min(0).max(1),
  sharedEvents: z.array(z.string().max(128)).default([]),
  lastSessionAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type RelationshipStateDto = z.infer<typeof relationshipStateSchema>;

export const memoryContextSchema = z.object({
  previousSummary: z.string().max(4000).nullable(),
  memoryItems: z.array(memoryItemSchema),
  relationship: relationshipStateSchema.nullable(),
  selectionReasons: z.array(z.string().max(200)).default([]),
});
export type MemoryContextDto = z.infer<typeof memoryContextSchema>;
