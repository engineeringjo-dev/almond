import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { config, insecureBootReasons } from '../src/config';
import { requestOtp, verifyOtp, normalizePhone, __resetOtpState } from '../src/auth/otp';
import { issuePosToken, verifyPosToken } from '../src/pos/token';
import { build } from '../src/server';
import { collectSources } from './lib/sources';

/**
 * T29 — docs/LOYALTY-ODOO-ARCHITECTURE.md §G gate 0, "delete the OTP bypass and
 * fail the mints closed".
 *
 * What this is guarding against, precisely:
 *   `bff/src/config.ts:13`  OTP_DEV_CODE: process.env.OTP_DEV_CODE ?? '123456'
 *   `bff/src/auth/otp.ts:24`  (config.OTP_DEV_CODE !== '' && code === config.OTP_DEV_CODE)
 * Together those verified ANY phone with a constant, whether or not a code had
 * been requested, and they were ON BY DEFAULT. 47,720 members; 586 accounts
 * holding >= 10 JOD; 14 holding >= 50 JOD.
 *
 * These are structural tests in the style of T7/T8: they assert the hole cannot
 * be reintroduced, not merely that today's code happens to be correct.
 */

const PHONE = normalizePhone('0790000001');
const OTHER = normalizePhone('0790000002');

beforeEach(() => { __resetOtpState(); });

