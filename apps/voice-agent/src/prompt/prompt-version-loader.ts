import type { ActivePromptVersionsResponse } from '@pamagochi/contracts';
import {
  computePromptChecksum,
  requireActivePromptVersions,
  type PromptVersionKind,
  type PromptVersionRecord,
} from '@pamagochi/agent-core';
import { egressFetch } from '../safety/egress-fetch.js';

export interface PromptVersionLoaderOptions {
  apiBaseUrl: string;
  serviceToken: string;
  expectedSoulVersion: string;
  expectedSafetyVersion: string;
  fetchFn?: typeof fetch;
}

function toRecord(
  kind: PromptVersionKind,
  entry: { semanticVersion: string; content: string; checksum: string },
): PromptVersionRecord {
  return {
    kind,
    semanticVersion: entry.semanticVersion,
    content: entry.content,
    checksum: entry.checksum,
    status: 'active',
  };
}

/**
 * Loads active prompt versions from internal API and validates at startup.
 */
export class PromptVersionLoader {
  async loadActive(
    options: PromptVersionLoaderOptions,
  ): Promise<Record<PromptVersionKind, PromptVersionRecord>> {
    const fetchImpl = options.fetchFn ?? egressFetch;
    const url = `${options.apiBaseUrl.replace(/\/$/, '')}/prompt-versions/active`;
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${options.serviceToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to load active prompt versions: HTTP ${response.status}`);
    }

    const body = (await response.json()) as ActivePromptVersionsResponse;
    const versions: Partial<Record<PromptVersionKind, PromptVersionRecord>> = {
      soul: toRecord('soul', body.soul),
      safety: toRecord('safety', body.safety),
      runtime_template: toRecord('runtime_template', body.runtime_template),
    };

    const active = requireActivePromptVersions(versions);

    if (active.soul.semanticVersion !== options.expectedSoulVersion) {
      throw new Error(
        `Configured PAMAGOCHI_SOUL_VERSION=${options.expectedSoulVersion} does not match active soul ${active.soul.semanticVersion}`,
      );
    }
    if (active.safety.semanticVersion !== options.expectedSafetyVersion) {
      throw new Error(
        `Configured PAMAGOCHI_SAFETY_POLICY_VERSION=${options.expectedSafetyVersion} does not match active safety ${active.safety.semanticVersion}`,
      );
    }

    return active;
  }

  /** Local/test helper: build active set from in-memory records. */
  loadFromRecords(
    records: Partial<
      Record<
        PromptVersionKind,
        Omit<PromptVersionRecord, 'checksum' | 'kind' | 'status'> & { content: string }
      >
    >,
  ): Record<PromptVersionKind, PromptVersionRecord> {
    const mapped: Partial<Record<PromptVersionKind, PromptVersionRecord>> = {};
    for (const kind of ['soul', 'safety', 'runtime_template'] as const) {
      const r = records[kind];
      if (!r) continue;
      mapped[kind] = {
        kind,
        semanticVersion: r.semanticVersion,
        content: r.content,
        checksum: computePromptChecksum(r.content),
        status: 'active',
      };
    }
    return requireActivePromptVersions(mapped);
  }
}
