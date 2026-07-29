import { z } from 'zod';
import { agentStateEventSchema } from './agent-state.js';
import { agentToolRequestSchema, agentToolResultSchema } from './tools.js';

/**
 * Versioned voice runtime protocol events between game <-> agent/api.
 * Bump protocolVersion only via coordinated contract change.
 */
export const VOICE_PROTOCOL_VERSION = '1' as const;

export const voiceRuntimeEventSchema = z.discriminatedUnion('type', [
  agentStateEventSchema,
  z.object({
    type: z.literal('tool-request'),
    protocolVersion: z.literal(VOICE_PROTOCOL_VERSION),
    request: agentToolRequestSchema,
  }),
  z.object({
    type: z.literal('tool-result'),
    protocolVersion: z.literal(VOICE_PROTOCOL_VERSION),
    result: agentToolResultSchema,
  }),
  z.object({
    type: z.literal('world-state'),
    protocolVersion: z.literal(VOICE_PROTOCOL_VERSION),
    sceneKey: z.string().min(1).max(64),
    state: z.string().min(1).max(64),
    visibleObjectIds: z.array(z.string().max(64)).max(64),
    interactiveObjectIds: z.array(z.string().max(64)).max(64),
    allowedEventIds: z.array(z.string().max(64)).max(64),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('parent-attention'),
    protocolVersion: z.literal(VOICE_PROTOCOL_VERSION),
    reason: z.string().min(1).max(64),
    shortSummary: z.string().max(240),
  }),
]);
export type VoiceRuntimeEvent = z.infer<typeof voiceRuntimeEventSchema>;
