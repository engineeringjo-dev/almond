import { config as shared } from '@almond/shared/config';

/** An integer from the environment, or the default when unset/unparseable. */
function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Fastify's `trustProxy`. Unset ⇒ false: `req.ip` is the socket peer. Behind a
 * load balancer that peer is the BALANCER, so every member shares one IP and
 * the per-IP limits below throttle the whole city at once. Set `true`, a hop
 * count (`1`), or a comma list of proxy addresses to read the client from
 * X-Forwarded-For. Never `true` when the BFF is directly exposed: the header is
 * then the caller's to write, and a per-IP limit becomes a per-string one.
 */
function parseTrustProxy(raw: string | undefined): boolean | string | ((addr: string, hop: number) => boolean) {
  if (!raw) return false;
  if (raw === 'true') return true;
  // A hop count, expressed as the function form Fastify's types accept.
  if (/^\d+$/.test(raw)) { const hops = Number(raw); return (_addr, hop) => hop < hops; }
  return raw;
}

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
  /** Postgres (Supabase). Set ⇒ the server keeps members, points, redemptions
   *  and the corporate register in a database that survives a restart. Unset ⇒
   *  in-memory, which is right for dev and tests and wrong for anything a
   *  person typed. See backend/index.ts. */
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  /** Supabase's pooler needs TLS without hostname verification. */
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? '*',
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),

  /**
   * In-process fixed-window limits (plugins/rateLimit.ts). Same posture as the
   * OTP caps in auth/otp.ts: per-instance until Redis, which is accepted.
   *
   * The OTP caps there are PER PHONE, and that is the gap these close: 25
   * guesses/hour/phone is safe for one phone and says nothing about an attacker
   * spraying guesses across all 47,720 of them (25 × 47,720 ≈ 1.2M guesses/hour
   * ≈ one account per hour). Keyed by IP here, the spray is bounded per source.
   * Jordanian mobile carriers NAT many phones behind one address, so the IP
   * limits count FAILED verifies, not successful ones, and are generous.
   */
  RATE_LIMITS: {
    otpRequestPerIp: { max: envInt('RATE_OTP_REQUEST_PER_IP', 20), windowSeconds: 600 },
    otpFailedVerifyPerIp: { max: envInt('RATE_OTP_FAILED_VERIFY_PER_IP', 20), windowSeconds: 900 },
    redeemPerMember: { max: envInt('RATE_REDEEM_PER_MEMBER', 10), windowSeconds: 60 },
    settlePerMember: { max: envInt('RATE_SETTLE_PER_MEMBER', 10), windowSeconds: 60 },
    quotePerMember: { max: envInt('RATE_QUOTE_PER_MEMBER', 60), windowSeconds: 60 },
    stockoutPerMember: { max: envInt('RATE_STOCKOUT_PER_MEMBER', 20), windowSeconds: 60 },
  },

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
    /** Optional only so the older call sites that name the four secrets still
     *  typecheck; `build()` passes the whole config, so it is always present
     *  where it matters. */
    CORS_ORIGINS?: string;
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
  // Set is not the same as strong. Both keys are compared in constant time, but
  // a 4-character key is guessed in 10^6-odd requests whatever the compare, and
  // nothing rate-limits a server-to-server header. Same floor as the secrets.
  for (const name of ['POS_SCAN_KEY', 'ADMIN_KEY'] as const) {
    if (env[name] && env[name].length < 32) reasons.push(`${name} is shorter than 32 characters`);
  }
  // `*` is the development default. The BFF authenticates with bearer tokens,
  // not cookies, so a wildcard does not hand a foreign page a member's session
  // — but it does let any page on the internet drive the API from a visitor's
  // browser, and production has a known, short list of front-ends.
  if (env.CORS_ORIGINS !== undefined && env.CORS_ORIGINS.split(',').some((o) => o.trim() === '*')) {
    reasons.push('CORS_ORIGINS is "*" — name the front-end origins explicitly');
  }
  return reasons;
}
