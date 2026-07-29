#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSharedPackages } from './lib/build-shared-packages.mjs';
import { loadEnvFileInto } from './lib/env-file.mjs';
import { listSafeEnvKeys, step } from './lib/log.mjs';
import {
  runToCompletion,
  spawnTracked,
  waitForHttpOk,
  killAllTracked,
  killProcessesOnPort,
} from './lib/process-utils.mjs';

const [, , profileArg, commandArg] = process.argv;

const VALID_PROFILES = new Set(['local', 'cloud']);
const VALID_COMMANDS = new Set(['dev', 'db:migrate', 'db:seed', 'e2e']);

function usageAndExit() {
  console.error('Usage: node scripts/run-profile.mjs <local|cloud> <dev|db:migrate|db:seed|e2e>');
  process.exit(1);
}

if (!VALID_PROFILES.has(profileArg) || !VALID_COMMANDS.has(commandArg)) {
  usageAndExit();
}

function loadProfileEnv(profile) {
  // Real per-developer secrets live in `.env.<profile>.local` (never
  // committed); `.env.<profile>` is the tracked default used mainly for
  // the `local` profile's committed-but-gitignored working copy.
  const candidates =
    profile === 'local' ? ['.env.local', '.env.local.local'] : ['.env.cloud.local', '.env.cloud'];

  let loadedFrom = null;
  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      loadEnvFileInto(path);
      loadedFrom = candidate;
      break;
    }
  }

  process.env.APP_PROFILE = profile;

  if (loadedFrom) {
    step(`Loaded environment from ${loadedFrom} (APP_PROFILE=${profile})`);
  } else {
    step(
      `No env file found for profile "${profile}"; relying on process environment (APP_PROFILE=${profile})`,
    );
  }

  // Never print values, only key names, for safe diagnostics.
  console.log(`  known keys: ${listSafeEnvKeys(process.env).length} (values hidden)`);
}

async function runDev() {
  await buildSharedPackages(process.env);
  await killProcessesOnPort(process.env.API_PORT ?? '3000');
  await killProcessesOnPort(process.env.WEB_PORT ?? '5173');

  const api = spawnTracked('pnpm', ['--filter', '@pamagochi/api', 'run', 'dev'], {
    env: process.env,
  });
  const web = spawnTracked('pnpm', ['--filter', '@pamagochi/web', 'run', 'dev'], {
    env: process.env,
  });

  const exitCode = await new Promise((resolve) => {
    let settled = false;
    const onExit = (code) => {
      if (settled) return;
      settled = true;
      resolve(code ?? 1);
    };
    api.on('exit', onExit);
    web.on('exit', onExit);
  });

  killAllTracked();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  await killProcessesOnPort(process.env.API_PORT ?? '3000');
  await killProcessesOnPort(process.env.WEB_PORT ?? '5173');
  return exitCode;
}

async function runDbMigrate() {
  return runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:migrate:deploy'],
    {
      env: process.env,
    },
  );
}

async function runDbSeed() {
  return runToCompletion('pnpm', ['--filter', '@pamagochi/database', 'run', 'prisma:seed'], {
    env: process.env,
  });
}

async function runE2e() {
  const apiPort = process.env.API_PORT ?? '3000';
  const webPort = process.env.WEB_PORT ?? '5173';

  await buildSharedPackages(process.env);
  await killProcessesOnPort(apiPort);
  await killProcessesOnPort(webPort);

  const api = spawnTracked('pnpm', ['--filter', '@pamagochi/api', 'run', 'dev'], {
    env: process.env,
  });
  const web = spawnTracked('pnpm', ['--filter', '@pamagochi/web', 'run', 'dev'], {
    env: process.env,
  });

  try {
    step('Waiting for API readiness...');
    await waitForHttpOk(`http://localhost:${apiPort}/api/health/ready`, { timeoutMs: 60_000 });
    step('Waiting for web dev server...');
    await waitForHttpOk(`http://localhost:${webPort}/`, { timeoutMs: 60_000 });

    step('Running Playwright e2e tests...');
    const exitCode = await runToCompletion(
      'pnpm',
      ['--filter', '@pamagochi/e2e', 'run', 'test:e2e'],
      {
        env: { ...process.env, PLAYWRIGHT_BASE_URL: `http://localhost:${webPort}` },
      },
    );
    return exitCode;
  } finally {
    killAllTracked();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    await killProcessesOnPort(apiPort);
    await killProcessesOnPort(webPort);
  }
}

async function main() {
  loadProfileEnv(profileArg);

  let exitCode;
  switch (commandArg) {
    case 'dev':
      exitCode = await runDev();
      break;
    case 'db:migrate':
      exitCode = await runDbMigrate();
      break;
    case 'db:seed':
      exitCode = await runDbSeed();
      break;
    case 'e2e':
      exitCode = await runE2e();
      break;
    default:
      usageAndExit();
      return;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
