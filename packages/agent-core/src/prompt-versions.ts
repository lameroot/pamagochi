import { createHash } from 'node:crypto';

/** Kinds stored in agent_prompt_versions (Prisma PromptVersionKind). */
export const PROMPT_VERSION_KINDS = ['soul', 'safety', 'runtime_template'] as const;
export type PromptVersionKind = (typeof PROMPT_VERSION_KINDS)[number];

export const PROMPT_VERSION_STATUSES = ['draft', 'active', 'retired'] as const;
export type PromptVersionStatus = (typeof PROMPT_VERSION_STATUSES)[number];

export interface PromptVersionRecord {
  kind: PromptVersionKind;
  semanticVersion: string;
  content: string;
  checksum: string;
  status: PromptVersionStatus;
  releaseNotes?: string | null;
}

/** SHA-256 hex digest of prompt content for reproducibility checks. */
export function computePromptChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function assertChecksum(content: string, expectedChecksum: string): void {
  const actual = computePromptChecksum(content);
  if (actual !== expectedChecksum) {
    throw new Error(`Prompt checksum mismatch: expected ${expectedChecksum}, got ${actual}`);
  }
}

/**
 * Startup guard: every kind must have exactly one active version.
 * Missing or non-active versions block voice runtime startup (E2.1).
 */
export function requireActivePromptVersions(
  versions: Partial<Record<PromptVersionKind, PromptVersionRecord>>,
): Record<PromptVersionKind, PromptVersionRecord> {
  const result = {} as Record<PromptVersionKind, PromptVersionRecord>;
  const missing: PromptVersionKind[] = [];

  for (const kind of PROMPT_VERSION_KINDS) {
    const record = versions[kind];
    if (!record || record.status !== 'active') {
      missing.push(kind);
      continue;
    }
    assertChecksum(record.content, record.checksum);
    result[kind] = record;
  }

  if (missing.length > 0) {
    throw new Error(`Missing active agent_prompt_versions for: ${missing.join(', ')}`);
  }

  return result;
}