describe('T29a there is no fixed verification code anywhere', () => {
  let sources: ReturnType<typeof collectSources>;
  beforeAll(() => { sources = collectSources(); });

  it('OTP_DEV_CODE does not exist in any workspace', () => {
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === 'bff/test/security.test.ts') continue; // this file names it
      f.code.forEach((line, i) => {
        if (/\bOTP_DEV_CODE\b/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(
      hits,
      'a constant that verifies every phone is a master password for every '
      + `account — see §G gate 0. Offending lines: ${hits.join(' | ')}`,
    ).toEqual([]);
  });

  it('config exposes no fixed-code dial at all', () => {
    expect(Object.keys(config)).not.toContain('OTP_DEV_CODE');
  });

  it('the OTP module holds no six-digit literal', () => {
    // The bypass would come back as a literal long before it came back as a
    // config key, and a hardcoded code is strictly worse than the dial was.
    const otp = sources.find((f) => f.path === 'bff/src/auth/otp.ts');
    expect(otp).toBeDefined();
    const hits = otp!.code
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /['"`]\d{6}['"`]/.test(line));
    expect(hits.map((h) => `bff/src/auth/otp.ts:${h.i + 1}`)).toEqual([]);
  });
});

describe('T29b a code only verifies the phone it was issued to', () => {
  it('rejects the old universal code', () => {
    requestOtp(PHONE);
    expect(() => verifyOtp(PHONE, '123456')).toThrow(/invalid or expired/);
  });

  it('rejects any code when none was requested', () => {
    // The precise old defect: the bypass did not consult the map at all.
    expect(() => verifyOtp(PHONE, '123456')).toThrow(/invalid or expired/);
    expect(() => verifyOtp(PHONE, '000000')).toThrow(/invalid or expired/);
  });

  it("rejects another phone's valid code", () => {
    const { code } = requestOtp(PHONE);
    requestOtp(OTHER);
    expect(() => verifyOtp(OTHER, code)).toThrow(/invalid or expired/);
  });

  it('accepts the issued code exactly once', () => {
    const { code } = requestOtp(PHONE);
    expect(() => verifyOtp(PHONE, code)).not.toThrow();
    expect(() => verifyOtp(PHONE, code)).toThrow(/invalid or expired/); // burned
  });

  it('issues a different code each time', () => {
    // Not a distribution test — a "did anyone re-introduce a constant" test.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      __resetOtpState();
      const { code } = requestOtp(PHONE);
      expect(code).toMatch(/^\d{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(30);
  });
});

describe('T29c guessing is bounded', () => {
  it('burns the code after OTP_MAX_ATTEMPTS wrong guesses', () => {
    const { code } = requestOtp(PHONE);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < config.OTP_MAX_ATTEMPTS; i++) {
      expect(() => verifyOtp(PHONE, wrong)).toThrow();
    }
    // Even the RIGHT code no longer works: the budget is spent.
    expect(() => verifyOtp(PHONE, code)).toThrow(/invalid or expired/);
  });

  it('re-requesting cannot reset the guess budget indefinitely', () => {
    // Without a send cap, the attempt cap is decoration: request, guess N
    // times, request again, repeat. 10^6 falls in minutes.
    let sent = 0;
    let blocked = false;
    for (let i = 0; i < config.OTP_MAX_SENDS_PER_HOUR + 3; i++) {
      try {
        // Bypass the resend cooldown by advancing nothing — the cooldown throws
        // first, which is itself a bound; accept either refusal.
        requestOtp(PHONE);
        sent++;
      } catch {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
    expect(sent).toBeLessThanOrEqual(config.OTP_MAX_SENDS_PER_HOUR);
  });

  it('the total guess budget per hour is far below the 6-digit space', () => {
    const perHour = config.OTP_MAX_SENDS_PER_HOUR * config.OTP_MAX_ATTEMPTS;
    expect(perHour).toBeLessThan(100);
    // At this rate a full sweep of 10^6 takes >1 year of continuous attempts.
    expect(1_000_000 / perHour / 24).toBeGreaterThan(365);
  });
});

describe('T29d the code never crosses the HTTP boundary', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); });
  afterAll(async () => { await app.close(); });

  it('POST /v1/auth/otp/request returns only { sent }', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '0790000009' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ sent: true });
    // Belt and braces: no six-digit string anywhere in the response.
    expect(res.body).not.toMatch(/\d{6}/);
  });

  it('POST /v1/auth/otp/verify rejects 123456', async () => {
    await app.inject({
      method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '0790000008' },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: '0790000008', code: '123456' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('T29e /v1/pos/scan fails closed', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); });
  afterAll(async () => { await app.close(); });

  it('rejects when no POS key is configured', async () => {
    // The old guard read `if (config.POS_SCAN_KEY && ...)`, so the DEFAULT
    // (unset) configuration skipped the comparison and left the endpoint open
    // to anyone. An unconfigured key must be a closed door.
    expect(config.POS_SCAN_KEY).toBe(''); // the test environment's state
    const { token } = issuePosToken('member-1');
    const res = await app.inject({ method: 'POST', url: '/v1/pos/scan', payload: { token } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a wrong key', async () => {
    const { token } = issuePosToken('member-1');
    const res = await app.inject({
      method: 'POST', url: '/v1/pos/scan', headers: { 'x-pos-key': 'guess' }, payload: { token },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('T29f the POS token is single use and unforgeable', () => {
  it('rejects a tampered payload', () => {
    const { token } = issuePosToken('member-1');
    const [body, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'member-2', jti: 'x', exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url');
    expect(() => verifyPosToken(`${forged}.${sig}`)).toThrow(/bad pos signature/);
    // Flip the last character to something it is definitely not — appending a
    // fixed 'A' silently produces the ORIGINAL signature one time in 64.
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    expect(flipped).not.toBe(sig);
    expect(() => verifyPosToken(`${body}.${flipped}`)).toThrow(/bad pos signature/);
  });

  it('rejects a replay', () => {
    const { token } = issuePosToken('member-1');
    expect(verifyPosToken(token)).toEqual({ memberId: 'member-1' });
    expect(() => verifyPosToken(token)).toThrow(/already used/);
  });
});

describe('T29g production refuses to boot on development secrets', () => {
  const prod = {
    NODE_ENV: 'production',
    JWT_SECRET: 'dev-insecure-change-me',
    POS_TOKEN_SECRET: 'dev-insecure-pos-change-me',
    POS_SCAN_KEY: '',
  };

  it('names every unset or default secret', () => {
    const reasons = insecureBootReasons(prod);
    expect(reasons.join(' | ')).toMatch(/JWT_SECRET/);
    expect(reasons.join(' | ')).toMatch(/POS_TOKEN_SECRET/);
    expect(reasons.join(' | ')).toMatch(/POS_SCAN_KEY/);
  });

  it('rejects a short secret', () => {
    expect(insecureBootReasons({ ...prod, JWT_SECRET: 'short', POS_SCAN_KEY: 'k' }).join(' | '))
      .toMatch(/JWT_SECRET is shorter/);
  });

  it('passes on real secrets', () => {
    expect(insecureBootReasons({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(48),
      POS_TOKEN_SECRET: 'y'.repeat(48),
      POS_SCAN_KEY: 'z'.repeat(32),
    })).toEqual([]);
  });

  it('leaves development runnable with no configuration at all', () => {
    // Deliberate: if `npm run dev` needed secrets, the next person would add a
    // fixed default to get unblocked. That is exactly how '123456' happened.
    expect(insecureBootReasons({ ...prod, NODE_ENV: 'development' })).toEqual([]);
  });
});
