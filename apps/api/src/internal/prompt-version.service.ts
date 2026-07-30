import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  computePromptChecksum,
  PROMPT_VERSION_KINDS,
  requireActivePromptVersions,
  type PromptVersionKind,
  type PromptVersionRecord,
} from '@pamagochi/agent-core';
import type { ActivePromptVersionsResponse } from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PromptVersionService implements OnModuleInit {
  private readonly logger = new Logger(PromptVersionService.name);
  private cachedActive: Record<PromptVersionKind, PromptVersionRecord> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.loadAndValidateActive();
    this.logger.log('Active agent prompt versions validated at startup');
  }

  async loadAndValidateActive(): Promise<Record<PromptVersionKind, PromptVersionRecord>> {
    const rows = await this.prisma.client.agentPromptVersion.findMany({
      where: { status: 'active' },
    });

    const mapped: Partial<Record<PromptVersionKind, PromptVersionRecord>> = {};
    for (const row of rows) {
      mapped[row.kind as PromptVersionKind] = {
        kind: row.kind as PromptVersionKind,
        semanticVersion: row.semanticVersion,
        content: row.content,
        checksum: row.checksum,
        status: row.status as PromptVersionRecord['status'],
        releaseNotes: row.releaseNotes,
      };
    }

    this.cachedActive = requireActivePromptVersions(mapped);
    return this.cachedActive;
  }

  getActiveSnapshot(): ActivePromptVersionsResponse {
    if (!this.cachedActive) {
      throw new Error('Active prompt versions not loaded');
    }
    const toEntry = (kind: PromptVersionKind) => {
      const r = this.cachedActive![kind];
      return {
        semanticVersion: r.semanticVersion,
        content: r.content,
        checksum: r.checksum,
        releaseNotes: r.releaseNotes ?? null,
      };
    };
    return {
      soul: toEntry('soul'),
      safety: toEntry('safety'),
      runtime_template: toEntry('runtime_template'),
    };
  }

  /** Used by seed: upsert a prompt version idempotently. */
  async upsertVersion(input: {
    kind: PromptVersionKind;
    semanticVersion: string;
    content: string;
    status: 'draft' | 'active' | 'retired';
    releaseNotes?: string;
  }): Promise<void> {
    const checksum = computePromptChecksum(input.content);
    await this.prisma.client.agentPromptVersion.upsert({
      where: {
        kind_semanticVersion: {
          kind: input.kind,
          semanticVersion: input.semanticVersion,
        },
      },
      update: {
        content: input.content,
        checksum,
        status: input.status,
        releaseNotes: input.releaseNotes,
      },
      create: {
        kind: input.kind,
        semanticVersion: input.semanticVersion,
        content: input.content,
        checksum,
        status: input.status,
        releaseNotes: input.releaseNotes,
      },
    });
  }

  /** Retire other active versions when promoting a new active version. */
  async retireOtherActive(kind: PromptVersionKind, keepVersion: string): Promise<void> {
    await this.prisma.client.agentPromptVersion.updateMany({
      where: {
        kind,
        status: 'active',
        semanticVersion: { not: keepVersion },
      },
      data: { status: 'retired' },
    });
  }

  static requiredKinds(): readonly PromptVersionKind[] {
    return PROMPT_VERSION_KINDS;
  }
}
