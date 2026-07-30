import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const agentCoreEntry = path.resolve(packageDir, '../../packages/agent-core/dist/index.js');
const contractsEntry = path.resolve(packageDir, '../../packages/contracts/dist/index.js');
const gameProtocolEntry = path.resolve(packageDir, '../../packages/game-protocol/dist/index.js');
const safetyContractsEntry = path.resolve(
  packageDir,
  '../../packages/safety-contracts/dist/index.js',
);

export default defineConfig({
  resolve: {
    alias: {
      '@pamagochi/agent-core': agentCoreEntry,
      '@pamagochi/contracts': contractsEntry,
      '@pamagochi/game-protocol': gameProtocolEntry,
      '@pamagochi/safety-contracts': safetyContractsEntry,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
