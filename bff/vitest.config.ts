import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * bff test runner. Test discovery is unchanged from vitest's defaults (this
 * workspace ran config-less until now); the file exists to hold COVERAGE.
 *
 * Coverage spans bff/src AND packages/shared/src: the shared package has no
 * runner of its own, and the bff suite is where its money/loyalty rules are
 * exercised. It lives outside this root, hence absolute globs + allowExternal.
 * No thresholds here on purpose — coverage is reported, not enforced (yet).
 */
const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, '../packages/shared/src');

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      allowExternal: true,
      include: [path.join(root, 'src/**/*.ts'), path.join(shared, '**/*.ts')],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/test/**',
        '**/menu.generated.ts',
        '**/*.config.*',
        '**/node_modules/**',
      ],
    },
  },
});
