// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/.data/**',
      'packages/database/prisma/migrations/**',
      'apps/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // NestJS relies on `emitDecoratorMetadata` + reflection to resolve
    // constructor-injected dependencies at runtime. The
    // `consistent-type-imports` autofix silently rewrites
    // `import { SomeInjectable }` into `import type { SomeInjectable }`
    // whenever a class is only referenced as a parameter type — which
    // erases the import at compile time and breaks DI with a hard-to-read
    // "Cannot read properties of undefined" crash. Intentionally left off
    // everywhere (not just apps/api) to avoid re-introducing this bug.
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  prettierConfig,
);
