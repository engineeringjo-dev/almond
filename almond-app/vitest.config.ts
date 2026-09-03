import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The app has no test runner of its own (its only check is `tsc --noEmit`), so
 * the tests that exercise the MOCK's internals — spin/eligibility, expiry —
 * have nowhere to run. They cannot live in bff/: that workspace does not depend
 * on almond-app and cannot resolve the `@/` alias. See
 * docs/LOYALTY-EARN-PATCH.md §5 step 0 and §7.
 *
 * Two aliases are all Node needs that Metro gives for free:
 *   `@/`            — the app-root alias every service file imports through;
 *   `react-native`  — services/util.ts imports Platform; react-native's entry
 *                     is Flow-typed and unparseable by Node, so point it at the
 *                     react-native-web build the app already depends on.
 */
const root = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^@\/(.*)$/, replacement: path.join(root, '$1') },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
