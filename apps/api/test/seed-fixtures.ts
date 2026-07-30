import { computePromptChecksum, type PromptVersionKind } from '@pamagochi/agent-core';
import type { PrismaService } from '../src/database/prisma.service.js';

const TEST_PROMPT_VERSION = '0.1.0';

const MINIMAL_PROMPTS: Record<PromptVersionKind, string> = {
  soul: 'name: Test Soul\nversion: 0.1.0\n',
  safety: JSON.stringify({ version: '0.1.0', rules: [] }),
  runtime_template: 'Test runtime template {{child_name}}',
};

export async function seedActivePromptVersions(prisma: PrismaService): Promise<void> {
  for (const kind of ['soul', 'safety', 'runtime_template'] as const) {
    const content = MINIMAL_PROMPTS[kind];
    const checksum = computePromptChecksum(content);
    await prisma.client.agentPromptVersion.upsert({
      where: {
        kind_semanticVersion: { kind, semanticVersion: TEST_PROMPT_VERSION },
      },
      update: { content, checksum, status: 'active' },
      create: {
        kind,
        semanticVersion: TEST_PROMPT_VERSION,
        content,
        checksum,
        status: 'active',
        releaseNotes: 'integration test fixture',
      },
    });
  }
}
