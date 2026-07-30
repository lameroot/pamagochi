import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { computePromptChecksum } from '@pamagochi/agent-core';
import {
  assertSoulHasNoForbiddenKeys,
  soulDocumentSchema,
  type SoulDocument,
} from './soul-schema.js';

export interface LoadedSoul {
  document: SoulDocument;
  rawYaml: string;
  checksum: string;
  filePath: string;
}

export interface SoulLoaderOptions {
  /** Override path to pamagochi.soul.yaml (for tests). */
  filePath?: string;
  /** Expected semantic version (from conversation session / env). */
  expectedVersion?: string;
  /** Expected checksum (from agent_prompt_versions). */
  expectedChecksum?: string;
}

const DEFAULT_SOUL_FILE = join(dirname(fileURLToPath(import.meta.url)), 'pamagochi.soul.yaml');

/**
 * Loads and validates the Pamagochi SOUL document.
 * SOUL is immutable personality — no scene state, memory, tools, or transcripts.
 */
export class SoulLoader {
  load(options: SoulLoaderOptions = {}): LoadedSoul {
    const filePath = options.filePath ?? DEFAULT_SOUL_FILE;
    const rawYaml = readFileSync(filePath, 'utf8');
    const parsed = parseYaml(rawYaml);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('SOUL file must be a YAML mapping');
    }

    assertSoulHasNoForbiddenKeys(parsed as Record<string, unknown>);
    const document = soulDocumentSchema.parse(parsed);
    const checksum = computePromptChecksum(rawYaml);

    if (options.expectedVersion && document.version !== options.expectedVersion) {
      throw new Error(
        `SOUL version mismatch: expected ${options.expectedVersion}, got ${document.version}`,
      );
    }

    if (options.expectedChecksum) {
      if (checksum !== options.expectedChecksum) {
        throw new Error(`SOUL checksum mismatch: expected ${options.expectedChecksum}`);
      }
    }

    return { document, rawYaml, checksum, filePath };
  }
}

export function formatSoulForPrompt(document: SoulDocument): string {
  const lines: string[] = [
    `# SOUL v${document.version}`,
    `Identity: ${document.identity.name} — ${document.identity.role}`,
    `Temperament: ${document.temperament.traits.join(', ')}`,
    `Relationship: ${document.relationship.stance}`,
    `Voice: ${document.voice_style.tone}`,
    `World knowledge: ${document.knowledge.world}`,
  ];
  return lines.join('\n');
}
