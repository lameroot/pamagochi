import { applyLocalTestEnv } from './env.js';

applyLocalTestEnv();

import { rm } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { PrismaService } from '../src/database/prisma.service.js';

/**
 * Requires a real, reachable PostgreSQL instance (see infra/local/compose.yaml
 * or the GitHub Actions service container) with migrations already applied
 * via `pnpm db:migrate:local` / the CI migrate step.
 */
describe('API integration', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let devAccessToken: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    const loginResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/api/dev/login',
    });
    devAccessToken = (JSON.parse(loginResponse.payload) as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await rm(process.env.LOCAL_STORAGE_PATH ?? '.data/storage-test', {
      recursive: true,
      force: true,
    });
  });

  function authHeader() {
    return { authorization: `Bearer ${devAccessToken}` };
  }

  it('reports readiness with a healthy database connection', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/health/ready',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('performs local dev login and returns a usable JWT', () => {
    expect(typeof devAccessToken).toBe('string');
    expect(devAccessToken.split('.').length).toBe(3);
  });

  it('idempotently upserts the ParentAccount on first authenticated request', async () => {
    const first = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/me',
      headers: authHeader(),
    });
    const second = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/me',
      headers: authHeader(),
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstBody = JSON.parse(first.payload) as { parent: { id: string } };
    const secondBody = JSON.parse(second.payload) as { parent: { id: string } };
    expect(firstBody.parent.id).toBe(secondBody.parent.id);

    const count = await prisma.client.parentAccount.count({
      where: { authSubject: process.env.DEV_USER_ID },
    });
    expect(count).toBe(1);
  });

  it('creates a child profile and persists it in PostgreSQL', async () => {
    const createResponse = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/children',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { displayName: 'Integration Kid', avatarKey: 'owl' },
      });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.payload) as { id: string; displayName: string };
    expect(created.displayName).toBe('Integration Kid');

    const persisted = await prisma.client.childProfile.findUnique({ where: { id: created.id } });
    expect(persisted).not.toBeNull();
  });

  it('rejects reading a child profile owned by a different parent (404, no data leak)', async () => {
    const otherParent = await prisma.client.parentAccount.create({
      data: { authSubject: `other-${Date.now()}`, email: null },
    });
    const otherChild = await prisma.client.childProfile.create({
      data: { parentId: otherParent.id, displayName: 'Not Yours', avatarKey: 'panda' },
    });

    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/children/${otherChild.id}`,
        headers: authHeader(),
      });

    expect(response.statusCode).toBe(404);
  });

  it('stores asset metadata on upload-url and completes it', async () => {
    const meResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/me',
      headers: authHeader(),
    });
    const parent = (JSON.parse(meResponse.payload) as { parent: { id: string } }).parent;

    const uploadResponse = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/assets/upload-url',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: {
          ownerKind: 'parent',
          ownerId: parent.id,
          mimeType: 'text/plain',
          sizeBytes: 12,
          fileName: 'note.txt',
        },
      });
    expect(uploadResponse.statusCode).toBe(201);
    const uploadBody = JSON.parse(uploadResponse.payload) as { assetId: string; uploadUrl: string };

    const asset = await prisma.client.storedAsset.findUnique({ where: { id: uploadBody.assetId } });
    expect(asset?.status).toBe('pending');

    const completeResponse = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/assets/complete',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { assetId: uploadBody.assetId },
      });
    expect(completeResponse.statusCode).toBe(201);
    const completedAsset = await prisma.client.storedAsset.findUnique({
      where: { id: uploadBody.assetId },
    });
    expect(completedAsset?.status).toBe('completed');
  });
});
