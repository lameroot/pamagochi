import { applyLocalTestEnv } from './env.js';

applyLocalTestEnv();

import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { signLocalJwt } from '../src/auth/local/local-jwt.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { seedActivePromptVersions } from './seed-fixtures.js';

describe('Parent cabinet ownership E2E', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let parentAToken: string;
  let parentBToken: string;
  let childAId: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    prisma = app.get(PrismaService);
    await seedActivePromptVersions(prisma);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const secret = process.env.DEV_AUTH_SECRET!;
    const subjectA = 'parent-a-e4-test';
    const subjectB = 'parent-b-e4-test';

    parentAToken = signLocalJwt({
      subject: subjectA,
      email: 'parent-a@test.local',
      roles: ['parent'],
      secret,
    });
    parentBToken = signLocalJwt({
      subject: subjectB,
      email: 'parent-b@test.local',
      roles: ['parent'],
      secret,
    });

    const meA = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: '/api/me',
        headers: { authorization: `Bearer ${parentAToken}` },
      });
    expect(meA.statusCode).toBe(200);

    await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: '/api/me',
        headers: { authorization: `Bearer ${parentBToken}` },
      });

    const createChild = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${parentAToken}`,
          'content-type': 'application/json',
        },
        payload: {
          displayName: 'E4 Kid',
          avatarKey: 'fox',
          birthYear: 2018,
          readingLevel: 'beginner',
        },
      });
    childAId = (JSON.parse(createChild.payload) as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await rm(process.env.LOCAL_STORAGE_PATH ?? '.data/storage-test', {
      recursive: true,
      force: true,
    });
  });

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  it('denies unauthenticated access to children', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/children',
    });
    expect(res.statusCode).toBe(401);
  });

  it('blocks parent B from reading parent A child', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}`,
        headers: auth(parentBToken),
      });
    expect(res.statusCode).toBe(404);
  });

  it('creates game session and bootstrap excludes admin fields', async () => {
    const session = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/children/${childAId}/game-sessions`,
        headers: { ...auth(parentAToken), 'content-type': 'application/json' },
        payload: {},
      });
    expect([200, 201]).toContain(session.statusCode);
    const { limitedGameToken } = JSON.parse(session.payload) as { limitedGameToken: string };

    const bootstrap = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/game/bootstrap',
        headers: { 'content-type': 'application/json' },
        payload: { limitedGameToken },
      });
    const boot = JSON.parse(bootstrap.payload) as Record<string, unknown>;
    const child = boot.child as Record<string, unknown>;
    expect(child).not.toHaveProperty('parentId');
    expect(child).not.toHaveProperty('readingLevel');
    expect(child).not.toHaveProperty('mathLevel');
    expect(child).not.toHaveProperty('birthYear');
    expect(child).toHaveProperty('ageBand');
  });

  it('manages memory with ownership and excludes deleted from list', async () => {
    const create = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/children/${childAId}/memory`,
        headers: { ...auth(parentAToken), 'content-type': 'application/json' },
        payload: { category: 'parent_note', fact: 'Любит космос' },
      });
    expect([200, 201]).toContain(create.statusCode);
    const memory = JSON.parse(create.payload) as { id: string };

    const denied = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/memory/${memory.id}`,
        headers: auth(parentBToken),
      });
    expect(denied.statusCode).toBe(404);

    await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'DELETE',
        url: `/api/children/${childAId}/memory/${memory.id}`,
        headers: auth(parentAToken),
      });

    const list = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/memory`,
        headers: auth(parentAToken),
      });
    const items = (JSON.parse(list.payload) as { items: { id: string }[] }).items;
    expect(items.find((i) => i.id === memory.id)).toBeUndefined();
  });

  it('lists conversations and blocks cross-parent access', async () => {
    await prisma.client.gameSession.updateMany({
      where: { childId: childAId, revokedAt: null },
      data: { status: 'revoked', revokedAt: new Date() },
    });

    const session = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/children/${childAId}/game-sessions`,
        headers: { ...auth(parentAToken), 'content-type': 'application/json' },
        payload: {},
      });
    const { gameSessionId } = JSON.parse(session.payload) as { gameSessionId: string };

    const ctx = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/internal/agent/sessions/${gameSessionId}/context`,
        headers: { authorization: `Bearer ${process.env.VOICE_AGENT_SERVICE_TOKEN}` },
      });
    const { conversationSessionId } = JSON.parse(ctx.payload) as { conversationSessionId: string };

    await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/internal/agent/sessions/${conversationSessionId}/turns`,
        headers: {
          authorization: `Bearer ${process.env.VOICE_AGENT_SERVICE_TOKEN}`,
          'content-type': 'application/json',
        },
        payload: {
          idempotencyKey: 'e4-turn-1',
          sequenceNo: 0,
          speaker: 'child',
          text: 'привет',
          startedAt: new Date().toISOString(),
          wasInterrupted: false,
          safetyFlags: [],
          metadata: { chainOfThought: 'secret reasoning' },
        },
      });

    await prisma.client.conversationSession.update({
      where: { id: conversationSessionId },
      data: { sessionSummary: 'Тестовая сессия', status: 'completed', endedAt: new Date() },
    });

    const list = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/conversations`,
        headers: auth(parentAToken),
      });
    expect(list.statusCode).toBe(200);
    const items = (JSON.parse(list.payload) as { items: { id: string }[] }).items;
    expect(items.some((i) => i.id === conversationSessionId)).toBe(true);

    const detail = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/conversations/${conversationSessionId}`,
        headers: auth(parentAToken),
      });
    const transcript = JSON.parse(detail.payload) as {
      turns: { metadata: Record<string, unknown> }[];
    };
    expect(transcript.turns[0]?.metadata).not.toHaveProperty('chainOfThought');

    const denied = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/conversations/${conversationSessionId}`,
        headers: auth(parentBToken),
      });
    expect(denied.statusCode).toBe(404);
  });

  it('exports child data for owner only', async () => {
    const allowed = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/privacy/export`,
        headers: auth(parentAToken),
      });
    expect(allowed.statusCode).toBe(200);

    const denied = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/privacy/export`,
        headers: auth(parentBToken),
      });
    expect(denied.statusCode).toBe(404);
  });

  it('records parent-visible safety events', async () => {
    await prisma.client.safetyEvent.create({
      data: {
        childId: childAId,
        category: 'output_policy',
        severity: 'medium',
        detectedBy: 'test',
        actionTaken: 'blocked',
        parentVisible: true,
        inputExcerpt: 'краткий фрагмент',
      },
    });
    await prisma.client.safetyEvent.create({
      data: {
        childId: childAId,
        category: 'prompt_injection',
        severity: 'high',
        detectedBy: 'test',
        actionTaken: 'internal_only',
        parentVisible: false,
        inputExcerpt: 'hidden',
      },
    });

    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${childAId}/safety`,
        headers: auth(parentAToken),
      });
    const body = JSON.parse(res.payload) as { items: { parentVisible: boolean }[] };
    expect(body.items.every((i) => i.parentVisible)).toBe(true);
    expect(body.items.some((i) => (i as { inputExcerpt?: string }).inputExcerpt === 'hidden')).toBe(
      false,
    );
  });

  it('dev register produces distinct parent subjects', async () => {
    const email = `e4-${Date.now()}@test.local`;
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/dev/register',
        headers: { 'content-type': 'application/json' },
        payload: { email },
      });
    expect(res.statusCode).toBe(200);
    const { accessToken } = JSON.parse(res.payload) as { accessToken: string };
    const expectedSubject = createHash('sha256')
      .update(`local:${email}`)
      .digest('hex')
      .slice(0, 36);
    const me = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: '/api/me',
        headers: auth(accessToken),
      });
    const parent = await prisma.client.parentAccount.findUnique({
      where: { authSubject: expectedSubject },
    });
    expect(parent).not.toBeNull();
    expect(JSON.parse(me.payload)).toHaveProperty('parent');
  });
});
