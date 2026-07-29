import { z } from 'zod';

/**
 * Typed event contract for the React <-> Phaser bridge.
 * React never mutates Phaser Scene state directly and vice versa —
 * both sides only exchange these well-defined events.
 */

export const reactToGameEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set-active-child'), childName: z.string().max(40) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
]);
export type ReactToGameEvent = z.infer<typeof reactToGameEventSchema>;

export const gameToReactEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scene-ready'), sceneKey: z.string() }),
  z.object({ type: z.literal('score-changed'), score: z.number().int().min(0) }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type GameToReactEvent = z.infer<typeof gameToReactEventSchema>;
