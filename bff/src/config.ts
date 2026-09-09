import { config as shared } from '@almond/shared/config';

/** Server-side config. Secrets are read from the environment and NEVER shipped
 *  to any client bundle (that is the whole point of the BFF). */
export const config = {
  PORT: Number(process.env.PORT ?? 8080),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATA_SOURCE: (process.env.DATA_SOURCE ?? 'memory') as 'memory' | 'odoo',

  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  JWT_TTL: process.env.JWT_TTL ?? '30d',

  POS_TOKEN_SECRET: process.env.POS_TOKEN_SECRET ?? 'dev-insecure-pos-change-me',
  // The TTL is the SHARED number (packages/shared/src/config: 60 seconds), not
  // a literal repeated here. The phone's mock loyalty service has to report the
  // same `expiresIn` the real server mints with, or the QR refresh cadence is
  // tuned against a figure production does not use — and a mismatched literal
  // in two workspaces is exactly the class of drift that put "Earn 5 points per
  // 1 JOD" on screen beside a 2% grant. The env var still wins, so an operator
  // can shorten the window without an app release: the app reads the TTL off
  // each response (`expiresIn`), never off its own copy of the constant.
  POS_TOKEN_TTL_SECONDS: Number(process.env.POS_TOKEN_TTL_SECONDS ?? shared.POS_TOKEN_TTL_SECONDS),

  // There is deliberately NO fixed OTP here. A constant that verifies every
  // phone is a master password for every account in the system, and it shipped
  // as the DEFAULT (`OTP_DEV_CODE ?? '123456'`) — i.e. on unless someone
  // remembered to turn it off. See docs/LOYALTY-ODOO-ARCHITECTURE.md §G gate 0.
  // Development reads the generated code from the server log (routes/auth.ts);
  // it never crosses the HTTP boundary in any environment.
  OTP_TTL_SECONDS: Number(process.env.OTP_TTL_SECONDS ?? 300),
  /** Wrong guesses allowed per issued code before it is burned. A 6-digit code
   *  with unlimited attempts is 10^6 requests, which is minutes of scripting —
   *  deleting the bypass without this would move the hole, not close it. */
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  /** Minimum seconds between two sends to the same phone. */
  OTP_RESEND_COOLDOWN_SECONDS: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  /** Sends allowed per phone per hour. */
  OTP_MAX_SENDS_PER_HOUR: Number(process.env.OTP_MAX_SENDS_PER_HOUR ?? 5),

  POS_SCAN_KEY: process.env.POS_SCAN_KEY ?? '',
  /** Shared key for the back-office write routes (the corporate register).
   *  Same posture as POS_SCAN_KEY: unset means the endpoints are a closed door,
   *  never an open one. The website's AdminGate is a CLIENT-SIDE mock password
   *  and protects nothing on its own, so this must be held server-side and the
   *  back-office must reach the BFF through its own server, never the browser. */
  ADMIN_KEY: process.env.ADMIN_KEY ?? '',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? '*',

  ODOO_BASE_URL: process.env.ODOO_BASE_URL ?? '',
  ODOO_API_KEY: process.env.ODOO_API_KEY ?? '',
  LOYALTY_BASE_URL: process.env.LOYALTY_BASE_URL ?? '',
  LOYALTY_TOKEN: process.env.LOYALTY_TOKEN ?? '',
} as const;

/** The dev fallbacks above. Booting production on any of them is a silent
 *  compromise: the JWT secret forges member sessions, the POS secret mints
 *  till tokens, and an empty POS scan key used to disable the check entirely. */
const INSECURE_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'dev-insecure-change-me',
  POS_TOKEN_SECRET: 'dev-insecure-pos-change-me',
};

/**
 * Boot assertion — docs/LOYALTY-ODOO-ARCHITECTURE.md §G gate 0 ("fail the mints
 * closed"). Returns the reasons rather than throwing so a test can assert them
 * without booting a server; `build()` throws on a non-empty result.
 *
 * Deliberately environment-gated: development MUST stay runnable with no env at
 * all, or the next person reintroduces a fixed default to get unblocked. That
 * is exactly how `OTP_DEV_CODE = '123456'` came to exist.
 */
export function insecureBootReasons(
  env: {
    NODE_ENV: string; JWT_SECRET: string; POS_TOKEN_SECRET: string;
    POS_SCAN_KEY: string; ADMIN_KEY: string;
  } = config,
): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const reasons: string[] = [];
  for (const [name, dev] of Object.entries(INSECURE_DEFAULTS)) {
    const v = env[name as 'JWT_SECRET' | 'POS_TOKEN_SECRET'];
    if (!v || v === dev) reasons.push(`${name} is unset or still the development default`);
    else if (v.length < 32) reasons.push(`${name} is shorter than 32 characters`);
  }
  // Empty is what made /v1/pos/scan world-callable: routes/pos.ts skipped the
  // whole comparison when the key was falsy. It now fails closed, so an empty
  // key in production is a dead endpoint rather than an open one — refuse both.
  if (!env.POS_SCAN_KEY) reasons.push('POS_SCAN_KEY is unset — /v1/pos/scan cannot authenticate the till');
  // The corporate register decides who pays half price. An unset key makes the
  // write routes dead rather than public, but a dead back-office in production
  // is still a misconfiguration worth refusing to boot on.
  if (!env.ADMIN_KEY) reasons.push('ADMIN_KEY is unset — the corporate register cannot be administered');
  return reasons;
}
