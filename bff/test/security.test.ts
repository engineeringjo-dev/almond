import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { config, insecureBootReasons } from '../src/config';
import { requestOtp, verifyOtp, normalizePhone, __resetOtpState } from '../src/auth/otp';
import { parsePosToken, PosTokenWireError } from '@almond/shared/pos/tokenWire';
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
    expect(verifyPosToken(token)).toEqual({ memberId: 'member-1', mode: 'pay' });
    expect(() => verifyPosToken(token)).toThrow(/already used/);
  });

  it('carries the mode as a SIGNED claim, not as plaintext beside it', () => {
    // The retired barcode wrote `MODE=PAY` itself, in the clear, next to a
    // member id anyone could read. The mode now rides inside the signature, so
    // the till learns it from `/v1/pos/scan` and cannot be told otherwise by
    // whoever is holding the phone.
    const earn = issuePosToken('member-mode-1', 'earn');
    expect(earn.mode).toBe('earn');
    expect(verifyPosToken(earn.token)).toEqual({ memberId: 'member-mode-1', mode: 'earn' });

    // Tampering with the claim invalidates the whole token, exactly as
    // tampering with the subject does.
    const { token } = issuePosToken('member-mode-2', 'pay');
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'member-mode-2', mode: 'earn', jti: 'x', exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url');
    expect(() => verifyPosToken(`${forged}.${sig}`)).toThrow(/bad pos signature/);
  });

  it('the mint reports the lifetime it actually stamped', () => {
    // The phone schedules its refresh off `expiresIn` and nothing else, so a
    // mint that stamped one TTL and reported another would leave every member
    // holding a dead square at the counter. Asserted against config, never
    // against a literal 60 — the number is the shared dial's.
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresIn } = issuePosToken('member-ttl');
    expect(expiresIn).toBe(config.POS_TOKEN_TTL_SECONDS);
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()) as { exp: number };
    expect(payload.exp).toBeGreaterThanOrEqual(before + expiresIn);
    expect(payload.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + expiresIn);
  });
});

