import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { computePromptChecksum } from '@pamagochi/agent-core';
import { DEFAULT_SAFETY_POLICY } from '@pamagochi/safety-contracts';

const prisma = new PrismaClient();

const LOCAL_DEV_AUTH_SUBJECT = process.env.DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';
const LOCAL_DEV_EMAIL = process.env.DEV_USER_EMAIL ?? 'developer@pamagochi.local';

const SOUL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../apps/voice-agent/src/soul/pamagochi.soul.yaml',
);

const RUNTIME_TEMPLATE = [
  'You are {{identity}} speaking with a child in a guided adventure.',
  'Respond briefly in {{language}} for age band {{ageBand}}.',
  'Use only the allowlisted tools when needed.',
].join('\n');

const PROMPT_SEED_VERSION = '0.1.0';

async function seedPromptVersion(input: {
  kind: 'soul' | 'safety' | 'runtime_template';
  content: string;
  status: 'draft' | 'active' | 'retired';
  releaseNotes: string;
}): Promise<void> {
  const checksum = computePromptChecksum(input.content);
  await prisma.agentPromptVersion.upsert({
    where: {
      kind_semanticVersion: { kind: input.kind, semanticVersion: PROMPT_SEED_VERSION },
    },
    update: {
      content: input.content,
      checksum,
      status: input.status,
      releaseNotes: input.releaseNotes,
    },
    create: {
      kind: input.kind,
      semanticVersion: PROMPT_SEED_VERSION,
      content: input.content,
      checksum,
      status: input.status,
      releaseNotes: input.releaseNotes,
    },
  });
}

/**
 * Idempotent seed: safe to run multiple times against the same database.
 * Never stores real personal data — everything here is synthetic demo content.
 */
async function main(): Promise<void> {
  const parent = await prisma.parentAccount.upsert({
    where: { authSubject: LOCAL_DEV_AUTH_SUBJECT },
    update: { email: LOCAL_DEV_EMAIL },
    create: { authSubject: LOCAL_DEV_AUTH_SUBJECT, email: LOCAL_DEV_EMAIL },
  });

  const child = await prisma.childProfile.upsert({
    where: { id: 'seed-demo-child-0000000001' },
    update: {},
    create: {
      id: 'seed-demo-child-0000000001',
      parentId: parent.id,
      displayName: 'Demo Kid',
      avatarKey: 'fox',
      birthYear: 2019,
    },
  });

  const skillKeys = ['counting', 'reading', 'colors'] as const;
  for (const skillKey of skillKeys) {
    await prisma.skillProgress.upsert({
      where: { childId_skillKey: { childId: child.id, skillKey } },
      update: {},
      create: { childId: child.id, skillKey, level: 0, experience: 0 },
    });
  }

  await prisma.questProgress.upsert({
    where: { childId_questKey: { childId: child.id, questKey: 'first-steps' } },
    update: {},
    create: { childId: child.id, questKey: 'first-steps', status: 'available', score: 0 },
  });

  const soulContent = readFileSync(SOUL_PATH, 'utf8');
  const safetyContent = JSON.stringify(DEFAULT_SAFETY_POLICY, null, 2);

  await seedPromptVersion({
    kind: 'soul',
    content: soulContent,
    status: 'active',
    releaseNotes: 'Initial Pamagochi SOUL v0.1.0',
  });
  await seedPromptVersion({
    kind: 'safety',
    content: safetyContent,
    status: 'active',
    releaseNotes: 'Default immutable safety policy v0.1.0',
  });
  await seedPromptVersion({
    kind: 'runtime_template',
    content: RUNTIME_TEMPLATE,
    status: 'active',
    releaseNotes: 'Runtime prompt template v0.1.0',
  });

  // Retire any duplicate active rows from manual experiments (idempotent).
  for (const kind of ['soul', 'safety', 'runtime_template'] as const) {
    await prisma.agentPromptVersion.updateMany({
      where: {
        kind,
        status: 'active',
        semanticVersion: { not: PROMPT_SEED_VERSION },
      },
      data: { status: 'retired' },
    });
  }

  console.info('[seed] parent:', parent.id);
  console.info('[seed] child:', child.id);
  console.info('[seed] skills seeded:', skillKeys.join(', '));
  console.info('[seed] quest seeded: first-steps');
  console.info('[seed] agent_prompt_versions: soul/safety/runtime_template @', PROMPT_SEED_VERSION);
}

main()
  .catch((error: unknown) => {
    console.error('[seed] failed', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
