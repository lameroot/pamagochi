import { z } from 'zod';

export const conversationSpeakerSchema = z.enum(['child', 'agent', 'system_event']);
export type ConversationSpeaker = z.infer<typeof conversationSpeakerSchema>;

export const conversationSessionStatusSchema = z.enum([
  'active',
  'finalizing',
  'completed',
  'failed',
  'cancelled',
]);
export type ConversationSessionStatus = z.infer<typeof conversationSessionStatusSchema>;

export const conversationTurnSchema = z.object({
  id: z.string().min(1),
  conversationSessionId: z.string().min(1),
  sequenceNo: z.number().int().nonnegative(),
  speaker: conversationSpeakerSchema,
  text: z.string().max(8000),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  wasInterrupted: z.boolean(),
  playedTextLength: z.number().int().nonnegative().nullable(),
  safetyFlags: z.array(z.string().max(64)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type ConversationTurnDto = z.infer<typeof conversationTurnSchema>;

export const appendConversationTurnRequestSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  correlationId: z.string().min(1).max(128).optional(),
  sequenceNo: z.number().int().nonnegative(),
  speaker: conversationSpeakerSchema,
  text: z.string().max(8000),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  wasInterrupted: z.boolean().default(false),
  playedTextLength: z.number().int().nonnegative().nullable().optional(),
  safetyFlags: z.array(z.string().max(64)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AppendConversationTurnRequest = z.infer<typeof appendConversationTurnRequestSchema>;

export const conversationSessionSummarySchema = z.object({
  id: z.string().min(1),
  childId: z.string().min(1),
  gameSessionId: z.string().min(1),
  status: conversationSessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  soulVersion: z.string().nullable(),
  safetyPolicyVersion: z.string().nullable(),
  sessionSummary: z.string().max(4000).nullable(),
  turnCount: z.number().int().nonnegative().optional(),
});
export type ConversationSessionSummaryDto = z.infer<typeof conversationSessionSummarySchema>;

export const finalizeConversationSessionRequestSchema = z.object({
  status: z.enum(['completed', 'failed', 'cancelled']).default('completed'),
  sessionSummary: z.string().max(4000).optional(),
});
export type FinalizeConversationSessionRequest = z.infer<
  typeof finalizeConversationSessionRequestSchema
>;

export const appendConversationTurnResponseSchema = z.object({
  turn: conversationTurnSchema,
  created: z.boolean(),
});
export type AppendConversationTurnResponse = z.infer<typeof appendConversationTurnResponseSchema>;
