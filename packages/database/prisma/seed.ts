import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOCAL_DEV_AUTH_SUBJECT = process.env.DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';
const LOCAL_DEV_EMAIL = process.env.DEV_USER_EMAIL ?? 'developer@pamagochi.local';

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

  console.info('[seed] parent:', parent.id);
  console.info('[seed] child:', child.id);
  console.info('[seed] skills seeded:', skillKeys.join(', '));
  console.info('[seed] quest seeded: first-steps');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] failed', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
