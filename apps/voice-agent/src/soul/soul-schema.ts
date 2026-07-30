import { z } from 'zod';

const semverPattern = /^\d+\.\d+\.\d+$/;

/** Forbidden top-level keys — SOUL must not carry runtime/session data. */
export const SOUL_FORBIDDEN_KEYS = [
  'scene_state',
  'sceneState',
  'child_memory',
  'childMemory',
  'memory',
  'tools',
  'recent_turns',
  'recentTurns',
  'transcript',
  'world_state',
  'worldState',
  'jwt',
  'api_key',
  'apiKey',
] as const;

export const soulDocumentSchema = z
  .object({
    version: z.string().regex(semverPattern, 'version must be semantic (e.g. 0.1.0)'),
    identity: z.object({
      name: z.string().min(1).max(64),
      species: z.string().min(1).max(128),
      role: z.string().min(1).max(256),
    }),
    temperament: z.object({
      traits: z.array(z.string().min(1).max(64)).min(1).max(20),
      avoids: z.array(z.string().min(1).max(128)).max(20).default([]),
    }),
    relationship: z.object({
      stance: z.string().min(1).max(256),
      boundaries: z.array(z.string().min(1).max(256)).min(1).max(20),
    }),
    voice_style: z.object({
      tone: z.string().min(1).max(256),
      language_notes: z.array(z.string().min(1).max(256)).min(1).max(20),
    }),
    knowledge: z.object({
      world: z.string().min(1).max(512),
      can_discuss: z.array(z.string().min(1).max(128)).min(1).max(30),
      cannot_claim: z.array(z.string().min(1).max(256)).min(1).max(30),
    }),
    safety: z.object({
      immutable: z.literal(true),
      rules: z.array(z.string().min(1).max(500)).min(1).max(50),
    }),
  })
  .strict();

export type SoulDocument = z.infer<typeof soulDocumentSchema>;

export function assertSoulHasNoForbiddenKeys(raw: Record<string, unknown>): void {
  for (const key of SOUL_FORBIDDEN_KEYS) {
    if (key in raw) {
      throw new Error(`SOUL must not contain forbidden key: ${key}`);
    }
  }
}
