import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const contractsEntry = path.resolve(packageDir, '../../packages/contracts/dist/index.js');
const gameProtocolEntry = path.resolve(packageDir, '../../packages/game-protocol/dist/index.js');

export default defineConfig({
  resolve: {
    alias: {
      '@pamagochi/contracts': contractsEntry,
      '@pamagochi/game-protocol': gameProtocolEntry,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
