import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IntroProgressTransitionRequest } from '@pamagochi/contracts';
import { IntroProgressService } from './intro-progress.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function mockPrisma(introRow?: {
  childId: string;
  state: string;
  sharedEventsJson: unknown;
  completedAt: Date | null;
  updatedAt: Date;
  lastIdempotencyKey?: string | null;
}) {
  const row = introRow ?? {
    childId: 'child-1',
    state: 'SHIP_DARK',
    sharedEventsJson: [],
    completedAt: null,
    updatedAt: new Date('2026-07-30T00:00:00.000Z'),
    lastIdempotencyKey: null as string | null,
  };

  return {
    client: {
      introProgress: {
        upsert: vi.fn(async () => row),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...row,
          state: (data.state as string) ?? row.state,
          sharedEventsJson: data.sharedEventsJson ?? row.sharedEventsJson,
          completedAt: (data.completedAt as Date | null) ?? row.completedAt,
          lastIdempotencyKey:
            (data.lastIdempotencyKey as string | null | undefined) ?? row.lastIdempotencyKey,
          updatedAt: new Date('2026-07-30T01:00:00.000Z'),
        })),
      },
      gameSession: {
        findUnique: vi.fn(async () => ({
          childId: 'child-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          child: { deletedAt: null },
        })),
      },
      relationshipState: {
        upsert: vi.fn(async () => ({})),
      },
    },
  } as unknown as PrismaService;
}

describe('IntroProgressService', () => {
  let service: IntroProgressService;

  beforeEach(() => {
    service = new IntroProgressService(mockPrisma());
  });

  it('creates default SHIP_DARK progress', async () => {
    const progress = await service.getOrCreateForChild('child-1');
    expect(progress.state).toBe('SHIP_DARK');
    expect(progress.completed).toBe(false);
  });

  it('accepts valid transitions', async () => {
    const prisma = mockPrisma();
    service = new IntroProgressService(prisma);
    const body: IntroProgressTransitionRequest = {
      limitedGameToken: 'token',
      targetState: 'SHIP_POWERED',
      idempotencyKey: 'k1',
      sharedEvent: 'ship_powered',
    };
    const result = await service.transition(body);
    expect(result.changed).toBe(true);
    expect(result.progress.state).toBe('SHIP_POWERED');
    expect(result.progress.sharedEvents).toContain('ship_powered');
  });

  it('rejects invalid transitions', async () => {
    await expect(
      service.transition({
        limitedGameToken: 'token',
        targetState: 'CAPSULE_OPENING',
        idempotencyKey: 'bad',
      }),
    ).rejects.toThrow();
  });

  it('builds world state for voice agent', () => {
    const world = service.worldStateFor('FIRST_VOICE_CONTACT');
    expect(world).toMatchObject({
      introState: 'FIRST_VOICE_CONTACT',
      capsuleOpen: false,
      canSeeChild: false,
    });
  });

  it('replays identical idempotency key without changing state', async () => {
    const prisma = mockPrisma({
      childId: 'child-1',
      state: 'SHIP_POWERED',
      sharedEventsJson: ['ship_powered'],
      completedAt: null,
      updatedAt: new Date('2026-07-30T00:00:00.000Z'),
      lastIdempotencyKey: 'k1',
    });
    service = new IntroProgressService(prisma);
    const result = await service.transition({
      limitedGameToken: 'token',
      targetState: 'SHIP_POWERED',
      idempotencyKey: 'k1',
    });
    expect(result.changed).toBe(false);
    expect(result.progress.state).toBe('SHIP_POWERED');
    expect(prisma.client.introProgress.update).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key for a different target state', async () => {
    const prisma = mockPrisma({
      childId: 'child-1',
      state: 'SHIP_POWERED',
      sharedEventsJson: ['ship_powered'],
      completedAt: null,
      updatedAt: new Date('2026-07-30T00:00:00.000Z'),
      lastIdempotencyKey: 'k1',
    });
    service = new IntroProgressService(prisma);
    await expect(
      service.transition({
        limitedGameToken: 'token',
        targetState: 'VOICE_CONNECTION_READY',
        idempotencyKey: 'k1',
      }),
    ).rejects.toThrow(/different target state/);
    expect(prisma.client.introProgress.update).not.toHaveBeenCalled();
  });
});
