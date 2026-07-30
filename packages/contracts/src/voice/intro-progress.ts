import { z } from 'zod';

/** Mirrors packages/game-protocol introStateSchema — duplicated to avoid circular deps. */
export const introStateSchema = z.enum([
  'SHIP_DARK',
  'SHIP_POWERED',
  'VOICE_CONNECTION_READY',
  'FIRST_VOICE_CONTACT',
  'POWER_CELL_DISCOVERED',
  'POWER_RESTORED',
  'CAPSULE_OPENING',
  'FIRST_MEETING',
  'INTRO_COMPLETED',
]);
export type IntroStateDto = z.infer<typeof introStateSchema>;

export const introProgressDtoSchema = z.object({
  state: introStateSchema,
  sharedEvents: z.array(z.string().max(128)).default([]),
  completed: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type IntroProgressDto = z.infer<typeof introProgressDtoSchema>;

export const introProgressTransitionRequestSchema = z.object({
  limitedGameToken: z.string().min(1),
  targetState: introStateSchema,
  idempotencyKey: z.string().min(1).max(128),
  sourceEvent: z.string().min(1).max(64).optional(),
  sharedEvent: z.string().min(1).max(128).optional(),
});
export type IntroProgressTransitionRequest = z.infer<typeof introProgressTransitionRequestSchema>;

export const introProgressTransitionResponseSchema = z.object({
  progress: introProgressDtoSchema,
  changed: z.boolean(),
});
export type IntroProgressTransitionResponse = z.infer<typeof introProgressTransitionResponseSchema>;
