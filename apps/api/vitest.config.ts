import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const agentCoreEntry = path.resolve(packageDir, '../../packages/agent-core/dist/index.js');
const gameProtocolEntry = path.resolve(packageDir, '../../packages/game-protocol/dist/index.js');
const contractsEntry = path.resolve(packageDir, '../../packages/contracts/dist/index.js');

export default defineConfig({
  resolve: {
    alias: {
      '@pamagochi/agent-core': agentCoreEntry,
      '@pamagochi/game-protocol': gameProtocolEntry,
      '@pamagochi/contracts': contractsEntry,
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', 'node_modules/**'],
  },
});
