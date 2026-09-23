/**
 * The fixed, NON-SECRET values the suite boots the servers with. They exist only
 * for this test run; nothing here is a real credential. Kept in one module so the
 * config (which starts the servers) and the specs (which log in, and assert the
 * key never reaches a browser) cannot drift apart.
 */
export const E2E_ENV = {
  WEB_PORT: 3100,
  BFF_PORT: 8092,
  WEB_URL: 'http://localhost:3100',
  BFF_URL: 'http://localhost:8092',
  ADMIN_PASSWORD: 'e2e-pass',
  ADMIN_KEY: 'e2e-admin-key-000000000000000000000',
  ADMIN_SESSION_SECRET: 'e2e-session-secret-000000000000000',
} as const;
