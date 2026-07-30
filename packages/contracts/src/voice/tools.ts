import { z } from 'zod';

/**
 * Allowlisted voice-agent tools for the first product version.
 * Generic execute_action / arbitrary RPC is intentionally absent (ADR 0003).
 */

export const characterEmotionSchema = z.enum(['curious', 'happy', 'confused', 'surprised', 'calm']);
export type CharacterEmotion = z.infer<typeof characterEmotionSchema>;

export const characterGestureSchema = z.enum(['wave', 'nod', 'point', 'step_back', 'look_around']);
export type CharacterGesture = z.infer<typeof characterGestureSchema>;

export const highlightIntensitySchema = z.enum(['subtle', 'normal']);

export const parentAttentionReasonSchema = z.enum([
  'microphone_problem',
  'technical_problem',
  'child_requests_parent',
  'safety_concern',
]);

const objectIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

const eventIdSchema = objectIdSchema;

export const characterEmoteArgsSchema = z.object({
  emotion: characterEmotionSchema,
});

export const characterLookAtArgsSchema = z.object({
  targetId: objectIdSchema,
});

export const characterGestureArgsSchema = z.object({
  gesture: characterGestureSchema,
});

export const sceneHighlightObjectArgsSchema = z.object({
  objectId: objectIdSchema,
  intensity: highlightIntensitySchema.default('normal'),
});

export const sceneRequestEventArgsSchema = z.object({
  eventId: eventIdSchema,
});

export const requestParentAttentionArgsSchema = z.object({
  reason: parentAttentionReasonSchema,
  shortSummary: z.string().min(1).max(240),
});

export const agentToolNameSchema = z.enum([
  'character_emote',
  'character_look_at',
  'character_gesture',
  'scene_highlight_object',
  'scene_request_event',
  'request_parent_attention',
]);
export type AgentToolName = z.infer<typeof agentToolNameSchema>;

export const agentToolRequestSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('character_emote'),
    callId: z.string().min(1).max(128),
    arguments: characterEmoteArgsSchema,
  }),
  z.object({
    name: z.literal('character_look_at'),
    callId: z.string().min(1).max(128),
    arguments: characterLookAtArgsSchema,
  }),
  z.object({
    name: z.literal('character_gesture'),
    callId: z.string().min(1).max(128),
    arguments: characterGestureArgsSchema,
  }),
  z.object({
    name: z.literal('scene_highlight_object'),
    callId: z.string().min(1).max(128),
    arguments: sceneHighlightObjectArgsSchema,
  }),
  z.object({
    name: z.literal('scene_request_event'),
    callId: z.string().min(1).max(128),
    arguments: sceneRequestEventArgsSchema,
  }),
  z.object({
    name: z.literal('request_parent_attention'),
    callId: z.string().min(1).max(128),
    arguments: requestParentAttentionArgsSchema,
  }),
]);
export type AgentToolRequest = z.infer<typeof agentToolRequestSchema>;

export const agentToolValidationResultSchema = z.enum([
  'accepted',
  'rejected_schema',
  'rejected_allowlist',
  'rejected_state',
  'rejected_ownership',
  'rejected_rate_limit',
  'rejected_timeout',
  'rejected_unknown_tool',
]);
export type AgentToolValidationResult = z.infer<typeof agentToolValidationResultSchema>;

export const agentToolResultSchema = z.object({
  callId: z.string().min(1).max(128),
  name: agentToolNameSchema,
  validation: agentToolValidationResultSchema,
  /** Safe, child-facing or agent-facing message — never secrets or stack traces. */
  safeMessage: z.string().max(500),
  /** Optional structured payload for the game bridge (no secrets). */
  gamePayload: z.record(z.string(), z.unknown()).optional(),
});
export type AgentToolResult = z.infer<typeof agentToolResultSchema>;
