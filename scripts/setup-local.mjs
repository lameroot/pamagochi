#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSharedPackages } from './lib/build-shared-packages.mjs';
import { loadEnvFileInto } from './lib/env-file.mjs';
import { fail, ok, step, warn } from './lib/log.mjs';
import { runToCompletion } from './lib/process-utils.mjs';
import { waitForPostgres } from './wait-for-postgres.mjs';

function checkCommandAvailable(command, versionArgs = ['--version']) {
  try {
    const output = execFileSync(command, versionArgs, { encoding: 'utf8' }).trim();
    return output;
  } catch {
    return null;
  }
}

async function main() {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) {
    fail('.env.local not found. Run `cp .env.local.example .env.local` first.');
    process.exit(1);
  }
  loadEnvFileInto(envLocalPath);
  process.env.APP_PROFILE = 'local';

  step('Checking Node.js and pnpm versions');
  const nodeVersion = process.version;
  const pnpmVersion = checkCommandAvailable('pnpm');
  if (!pnpmVersion) {
    fail('pnpm was not found on PATH');
    process.exit(1);
  }
  ok(`Node.js ${nodeVersion}, pnpm ${pnpmVersion}`);

  step('Checking Docker availability');
  const dockerVersion = checkCommandAvailable('docker');
  if (!dockerVersion) {
    fail(
      'Docker was not found on PATH. Docker is required to run PostgreSQL for the local profile.',
    );
    process.exit(1);
  }
  ok(dockerVersion);

  step('Starting PostgreSQL (docker compose)');
  const composeUpCode = await runToCompletion(
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
  if (composeUpCode !== 0) {
    fail('Failed to start PostgreSQL via docker compose');
    process.exit(composeUpCode);
  }
  ok('PostgreSQL container started');

  step('Waiting for PostgreSQL healthcheck');
  try {
    await waitForPostgres(process.env.DATABASE_URL, 60_000);
    ok('PostgreSQL is accepting connections');
  } catch (error) {
    fail(error.message);
    process.exit(1);
  }

  await buildSharedPackages(process.env);

  step('Generating Prisma client');
  const generateCode = await runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:generate'],
    { env: process.env },
  );
  if (generateCode !== 0) process.exit(generateCode);
  ok('Prisma client generated');

  step('Applying database migrations');
  const migrateCode = await runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:migrate:deploy'],
    { env: process.env },
  );
  if (migrateCode !== 0) process.exit(migrateCode);
  ok('Migrations applied');

  step('Seeding the database (idempotent)');
  const seedCode = await runToCompletion(
    'pnpm',
    ['--filter', '@pamagochi/database', 'run', 'prisma:seed'],
    { env: process.env },
  );
  if (seedCode !== 0) process.exit(seedCode);
  ok('Database seeded');

  step('Creating local storage directory');
  const storagePath = resolve(process.cwd(), process.env.LOCAL_STORAGE_PATH ?? '.data/storage');
  mkdirSync(storagePath, { recursive: true });
  ok(`Storage directory ready: ${process.env.LOCAL_STORAGE_PATH ?? '.data/storage'}`);

  step('Running a short database sanity check');
  try {
    await waitForPostgres(process.env.DATABASE_URL, 5_000);
    ok('Database sanity check passed');
  } catch (error) {
    warn(`Database sanity check failed: ${error.message}`);
  }

  console.log('\n--- Local profile setup summary ---');
  console.log(`APP_PROFILE=local`);
  console.log(`AUTH_PROVIDER=${process.env.AUTH_PROVIDER}`);
  console.log(`STORAGE_PROVIDER=${process.env.STORAGE_PROVIDER}`);
  console.log(`JOB_PROVIDER=${process.env.JOB_PROVIDER}`);
  console.log(`API_PORT=${process.env.API_PORT}`);
  console.log(`WEB_PORT=${process.env.WEB_PORT}`);
  console.log('PostgreSQL: running (Docker)');
  console.log('Storage: filesystem (.data/storage)');
  console.log('\nSetup complete. Run `pnpm dev:local` to start the app.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
