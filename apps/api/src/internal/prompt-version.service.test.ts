import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computePromptChecksum } from '@pamagochi/agent-core';
import { PromptVersionService } from './prompt-version.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function mockPrisma(
  rows: Array<{
    kind: string;
    semanticVersion: string;
    content: string;
    checksum: string;
    status: string;
    releaseNotes?: string | null;
  }>,
) {
  return {
    client: {
      agentPromptVersion: {
        findMany: vi.fn(async () => rows),
        upsert: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  } as unknown as PrismaService;
}

describe('PromptVersionService', () => {
  it('validates all active kinds at startup', async () => {
    const soul = 'soul-content';
    const safety = '{"version":"0.1.0"}';
    const tmpl = 'runtime-template';
    const prisma = mockPrisma([
      {
        kind: 'soul',
        semanticVersion: '0.1.0',
        content: soul,
        checksum: computePromptChecksum(soul),
        status: 'active',
      },
      {
        kind: 'safety',
        semanticVersion: '0.1.0',
        content: safety,
        checksum: computePromptChecksum(safety),
        status: 'active',
      },
      {
        kind: 'runtime_template',
        semanticVersion: '0.1.0',
        content: tmpl,
        checksum: computePromptChecksum(tmpl),
        status: 'active',
      },
    ]);
    const service = new PromptVersionService(prisma);
    const active = await service.loadAndValidateActive();
    expect(active.soul.semanticVersion).toBe('0.1.0');
    const snapshot = service.getActiveSnapshot();
    expect(snapshot.runtime_template.content).toBe(tmpl);
  });

  it('throws when active versions are missing', async () => {
    const prisma = mockPrisma([
      {
        kind: 'soul',
        semanticVersion: '0.1.0',
        content: 'x',
        checksum: computePromptChecksum('x'),
        status: 'active',
      },
    ]);
    const service = new PromptVersionService(prisma);
    await expect(service.loadAndValidateActive()).rejects.toThrow(/Missing active/);
  });
});
