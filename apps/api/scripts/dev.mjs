#!/usr/bin/env node
/**
 * Dev runner for apps/api.
 *
 * NestJS resolves constructor-injected dependencies via
 * `emitDecoratorMetadata` + `reflect-metadata`, which requires a real
 * type-checking TypeScript compile (`tsc`). Fast transpile-only tools like
 * `tsx`/`esbuild` do NOT reliably emit `design:paramtypes` metadata (they
 * transpile file-by-file without type information), which silently breaks
 * NestJS dependency injection at runtime ("Cannot read properties of
 * undefined"). So we always run the compiled output via plain `node`, and
 * use `tsc --watch` + `node --watch` for the dev loop instead of a
 * transpile-only watcher.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(apiRoot, '../..');

process.chdir(apiRoot);

const { spawnTracked, killAllTracked } = await import(
  resolve(repoRoot, 'scripts/lib/process-utils.mjs')
);

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');

console.log('[dev] Initial build...');
const initialBuild = spawnSync('node', [tscBin, '-p', 'tsconfig.build.json'], {
  stdio: 'inherit',
  cwd: apiRoot,
});

if (initialBuild.status !== 0) {
  console.error('[dev] Initial TypeScript build failed');
  process.exit(initialBuild.status ?? 1);
}

const tscWatch = spawnTracked(
  'node',
  [tscBin, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { cwd: apiRoot, env: process.env },
);

const nodeWatch = spawnTracked(
  process.execPath,
  ['--watch', '--enable-source-maps', 'dist/main.js'],
  { cwd: apiRoot, env: process.env },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    killAllTracked(signal);
    process.exit(0);
  });
}

let exitCode = 0;
await new Promise((resolvePromise) => {
  const onExit = (code) => {
    exitCode = code ?? 0;
    resolvePromise();
  };
  tscWatch.on('exit', onExit);
  nodeWatch.on('exit', onExit);
});

killAllTracked();
process.exit(exitCode);
