import { z } from 'zod';

export const petEmotionSchema = z.enum([
  'neutral',
  'curious',
  'happy',
  'afraid',
  'tired',
  'excited',
]);
export type PetEmotion = z.infer<typeof petEmotionSchema>;

export const petActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('speak'),
    text: z.string().min(1).max(240),
    emotion: petEmotionSchema,
  }),
  z.object({ type: z.literal('move'), targetId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('look'), targetId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('interact'), objectId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('emote'), emotion: petEmotionSchema }),
]);
export type PetAction = z.infer<typeof petActionSchema>;

export const dialogueResponseSchema = z.object({
  text: z.string().min(1).max(240),
  emotion: petEmotionSchema,
  actions: z.array(petActionSchema).max(8),
});
export type DialogueResponse = z.infer<typeof dialogueResponseSchema>;
export interface DialogueRequest {
  objectId?: string;
  text?: string;
}
export interface DialogueProvider {
  send(request: DialogueRequest): Promise<DialogueResponse>;
}
