import { z } from 'zod';

/**
 * Technical voice-agent states exposed to the game client.
 * Children never see raw error strings — Phaser maps these to visuals.
 */
export const agentStateSchema = z.enum([
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'interrupted',
  'reconnecting',
  'unavailable',
]);
export type AgentState = z.infer<typeof agentStateSchema>;

export const agentStateEventSchema = z.object({
  type: z.literal('agent-state'),
  state: agentStateSchema,
  at: z.string().datetime(),
  correlationId: z.string().min(1).max(128).optional(),
});
export type AgentStateEvent = z.infer<typeof agentStateEventSchema>;
