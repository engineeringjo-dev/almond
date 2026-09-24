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
  /**
   * How long the EARN TICKET /v1/pos/scan hands the till stays DELIVERABLE
   * (pos/token.ts). Default SEVEN DAYS.
   *
   * Not the 60-second QR TTL, and not "a sale's length" either. The Odoo POS
   * addon (integrations/almond_loyalty_pos) queues /v1/pos/earn in an outbox
   * and retries with backoff — for hours or days if the loyalty API is down,
   * because a loyalty outage must never block a sale. A ticket that died
   * before the outbox drained would silently LOSE the member's points; seven
   * days outlives any outage we would not already be treating as a disaster.
   *
   * What a long lifetime does NOT widen: the ticket still names ONE member,
   * pays for ONE sale (UNIQUE in pos_sales) and is signed by us — and the sale
   * it pays for must have been PAID close to the scan (the two dials below),
   * however late it is delivered. So a ticket held for a week cannot be
   * attached to a sale rung up on day six.
   */
  POS_EARN_TICKET_TTL_SECONDS: envInt('POS_EARN_TICKET_TTL_SECONDS', 7 * 24 * 60 * 60),
  /** The sale an earn ticket pays for must be PAID no later than this long
   *  after the member's QR was scanned (`paidAt ≤ scan + window`). Six hours
   *  covers a long table service; it is what stops a cashier holding an unused
   *  ticket and attaching a stranger's later purchase to it. */
  POS_EARN_SALE_WINDOW_SECONDS: envInt('POS_EARN_SALE_WINDOW_SECONDS', 6 * 60 * 60),
  /** …and no EARLIER than this long before the scan: a member who paid and
   *  then remembered their QR, plus till-clock skew. */
  POS_EARN_PAID_BEFORE_SCAN_SECONDS: envInt('POS_EARN_PAID_BEFORE_SCAN_SECONDS', 30 * 60),
  /** How long the SPEND ticket /v1/pos/scan hands the till lives (pos/token.ts).
   *  Default: the shared 15 minutes — spending must follow a fresh scan. */
  POS_SPEND_TICKET_TTL_SECONDS: envInt('POS_SPEND_TICKET_TTL_SECONDS', shared.POS_SPEND_TICKET_TTL_SECONDS),
  /** The most points POST /v1/pos/points/spend takes in one sale. Default: the
   *  shared 10,000 (100.00 JOD). */
  POS_SPEND_MAX_POINTS_PER_SALE: envInt('POS_SPEND_MAX_POINTS_PER_SALE', shared.POS_SPEND_MAX_POINTS_PER_SALE),

  /**
   * Which card gateway takes payments (bff/src/payments/index.ts).
   *
   * Unset ⇒ `unconfigured`: every card call answers 503
   * `payment_provider_unconfigured` and a card order is refused. That is the
   * honest default — the wallet and cash still work — and production is ALLOWED
   * to boot on it. `mock` is for development and tests only, and production
   * refuses to boot on it (insecureBootReasons). Any other value must be a
   * provider registered in payments/index.ts, or the server refuses to boot in
   * every environment (providers.ts).
   */
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? '',
  /** Where the gateway sends the member's browser after a hosted payment page.
   *  Optional; passed through to PaymentProvider.createIntent as `returnUrl`. */
  PAYMENT_RETURN_URL: process.env.PAYMENT_RETURN_URL ?? '',

  /**
   * Which SMS provider delivers the sign-in code (bff/src/auth/sms.ts).
   *
   * Unset ⇒ `log` outside production (the code goes to the server log, the
   * `DEV OTP issued` line the E2E suite and the load test read) and
   * `unconfigured` in production, where /v1/auth/otp/request then answers 503
   * `sms_unavailable` instead of claiming `{ sent: true }` for a text nobody
   * sent. `log` in production is refused at boot: it would print every
   * member's code into the log and tell the phone it had been texted.
   */
  SMS_PROVIDER: process.env.SMS_PROVIDER ?? '',
  /** The text of the sign-in SMS. `{code}` is replaced by the code. Arabic
   *  first: this is the one message every member receives. Must contain
   *  `{code}`, or the server refuses to boot (providers.ts). */
  OTP_SMS_TEMPLATE: process.env.OTP_SMS_TEMPLATE ?? 'رمز التحقق من ألموند: {code}',

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
  /** Whether the deployer SAID how clients reach this server. Unset and
   *  "false" parse the same, but only one of them is a decision. */
  TRUST_PROXY_SET: (process.env.TRUST_PROXY ?? '') !== '',

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
    /**
     * The till routes, limited TWICE. Per TILL (source address — req.ip, see
     * TRUST_PROXY): one misbehaving till cannot starve the others. Per POS KEY
     * (every till shares one): a hard ceiling on the whole chain, which is what
     * bounds brute-forcing 8-character redemption codes through /settle with a
     * leaked key, whatever addresses it is spread across. Earning and settling
     * have separate budgets, so a code-guessing flood cannot stop the chain
     * earning. Generous: eight branches at peak are well under these.
     */
    posEarnPerTill: { max: envInt('RATE_POS_EARN_PER_TILL', 120), windowSeconds: 60 },
    posEarnPerKey: { max: envInt('RATE_POS_EARN_PER_KEY', 1200), windowSeconds: 60 },
    posSettlePerTill: { max: envInt('RATE_POS_SETTLE_PER_TILL', 60), windowSeconds: 60 },
    posSettlePerKey: { max: envInt('RATE_POS_SETTLE_PER_KEY', 300), windowSeconds: 60 },
    /** POST /v1/pos/points/spend (+ its reverse). A budget of its own: a
     *  spend moves a member's money, so a flood of it must not share (or
     *  starve) the earn budget. */
    posSpendPerTill: { max: envInt('RATE_POS_SPEND_PER_TILL', 60), windowSeconds: 60 },
    posSpendPerKey: { max: envInt('RATE_POS_SPEND_PER_KEY', 600), windowSeconds: 60 },
    /** POST /v1/pos/identify — a phone number typed on the in-store tablet.
     *  Tighter than earning: every call answers "is this number a member, and
     *  what is their first name", so the per-KEY ceiling is what stops a leaked
     *  key from walking the number space as a reverse phone book. */
    posIdentifyPerTill: { max: envInt('RATE_POS_IDENTIFY_PER_TILL', 30), windowSeconds: 60 },
    posIdentifyPerKey: { max: envInt('RATE_POS_IDENTIFY_PER_KEY', 300), windowSeconds: 60 },
    /** POST /v1/payments/intent, per member. Each one is a call to the card
     *  gateway, which bills and rate-limits US. */
    paymentIntentPerMember: { max: envInt('RATE_PAYMENT_INTENT_PER_MEMBER', 20), windowSeconds: 60 },
    /** POST /v1/me/transfers/preview, per member. Each call answers "is this
     *  phone a member, and what is their first name" — the same question the
     *  tablet's /identify answers — so it is bounded like one: a stolen session
     *  must not become a reverse phone book. */
    transferPreviewPerMember: { max: envInt('RATE_TRANSFER_PREVIEW_PER_MEMBER', 10), windowSeconds: 60 },
    /** POST /v1/me/transfers, per member. The daily cap bounds the MONEY; this
     *  bounds the request rate (every transfer takes two row locks). */
    transferPerMember: { max: envInt('RATE_TRANSFER_PER_MEMBER', 10), windowSeconds: 60 },
    /** POST /v1/me/referral/attach, per member — a code is 6 characters, and
     *  this is what makes guessing one pointless. */
    referralAttachPerMember: { max: envInt('RATE_REFERRAL_ATTACH_PER_MEMBER', 10), windowSeconds: 60 },
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
    /** Optional for the same reason; checked only when present. */
    DATABASE_URL?: string;
    TRUST_PROXY_SET?: boolean;
    /** Optional for the same reason as CORS_ORIGINS. */
    PAYMENT_PROVIDER?: string;
    SMS_PROVIDER?: string;
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
  // Measured, not assumed (docs/LOAD-BASELINE.md): without DATABASE_URL the
  // server runs on process memory — every member, point and company forgotten
  // on the next restart — and it does NOT say so. The memory store is for
  // development and tests; it also counts all orders on every checkout, so it
  // slows linearly as orders accumulate (20 ms per checkout at 3,000 orders).
  if (env.DATABASE_URL !== undefined && !env.DATABASE_URL) {
    reasons.push('DATABASE_URL is unset — members, points and companies would live in process memory and vanish on restart (apply supabase/migrations first)');
  }
  // Unset parses as "trust nobody", which is right for a server facing the
  // internet and catastrophic behind a load balancer or a PaaS router: every
  // member then shares the balancer's address, and the per-IP sign-in limit
  // (20 per 10 minutes) becomes the limit for the WHOLE APP. Say which it is.
  if (env.TRUST_PROXY_SET === false) {
    reasons.push('TRUST_PROXY is unset — "true" (or a hop count) behind a load balancer or PaaS router, "false" if this server faces the internet directly');
  }
  // The mock gateway captures whatever a test tells it to — and its webhook
  // secret is a constant in this repository. In production it would be a way
  // to mark any card order "paid" without paying (payments/mock.ts).
  if (env.PAYMENT_PROVIDER === 'mock') {
    reasons.push('PAYMENT_PROVIDER is "mock" — the mock gateway captures on request; name a real provider or leave it unset (card payment then answers 503)');
  }
  // The log sender prints the sign-in code into the server log and tells the
  // phone it was texted: a log reader could sign in as anyone.
  if (env.SMS_PROVIDER === 'log') {
    reasons.push('SMS_PROVIDER is "log" — sign-in codes would be written to the log and never texted; name a real provider or leave it unset (sign-in then answers 503)');
  }
  return reasons;
}
