#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSharedPackages } from './lib/build-shared-packages.mjs';
import { loadEnvFileInto } from './lib/env-file.mjs';
import { fail, ok, step, warn } from './lib/log.mjs';
import {
  killAllTracked,
  killProcessesOnPort,
  runToCompletion,
  spawnTracked,
  waitForHttpOk,
} from './lib/process-utils.mjs';
import { waitForPostgres } from './wait-for-postgres.mjs';

function checkCommandAvailable(command) {
  try {
    execFileSync(command, ['--version'], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

async function apiIntegrationSmoke(apiUrl) {
  step('API integration smoke checks');

  const loginResponse = await fetch(`${apiUrl}/api/dev/login`, { method: 'POST' });
  if (!loginResponse.ok) throw new Error(`dev login failed with status ${loginResponse.status}`);
  const { accessToken } = await loginResponse.json();
  ok('Local dev login succeeded');

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const meResponse = await fetch(`${apiUrl}/api/me`, { headers: authHeaders });
  if (!meResponse.ok) throw new Error(`GET /api/me failed with status ${meResponse.status}`);
  ok('GET /api/me succeeded');

  const createChildResponse = await fetch(`${apiUrl}/api/children`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ displayName: `Smoke Test ${Date.now()}`, avatarKey: 'fox' }),
  });
  if (!createChildResponse.ok) {
    throw new Error(`POST /api/children failed with status ${createChildResponse.status}`);
  }
  ok('POST /api/children succeeded');

  const readyResponse = await fetch(`${apiUrl}/api/health/ready`);
  if (!readyResponse.ok)
    throw new Error(`/api/health/ready failed with status ${readyResponse.status}`);
  ok('GET /api/health/ready succeeded');
}

async function main() {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) {
    fail(
      '.env.local not found. Run `cp .env.local.example .env.local` and `pnpm setup:local` first.',
    );
    process.exit(1);
  }
  loadEnvFileInto(envLocalPath);
  process.env.APP_PROFILE = 'local';

  const apiPort = process.env.API_PORT ?? '3000';
  const webPort = process.env.WEB_PORT ?? '5173';
  const apiUrl = `http://localhost:${apiPort}`;
  const webUrl = `http://localhost:${webPort}`;

  step('Checking Docker');
  if (!checkCommandAvailable('docker')) {
    fail('Docker is not available');
    process.exit(1);
  }
  ok('Docker available');

  step('Checking PostgreSQL state');
  try {
    await waitForPostgres(process.env.DATABASE_URL, 10_000);
    ok('PostgreSQL is reachable');
  } catch {
    warn('PostgreSQL is not reachable yet, attempting to start it');
    await runToCompletion(
      'docker',
      [
        'compose',
        '--env-file',
        '.env.local',
        '-f',
        'infra/local/compose.yaml',
        'up',
        '-d',
        'postgres',
      ],
      { env: process.env },
    );
    await waitForPostgres(process.env.DATABASE_URL, 60_000);
    ok('PostgreSQL is now reachable');
  }

  step('Applying migrations');
  const migrateCode = await runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:migrate:deploy'],
    { env: process.env },
  );
  if (migrateCode !== 0) {
    fail('Migrations failed');
    process.exit(migrateCode);
  }
  ok('Migrations applied');

  // Must run before seeding: prisma/seed.ts imports from
  // @pamagochi/agent-core and @pamagochi/safety-contracts, which are only
  // resolvable once their `dist/` output exists (see each package's
  // `exports` field).
  await buildSharedPackages(process.env);

  step('Seeding the database');
  const seedCode = await runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:seed'],
    { env: process.env },
  );
  if (seedCode !== 0) {
    fail('Seed failed');
    process.exit(seedCode);
  }
  ok('Database seeded');

  step('Clearing any leftover processes on the API/web ports');
  await killProcessesOnPort(apiPort);
  await killProcessesOnPort(webPort);

  step('Starting API');
  spawnTracked('pnpm', ['--filter', '@pamagochi/api', 'run', 'dev'], { env: process.env });

  try {
    await waitForHttpOk(`${apiUrl}/api/health/ready`, { timeoutMs: 60_000 });
    ok('API is ready');

    step('Starting web dev server');
    spawnTracked('pnpm', ['--filter', '@pamagochi/web', 'run', 'dev'], { env: process.env });
    await waitForHttpOk(webUrl, { timeoutMs: 60_000 });
    ok('Web dev server is ready');

    await apiIntegrationSmoke(apiUrl);

    step('Running Playwright smoke test');
    const playwrightCode = await runToCompletion(
      'pnpm',
      ['--filter', '@pamagochi/e2e', 'run', 'test:e2e'],
      {
        env: { ...process.env, PLAYWRIGHT_BASE_URL: webUrl },
      },
    );
    if (playwrightCode !== 0) {
      // Throw (rather than process.exit here) so the `finally` block below
      // still runs and stops the API/web dev servers this script started;
      // process.exit() would bypass `finally` and leak them on their ports.
      throw new Error('Playwright smoke test failed');
    }
    ok('Playwright smoke test passed');
  } finally {
    step('Stopping processes started by this script (API, web) — PostgreSQL keeps running');
    killAllTracked();
    // `pnpm run dev` wraps a fairly deep process tree (pnpm -> node
    // scripts/dev.mjs -> tsc --watch + node --watch dist/main.js). Signal
    // forwarding across that many hops is not always reliable, so as a
    // hard guarantee we also reclaim the ports directly.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    await killProcessesOnPort(apiPort);
    await killProcessesOnPort(webPort);
  }

  console.log('\nverify:local completed successfully.');
  process.exit(0);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  killAllTracked();
  process.exit(1);
});
