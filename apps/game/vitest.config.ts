import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const contractsEntry = path.resolve(packageDir, '../../packages/contracts/dist/index.js');

export default defineConfig({
  resolve: {
    alias: {
      '@[REDACTED]/contracts': contractsEntry,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
