import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV } from './e2e/env';

/**
 * E2E + accessibility + RTL smoke suite for the website (almond-web).
 *
 * Two servers, both started and torn down by Playwright:
 *   1. the BFF (bff/) in memory mode on :8092 — the back office's companies tab
 *      reads from it through the website's own /api/admin/* routes;
 *   2. the website as a PRODUCTION build (`next build` + `next start`) on :3100,
 *      in mock data mode — the same artefact a deploy serves, not the dev server.
 *
 * Mobile (375×812) is the primary audience and runs first; desktop (1280×800)
 * runs the same specs.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // A production build takes a while the first time; each test is short.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: E2E_ENV.WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ar-JO',
    timezoneId: 'Asia/Amman',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      // `start` (tsx, no watcher) rather than `dev` (tsx watch): a file watcher
      // restarting the server mid-run would drop the in-memory register.
      command: 'npm run start --workspace @almond/bff',
      url: `${E2E_ENV.BFF_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        PORT: String(E2E_ENV.BFF_PORT),
        NODE_ENV: 'development',
        ADMIN_KEY: E2E_ENV.ADMIN_KEY,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npm run build --workspace almond-web && npm run start --workspace almond-web -- -p ${E2E_ENV.WEB_PORT}`,
      url: E2E_ENV.WEB_URL,
      reuseExistingServer: !isCI,
      timeout: 600_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NEXT_PUBLIC_DATA_SOURCE: 'mock',
        NEXT_TELEMETRY_DISABLED: '1',
        ADMIN_PASSWORD: E2E_ENV.ADMIN_PASSWORD,
        ADMIN_KEY: E2E_ENV.ADMIN_KEY,
        ADMIN_SESSION_SECRET: E2E_ENV.ADMIN_SESSION_SECRET,
        BFF_BASE_URL: E2E_ENV.BFF_URL,
        // The admin login throttles wrong passwords (10 per client / 15 min,
        // app/api/admin/session). Every test runs from the same "client", and
        // the suite deliberately submits wrong passwords, so the limits are
        // raised for the test server only — the limiter itself is not under test.
        ADMIN_LOGIN_MAX_FAILURES: '1000',
        ADMIN_LOGIN_MAX_FAILURES_TOTAL: '1000',
      },
    },
  ],
});
