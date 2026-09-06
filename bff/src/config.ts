/** Server-side config. Secrets are read from the environment and NEVER shipped
 *  to any client bundle (that is the whole point of the BFF). */
export const config = {
  PORT: Number(process.env.PORT ?? 8080),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATA_SOURCE: (process.env.DATA_SOURCE ?? 'memory') as 'memory' | 'odoo',

  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  JWT_TTL: process.env.JWT_TTL ?? '30d',

  POS_TOKEN_SECRET: process.env.POS_TOKEN_SECRET ?? 'dev-insecure-pos-change-me',
  POS_TOKEN_TTL_SECONDS: Number(process.env.POS_TOKEN_TTL_SECONDS ?? 60),

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
  env: { NODE_ENV: string; JWT_SECRET: string; POS_TOKEN_SECRET: string; POS_SCAN_KEY: string } = config,
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
  return reasons;
}
