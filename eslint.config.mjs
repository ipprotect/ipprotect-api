// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  // Base JS recs
  eslint.configs.recommended,

  // TypeScript (type-aware)
  ...tseslint.configs.recommendedTypeChecked,

  // Prettier integration
  prettierRecommended,

  // Global ignores
  {
    ignores: [
      'node_modules',
      'dist',
      'coverage',
      'pnpm-lock.yaml',
      'package-lock.json',
      '.turbo',
      '.idea',
      '.vscode',
      // ignore the config file itself
      'eslint.config.mjs',
      // prisma artifacts if any
      'prisma/migrations/**',
    ],
  },

  // TS-specific rules & language options
  {
    files: ['**/*.ts'],
    languageOptions: {
      // Let ESLint infer sourceType per file; avoids ESM/CJS confusion
      // sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        // Use the ESLint-only project file
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Team-friendly TS hygiene
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // Keep diffs clean and windows-compatible
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },

  // Test files: relax a bit if you like
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
