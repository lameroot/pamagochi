import { z } from 'zod';
import { childAvatarKeySchema } from './child.js';
import { ageBandSchema } from './voice/bootstrap.js';
import {
  conversationSessionStatusSchema,
  conversationSpeakerSchema,
  conversationTurnSchema,
} from './voice/conversation.js';
import { memoryCategorySchema, memoryItemSchema } from './voice/memory.js';
import { safetyCategorySchema, safetyEventSchema, safetySeveritySchema } from './voice/safety.js';

export const privacyConsentTypeSchema = z.enum([
  'audio_recording',
  'transcript_retention',
  'data_processing',
]);
export type PrivacyConsentType = z.infer<typeof privacyConsentTypeSchema>;

export const privacyConsentSchema = z.object({
  id: z.string(),
  childId: z.string(),
  consentType: privacyConsentTypeSchema,
  version: z.string().min(1).max(32),
  grantedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type PrivacyConsentDto = z.infer<typeof privacyConsentSchema>;

export const grantPrivacyConsentRequestSchema = z.object({
  consentType: privacyConsentTypeSchema,
  version: z.string().min(1).max(32).default('1'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type GrantPrivacyConsentRequest = z.infer<typeof grantPrivacyConsentRequestSchema>;

export const listPrivacyConsentsResponseSchema = z.object({
  consents: z.array(privacyConsentSchema),
});
export type ListPrivacyConsentsResponse = z.infer<typeof listPrivacyConsentsResponseSchema>;

export const updateChildProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  avatarKey: childAvatarKeySchema.optional(),
  birthYear: z.number().int().min(2000).max(2100).nullable().optional(),
  birthDate: z.string().date().nullable().optional(),
  primaryLanguage: z.string().min(2).max(16).optional(),
  readingLevel: z.string().max(64).nullable().optional(),
  mathLevel: z.string().max(64).nullable().optional(),
});
export type UpdateChildProfileRequest = z.infer<typeof updateChildProfileRequestSchema>;

export const childOverviewSchema = z.object({
  childId: z.string(),
  displayName: z.string(),
  ageBand: ageBandSchema,
  avatarKey: childAvatarKeySchema,
  lastSession: z
    .object({
      conversationId: z.string(),
      startedAt: z.string().datetime(),
      endedAt: z.string().datetime().nullable(),
      sessionSummary: z.string().nullable(),
      status: conversationSessionStatusSchema,
    })
    .nullable(),
  activeGameSessionId: z.string().nullable(),
});
export type ChildOverviewDto = z.infer<typeof childOverviewSchema>;

export const conversationListItemSchema = z.object({
  id: z.string(),
  childId: z.string(),
  gameSessionId: z.string(),
  status: conversationSessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  sessionSummary: z.string().nullable(),
  turnCount: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  safetyFlagCount: z.number().int().nonnegative(),
});
export type ConversationListItemDto = z.infer<typeof conversationListItemSchema>;

export const paginatedConversationsResponseSchema = z.object({
  items: z.array(conversationListItemSchema),
  nextCursor: z.string().nullable(),
});
export type PaginatedConversationsResponse = z.infer<typeof paginatedConversationsResponseSchema>;

export const toolActionSummarySchema = z.object({
  id: z.string(),
  toolName: z.string(),
  validationResult: z.string(),
  createdAt: z.string().datetime(),
});
export type ToolActionSummaryDto = z.infer<typeof toolActionSummarySchema>;

export const proposedMemorySummarySchema = z.object({
  id: z.string(),
  category: memoryCategorySchema,
  fact: z.string(),
  status: z.string(),
});
export type ProposedMemorySummaryDto = z.infer<typeof proposedMemorySummarySchema>;

export const conversationDetailSchema = z.object({
  id: z.string(),
  childId: z.string(),
  gameSessionId: z.string(),
  status: conversationSessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  sessionSummary: z.string().nullable(),
  soulVersion: z.string().nullable(),
  safetyPolicyVersion: z.string().nullable(),
  llmProvider: z.string().nullable(),
  llmModel: z.string().nullable(),
  turnCount: z.number().int().nonnegative(),
  interruptedTurnCount: z.number().int().nonnegative(),
  turns: z.array(conversationTurnSchema),
  toolActions: z.array(toolActionSummarySchema),
  safetyEvents: z.array(safetyEventSchema),
  proposedMemory: z.array(proposedMemorySummarySchema),
});
export type ConversationDetailDto = z.infer<typeof conversationDetailSchema>;

export const memoryVersionSchema = z.object({
  id: z.string(),
  memoryItemId: z.string(),
  previousFact: z.string().nullable(),
  newFact: z.string(),
  changedBy: z.enum(['system', 'parent']),
  changedByUserId: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type MemoryVersionDto = z.infer<typeof memoryVersionSchema>;

export const listMemoryResponseSchema = z.object({
  items: z.array(memoryItemSchema),
});
export type ListMemoryResponse = z.infer<typeof listMemoryResponseSchema>;

export const createParentMemoryRequestSchema = z.object({
  category: z.literal('parent_note'),
  fact: z.string().min(1).max(280),
});
export type CreateParentMemoryRequest = z.infer<typeof createParentMemoryRequestSchema>;

export const updateMemoryRequestSchema = z.object({
  fact: z.string().min(1).max(280).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  pinned: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});
export type UpdateMemoryRequest = z.infer<typeof updateMemoryRequestSchema>;

export const memoryDetailSchema = memoryItemSchema.extend({
  versions: z.array(memoryVersionSchema),
});
export type MemoryDetailDto = z.infer<typeof memoryDetailSchema>;

export const childPrivacySettingsSchema = z.object({
  transcriptRetentionDays: z.number().int().min(1).max(3650).nullable(),
  audioRecordingConsent: z.boolean(),
  audioRecordingPermitted: z.boolean(),
});
export type ChildPrivacySettingsDto = z.infer<typeof childPrivacySettingsSchema>;

export const updateChildPrivacySettingsRequestSchema = z.object({
  transcriptRetentionDays: z.number().int().min(1).max(3650).nullable().optional(),
  audioRecordingConsent: z.boolean().optional(),
});
export type UpdateChildPrivacySettingsRequest = z.infer<
  typeof updateChildPrivacySettingsRequestSchema
>;

export const childDataExportSchema = z.object({
  exportedAt: z.string().datetime(),
  child: z.object({
    id: z.string(),
    displayName: z.string(),
    avatarKey: childAvatarKeySchema,
    birthYear: z.number().nullable(),
    primaryLanguage: z.string(),
    readingLevel: z.string().nullable(),
    mathLevel: z.string().nullable(),
    createdAt: z.string().datetime(),
  }),
  conversations: z.array(
    z.object({
      id: z.string(),
      startedAt: z.string().datetime(),
      endedAt: z.string().datetime().nullable(),
      sessionSummary: z.string().nullable(),
      turnCount: z.number().int().nonnegative(),
    }),
  ),
  memory: z.array(
    z.object({
      id: z.string(),
      category: memoryCategorySchema,
      fact: z.string(),
      status: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
  safetyEvents: z.array(safetyEventSchema),
  consents: z.array(privacyConsentSchema),
});
export type ChildDataExportDto = z.infer<typeof childDataExportSchema>;

export const paginatedSafetyEventsResponseSchema = z.object({
  items: z.array(safetyEventSchema),
  nextCursor: z.string().nullable(),
});
export type PaginatedSafetyEventsResponse = z.infer<typeof paginatedSafetyEventsResponseSchema>;

export const safetyEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: safetySeveritySchema.optional(),
  category: safetyCategorySchema.optional(),
});
export type SafetyEventsQuery = z.infer<typeof safetyEventsQuerySchema>;

export const conversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ConversationsQuery = z.infer<typeof conversationsQuerySchema>;

export const devRegisterRequestSchema = z.object({
  email: z.string().email(),
});
export type DevRegisterRequest = z.infer<typeof devRegisterRequestSchema>;

export const authTokenResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;
