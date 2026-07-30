import { z } from 'zod';
import { agentStateSchema } from './agent-state.js';
import { memoryContextSchema } from './memory.js';
import { introProgressDtoSchema } from './intro-progress.js';

/**
 * Limited game-session bootstrap exchanged between apps/game and apps/api.
 * Must never include parent JWT, provider secrets, or full birth dates.
 */

export const ageBandSchema = z.enum(['3-5', '6-8', '9-12']);
export type AgeBand = z.infer<typeof ageBandSchema>;

export const createGameSessionRequestSchema = z.object({
  childId: z.string().min(1),
  deviceId: z.string().min(1).max(128).optional(),
});
export type CreateGameSessionRequest = z.infer<typeof createGameSessionRequestSchema>;

export const createGameSessionResponseSchema = z.object({
  gameSessionId: z.string().min(1),
  /** Opaque limited token for game bootstrap — not a parent JWT. */
  limitedGameToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  gameLaunchPath: z.string().min(1),
});
export type CreateGameSessionResponse = z.infer<typeof createGameSessionResponseSchema>;

export const gameBootstrapRequestSchema = z.object({
  limitedGameToken: z.string().min(1),
});
export type GameBootstrapRequest = z.infer<typeof gameBootstrapRequestSchema>;

export const gameBootstrapResponseSchema = z.object({
  protocolVersion: z.literal('1'),
  gameSessionId: z.string().min(1),
  child: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1).max(40),
    ageBand: ageBandSchema,
    primaryLanguage: z.string().min(2).max(16),
  }),
  livekit: z.object({
    url: z.string().url(),
    roomName: z.string().min(1),
    token: z.string().min(1),
  }),
  initialAgentState: agentStateSchema.default('connecting'),
  sceneKey: z.string().min(1).max(64),
  sceneState: z.string().min(1).max(64).optional(),
  introProgress: introProgressDtoSchema.optional(),
});
export type GameBootstrapResponse = z.infer<typeof gameBootstrapResponseSchema>;

export const voiceSessionContextSchema = z.object({
  protocolVersion: z.literal('1'),
  gameSessionId: z.string().min(1),
  conversationSessionId: z.string().min(1),
  childId: z.string().min(1),
  ageBand: ageBandSchema,
  primaryLanguage: z.string().min(2).max(16),
  displayName: z.string().min(1).max(40),
  soulVersion: z.string().min(1).max(32),
  safetyPolicyVersion: z.string().min(1).max(32),
  livekitRoomName: z.string().min(1),
  memoryContext: memoryContextSchema.optional(),
  sceneKey: z.string().min(1).max(64).optional(),
  sceneState: z.string().min(1).max(64).optional(),
  worldState: z.record(z.string(), z.unknown()).optional(),
  goal: z.string().max(500).optional(),
});
export type VoiceSessionContext = z.infer<typeof voiceSessionContextSchema>;
