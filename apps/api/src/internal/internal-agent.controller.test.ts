import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@pamagochi/database';
import { InternalAgentController } from './internal-agent.controller.js';

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function buildController(prismaOverrides: {
  create: () => Promise<unknown>;
  findFirst: () => Promise<unknown>;
}) {
  const prisma = {
    client: {
      gameSession: {
        findUnique: vi.fn(async () => ({
          id: 'gs1',
          childId: 'child-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          child: {
            deletedAt: null,
            birthYear: 2018,
            birthDate: null,
            primaryLanguage: 'ru',
            displayName: 'A',
          },
          conversationSessions: [],
        })),
      },
      conversationSession: {
        create: prismaOverrides.create,
        findFirst: prismaOverrides.findFirst,
      },
    },
  };
  const introProgress = {
    getOrCreateForChild: vi.fn(async () => ({
      state: 'SHIP_DARK',
      sharedEvents: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    })),
    sceneKeyFor: vi.fn(() => 'ship-capsule-intro'),
    worldStateFor: vi.fn(() => ({})),
  };
  const memory = { buildMemoryContext: vi.fn(async () => undefined) };

  return new InternalAgentController(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    memory as never,
    {} as never,
    introProgress as never,
  );
}

describe('InternalAgentController.getSessionContext', () => {
  it('re-fetches the active conversation when a concurrent create loses the unique-index race', async () => {
    const existing = {
      id: 'cs1',
      soulVersion: '0.1.0',
      safetyPolicyVersion: '0.1.0',
      livekitRoomId: 'game-gs1',
    };
    const controller = buildController({
      create: vi.fn(async () => {
        throw uniqueViolation();
      }),
      findFirst: vi.fn(async () => existing),
    });

    const context = await controller.getSessionContext('gs1');
    expect(context.conversationSessionId).toBe('cs1');
  });

  it('propagates non-unique-constraint errors from conversation creation', async () => {
    const controller = buildController({
      create: vi.fn(async () => {
        throw new Error('boom');
      }),
      findFirst: vi.fn(async () => null),
    });

    await expect(controller.getSessionContext('gs1')).rejects.toThrow('boom');
  });
});
