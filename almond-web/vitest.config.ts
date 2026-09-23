import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The website's unit-test runner.
 *
 * Aliases mirror almond-web/tsconfig.json `paths` exactly, so a test resolves a
 * module the same way `tsc` and Next do:
 *   `@/*`              → ./src/*
 *   `@almond/shared`   → ../packages/shared/src/index.ts
 *   `@almond/shared/*` → ../packages/shared/src/*
 *
 * `server-only` is a marker package whose DEFAULT export throws; Next resolves
 * it through the `react-server` condition to an empty module. Node has no such
 * condition, so point it at the same empty module — otherwise nothing under
 * src/server/** could be imported by a test at all.
 *
 * TZ is pinned to UTC so a date-dependent test gives the same answer on a
 * developer's laptop in Amman and on the CI runner (see the isBranchOpen tests).
 */
const root = path.resolve(__dirname);
const repo = path.resolve(root, '..');
const shared = path.join(repo, 'packages/shared/src');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.join(root, 'src/$1') },
      { find: /^@almond\/shared$/, replacement: path.join(shared, 'index.ts') },
      { find: /^@almond\/shared\/(.*)$/, replacement: path.join(shared, '$1') },
      { find: /^server-only$/, replacement: path.join(repo, 'node_modules/server-only/empty.js') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: { TZ: 'UTC' },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/messages/**',
        '**/menu.generated.ts',
        '**/*.config.*',
      ],
    },
  },
});