// ---------------------------------------------------------------------------
// T30 — THE STATIC MEMBER BARCODE CANNOT COME BACK.
//
// Structural, in the style of T7/T27/T29a: the walk over every workspace (now
// including `integrations/` and `.py` / `.js`, so an Odoo-side or POS-side
// re-implementation is inside its reach), asserting that the format cannot
// exist rather than that today's screen happens not to use it.
//
// What it guarded against, precisely:
//   almond-app/app/(tabs)/pay.tsx:45
//     const qrValue = `ALMOND|MEMBER|${userId}|MODE=${mode === 'pay' ? 'PAY' : 'EARN'}`
// The member id is PRINTED UNDER THE QR on that same screen (`pay.memberId`),
// so the barcode was a bearer credential rendered from data on public display:
// no signature, no expiry, no single use. `bff/src/pos/token.ts` had minted a
// signed, 60-second, single-use token since before that line was written and
// NOTHING CALLED IT — which is the failure mode this test exists to make
// impossible to repeat quietly. 47,720 members; the till is the only place the
// programme touches money.
// ---------------------------------------------------------------------------
describe('T30 the static member barcode cannot come back', () => {
  let sources: ReturnType<typeof collectSources>;
  beforeAll(() => { sources = collectSources(); });

  /** The one file allowed to name the retired format: the guard that refuses
   *  it. Same idiom as T29a's self-skip for `OTP_DEV_CODE`. */
  const GUARD = 'packages/shared/src/pos/tokenWire.ts';
  const SELF = 'bff/test/security.test.ts';

  it('the format appears nowhere but the guard that refuses it', () => {
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === GUARD || f.path === SELF) continue;
      f.code.forEach((line, i) => {
        // `code`, not `raw`: comments are blanked by the walk, so the several
        // places that EXPLAIN the retired format (this package is largely an
        // explanation of it) are not offenders. A line of code is.
        if (/ALMOND\s*\|\s*MEMBER/i.test(line)) hits.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(
      hits,
      'the barcode is a signed, single-use token from POST /v1/pos/token. A'
      + ' hand-built member code is forgeable from an id that is printed on the'
      + ` same screen. Offending lines: ${hits.join(' | ')}`,
    ).toEqual([]);
  });

  it('nor does any code write the mode into a barcode', () => {
    // The other half of the retired string. The mode is a signed claim inside
    // the token now (T29f above); a `MODE=` literal in code means someone is
    // assembling a plaintext code again, whatever they called it.
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === SELF) continue;
      f.code.forEach((line, i) => {
        if (/['"`][^'"`]*\bMODE\s*=/.test(line)) hits.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(hits, `Offending lines: ${hits.join(' | ')}`).toEqual([]);
  });

  it('the guard really is there — and refuses the format at runtime', () => {
    // Without this the assertion above passes trivially the moment somebody
    // deletes the parser: "the format appears nowhere" is also true of a repo
    // that has stopped checking for it.
    const guard = sources.find((f) => f.path === GUARD);
    expect(guard, `${GUARD} must be in the walk`).toBeDefined();
    expect(guard!.code.join('\n')).toMatch(/ALMOND\\?\|MEMBER/);

    const id = 'm_00000000-0000-4000-8000-000000000000';
    expect(() => parsePosToken({ token: `ALMOND|MEMBER|${id}|MODE=PAY`, expiresIn: 60, mode: 'pay' }))
      .toThrow(PosTokenWireError);
    // ... and the FAMILY, not just that one prefix: any pipe-delimited
    // plaintext code is refused, so the next hand-rolled format is refused too.
    expect(() => parsePosToken({ token: `MEMBER|${id}`, expiresIn: 60, mode: 'pay' }))
      .toThrow(PosTokenWireError);
    // A real one passes, so the guard is not simply refusing everything.
    expect(parsePosToken({ ...issuePosToken(id, 'earn') }).mode).toBe('earn');
  });

  it('the Pay screen cannot build a code out of the member id', () => {
    const pay = sources.find((f) => f.path === 'almond-app/app/(tabs)/pay.tsx');
    expect(pay, 'the walk must reach the Pay screen').toBeDefined();
    const code = pay!.code;

    // (1) Nothing handed to <QRCode value={…}> may be derived from the userId.
    const offenders: string[] = [];
    code.forEach((line, i) => {
      if (/value\s*=\s*\{/.test(line) && /\buserId\b/.test(line)) {
        offenders.push(`pay.tsx:${i + 1}: ${pay!.raw[i].trim()}`);
      }
    });
    expect(
      offenders,
      'the QR value comes from POST /v1/pos/token. Deriving it from the member'
      + ` id is the retired barcode by another name. Offending: ${offenders.join(' | ')}`,
    ).toEqual([]);

    // (2) ... and the screen really does fetch one. A screen that renders no QR
    // at all would satisfy (1).
    expect(code.join('\n')).toContain('usePosToken');
    expect(code.join('\n')).toContain('posToken.token');
  });

  it('every loyalty service implementation mints through the server', () => {
    // Under DATA_SOURCE='mock' the app's ONLY data source is the mock, so a
    // mock that returned the old string would put it back on screen for every
    // user of every build while the live client stayed clean — the same blind
    // spot that let the demo seed hide W4's progress sentence from everyone.
    for (const rel of [
      'almond-app/services/loyalty.service.mock.ts',
      'almond-app/services/loyalty.service.live.ts',
    ]) {
      const f = sources.find((s) => s.path === rel);
      expect(f, `${rel} must be in the walk`).toBeDefined();
      expect(f!.code.join('\n'), `${rel} must implement getPosToken`).toContain('getPosToken');
    }
    // The live path VALIDATES rather than casts: a server that regressed to the
    // static format is refused at the seam instead of rendered.
    const live = sources.find((s) => s.path === 'almond-app/services/loyalty.service.live.ts')!;
    expect(live.code.join('\n')).toContain('parsePosToken');
  });
});

describe('T29g production refuses to boot on development secrets', () => {
  const prod = {
    NODE_ENV: 'production',
    JWT_SECRET: 'dev-insecure-change-me',
    POS_TOKEN_SECRET: 'dev-insecure-pos-change-me',
    POS_SCAN_KEY: '',
    ADMIN_KEY: '',
  };

  it('names every unset or default secret', () => {
    const reasons = insecureBootReasons(prod);
    expect(reasons.join(' | ')).toMatch(/JWT_SECRET/);
    expect(reasons.join(' | ')).toMatch(/POS_TOKEN_SECRET/);
    expect(reasons.join(' | ')).toMatch(/POS_SCAN_KEY/);
    // The corporate register decides who pays half price; an unset key there is
    // a dead back-office in production, which is a misconfiguration worth
    // refusing to boot on rather than discovering when HR cannot upload.
    expect(reasons.join(' | ')).toMatch(/ADMIN_KEY/);
  });

  it('rejects a short secret', () => {
    expect(insecureBootReasons({ ...prod, JWT_SECRET: 'short', POS_SCAN_KEY: 'k', ADMIN_KEY: 'k' }).join(' | '))
      .toMatch(/JWT_SECRET is shorter/);
  });

  it('passes on real secrets', () => {
    expect(insecureBootReasons({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(48),
      POS_TOKEN_SECRET: 'y'.repeat(48),
      POS_SCAN_KEY: 'z'.repeat(32),
      ADMIN_KEY: 'w'.repeat(32),
    })).toEqual([]);
  });

  it('leaves development runnable with no configuration at all', () => {
    // Deliberate: if `npm run dev` needed secrets, the next person would add a
    // fixed default to get unblocked. That is exactly how '123456' happened.
    expect(insecureBootReasons({ ...prod, NODE_ENV: 'development' })).toEqual([]);
  });
});
