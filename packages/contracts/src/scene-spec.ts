import { z } from 'zod';

/**
 * SceneSpec — единственный формат, в котором LLM-контент может влиять на игру.
 * Это ДАННЫЕ, а не код: никаких выражений, обработчиков событий или произвольных строк,
 * которые могли бы быть проинтерпретированы как JS/HTML. Строго ограниченный allowlist
 * asset keys, ограничение размера и количества объектов.
 */

export const ALLOWED_ASSET_KEYS = [
  'char_fox',
  'char_owl',
  'char_panda',
  'char_dragon',
  'prop_tree',
  'prop_rock',
  'prop_flower',
  'prop_star',
  'bg_meadow',
  'bg_forest',
] as const;

export const sceneAssetKeySchema = z.enum(ALLOWED_ASSET_KEYS);
export type SceneAssetKey = z.infer<typeof sceneAssetKeySchema>;

export const MAX_SCENE_OBJECTS = 40;
export const MAX_SCENE_SPEC_BYTES = 16 * 1024; // 16 KiB

const identifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Only alphanumeric, dash and underscore allowed');

export const sceneObjectSchema = z.object({
  id: identifierSchema,
  assetKey: sceneAssetKeySchema,
  x: z.number().min(0).max(1920),
  y: z.number().min(0).max(1080),
  scale: z.number().min(0.1).max(4).default(1),
  rotationDegrees: z.number().min(-360).max(360).default(0),
});
export type SceneObject = z.infer<typeof sceneObjectSchema>;

export const sceneSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().max(80),
  backgroundAssetKey: sceneAssetKeySchema,
  objects: z.array(sceneObjectSchema).max(MAX_SCENE_OBJECTS),
});
export type SceneSpec = z.infer<typeof sceneSpecSchema>;

export interface SceneSpecValidationError {
  reason: 'too_large' | 'invalid_json' | 'schema_error';
  message: string;
}

export type SceneSpecValidationResult =
  { ok: true; scene: SceneSpec } | { ok: false; error: SceneSpecValidationError };

/**
 * Safe parser: never executes the input, only validates structural/runtime shape.
 * Enforces byte-size limit before even attempting to parse JSON.
 */
const textEncoder = new TextEncoder();

export function parseSceneSpec(raw: string): SceneSpecValidationResult {
  if (textEncoder.encode(raw).byteLength > MAX_SCENE_SPEC_BYTES) {
    return {
      ok: false,
      error: { reason: 'too_large', message: 'SceneSpec payload exceeds size limit' },
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: { reason: 'invalid_json', message: 'SceneSpec is not valid JSON' } };
  }

  const result = sceneSpecSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: { reason: 'schema_error', message: result.error.message } };
  }

  return { ok: true, scene: result.data };
}
