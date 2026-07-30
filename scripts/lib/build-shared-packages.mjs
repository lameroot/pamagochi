import { step } from './log.mjs';
import { runToCompletion } from './process-utils.mjs';

const SHARED_PACKAGES = [
  '@pamagochi/contracts',
  '@pamagochi/game-core',
  '@pamagochi/game-protocol',
  '@pamagochi/agent-core',
  '@pamagochi/safety-contracts',
  '@pamagochi/database',
  '@pamagochi/ui',
];

/**
 * `apps/api`, `apps/web`, `apps/game`, `apps/parent` and `apps/voice-agent`
 * consume these packages via their built `dist/` output (see each package's
 * `exports` field) so that a plain `node dist/main.js` works in
 * production/Docker without a TypeScript loader. That means the shared
 * packages must be built at least once before starting a dev server or
 * running the app — this helper does that.
 */
export async function buildSharedPackages(env = process.env) {
  step(
    'Building shared packages (contracts, game-core, game-protocol, agent-core, safety-contracts, database, ui)',
  );
  const filterArgs = SHARED_PACKAGES.flatMap((name) => ['--filter', name]);
  const exitCode = await runToCompletion('pnpm', [...filterArgs, 'run', 'build'], { env });
  if (exitCode !== 0) {
    throw new Error(`Failed to build shared packages (exit code ${exitCode})`);
  }
}
