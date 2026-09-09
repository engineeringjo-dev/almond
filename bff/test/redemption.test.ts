import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config as loyalty } from '@almond/shared/config';
import { liveBalance } from '@almond/shared/loyalty/lots';
import {
  formatRedemptionCode, isRedemptionCodeShape, normalizeRedemptionCode,
  redemptionStatus, shouldRefund, toRedemptionView,
  REDEMPTION_ALPHABET, REDEMPTION_CODE_LENGTH, type RedemptionRow,
} from '@almond/shared/loyalty/redemption';
import { build } from '../src/server';
import { config } from '../src/config';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { signIn } from './lib/signIn';

/**
 * T36 — redeeming produces something the till can act on.
 *
 * Owner, 2026-09-09: «حتى الي بده يصرف نقاطه بده يعمل redeem ويطلع qr code
 * مؤقت يقرأ على الكاش او رمز سري اذا كان يشتري من الموقع».
 *
 * Before this, /v1/loyalty/redeem spent the points and returned a number. The
 * suite that matters most here is T36d: points are never lost without value.
 */

const row = (over: Partial<RedemptionRow> = {}): RedemptionRow => ({
  id: 'r1', memberId: 'm1', code: 'ABCD2345', points: 300, valueJod: 3,
  createdAt: '2026-09-09T10:00:00.000Z',
  expiresAt: '2026-09-09T10:15:00.000Z',
  settledAt: null, cancelledAt: null, settledVia: null,
  ...over,
});
const AT = (iso: string) => new Date(iso);

describe('T36a the code is readable, and a misread never becomes another code', () => {
  it('formats for reading aloud and accepts it back in any casing or spacing', () => {
    expect(formatRedemptionCode('ABCD2345')).toBe('ABCD-2345');
    for (const typed of ['ABCD-2345', 'abcd2345', 'ABCD 2345', ' abcd-2345 ']) {
      expect(normalizeRedemptionCode(typed), typed).toBe('ABCD2345');
    }
  });

  it('🔴 a confusable character makes the code INVALID, never a different valid one', () => {
    // The first version mapped O→0 and I→1 and then stripped them, because
    // neither is in the alphabet. That DELETED the character and shifted the
    // rest, so one misread letter produced a different eight-character string
    // that could be somebody else's live code. A normaliser must not invent a
    // valid input out of an invalid one.
    expect(normalizeRedemptionCode('ABCO2345')).toBe('ABCO2345');   // preserved…
    expect(isRedemptionCodeShape('ABCO2345')).toBe(false);          // …and refused
    expect(isRedemptionCodeShape('ABC12345')).toBe(false);
    expect(isRedemptionCodeShape('ABCD2345')).toBe(true);
  });

  it('the alphabet excludes every character a person reads wrong', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', 'L', 'U']) {
      expect(REDEMPTION_ALPHABET.includes(ambiguous), ambiguous).toBe(false);
    }
    expect(REDEMPTION_CODE_LENGTH).toBe(8);
  });
});

describe('T36b status is derived from the clock, never stored', () => {
  // Same reasoning as secondVisitStatus: there is no cron in the BFF, so a
  // stored `expired` flag would go on saying `pending` for months.
  it('pending before its expiry, expired after', () => {
    expect(redemptionStatus(row(), AT('2026-09-09T10:14:59Z'))).toBe('pending');
    expect(redemptionStatus(row(), AT('2026-09-09T10:15:00Z'))).toBe('expired');
  });

  it('settled and cancelled outrank the clock', () => {
    expect(redemptionStatus(row({ settledAt: '2026-09-09T10:01:00Z' }), AT('2026-09-09T23:00:00Z')))
      .toBe('settled');
    expect(redemptionStatus(row({ cancelledAt: '2026-09-09T10:01:00Z' }), AT('2026-09-09T10:02:00Z')))
      .toBe('cancelled');
  });

  it('the countdown floors at zero rather than going negative', () => {
    expect(toRedemptionView(row(), AT('2026-09-09T10:05:00Z')).expiresIn).toBe(600);
    expect(toRedemptionView(row(), AT('2026-09-09T11:00:00Z')).expiresIn).toBe(0);
  });
});

describe('T36c 🔴 refund only when nothing was delivered', () => {
  it('an expired unused code is refunded', () => {
    expect(shouldRefund(row(), AT('2026-09-09T10:16:00Z'))).toBe(true);
  });

  it('a SETTLED code is never refunded — it bought something', () => {
    // The mutation that costs the most: refunding a settled code pays the
    // member twice for one redemption.
    expect(shouldRefund(row({ settledAt: '2026-09-09T10:01:00Z' }), AT('2026-09-09T23:00:00Z')))
      .toBe(false);
  });

  it('a code already refunded is not refunded twice', () => {
    expect(shouldRefund(row({ cancelledAt: '2026-09-09T10:16:00Z' }), AT('2026-09-09T11:00:00Z')))
      .toBe(false);
  });

  it('a LIVE code is not refunded — it may still be used', () => {
    expect(shouldRefund(row(), AT('2026-09-09T10:05:00Z'))).toBe(false);
  });
});

describe('T36d the redemption rail, end to end', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let token = '';
  let posKey = '';
  const PHONE = '0791234567';

  const auth = (extra: Record<string, string> = {}) =>
    ({ authorization: `Bearer ${token}`, ...extra });
  const balance = async () => {
    const m = await backend.getMember((await backend.findOrCreateByPhone('+962791234567')).id);
    return liveBalance(m.lots);
  };

  beforeAll(async () => {
    backend = createMemoryBackend();
    app = await build(backend);
    token = await signIn(app, PHONE);
    posKey = 'test-pos-key-'.padEnd(32, 'x');
    (config as unknown as { POS_SCAN_KEY: string }).POS_SCAN_KEY = posKey;
    // Fund the member the honest way — through a real grant.
    const m = await backend.findOrCreateByPhone('+962791234567');
    await backend.addPoints(m.id, 1000, 'رصيد اختبار', 'Test grant');
  });
  afterAll(async () => {
    await app.close();
    (config as unknown as { POS_SCAN_KEY: string }).POS_SCAN_KEY = '';
  });

  const redeem = (points: number) => app.inject({
    method: 'POST', url: '/v1/loyalty/redeem',
    payload: { points },
    headers: auth({ 'idempotency-key': randomUUID() }),
  });

  it('🔴 redeeming now PRODUCES a code — the whole point of this change', async () => {
    const before = await balance();
    const r = await redeem(300);
    expect(r.statusCode, r.body).toBe(201);
    const b = r.json();

    // The three original fields still answer exactly as they did.
    expect(b.redeemed).toBe(true);
    expect(b.valueJod).toBe(3);
    expect(b.pointsBalance).toBe(before - 300);
    // And now there is something to present.
    expect(b.redemption.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(b.redemption.status).toBe('pending');
    expect(b.redemption.points).toBe(300);
    expect(b.redemption.expiresIn).toBeGreaterThan(loyalty.REDEMPTION_TTL_SECONDS - 10);
  });

  it('the member can read their live code back, and mint a 60-second QR from it', async () => {
    const live = await app.inject({ method: 'GET', url: '/v1/me/redemption', headers: auth() });
    expect(live.json().redemption.status).toBe('pending');

    const qr = await app.inject({ method: 'POST', url: '/v1/me/redemption/qr', headers: auth() });
    expect(qr.statusCode, qr.body).toBe(201);
    // 🔴 «صلاحيته دقيقة منذ انشاءه» — minted on demand, so the code held up to
    // the scanner is never older than a minute however long the queue was.
    expect(qr.json().expiresIn).toBe(config.POS_TOKEN_TTL_SECONDS);
    expect(config.POS_TOKEN_TTL_SECONDS).toBe(60);
    expect(qr.json().mode).toBe('redeem');
  });

  it('🔴 the till settles it once, and a replay is refused', async () => {
    const live = await app.inject({ method: 'GET', url: '/v1/me/redemption', headers: auth() });
    const code = live.json().redemption.code as string;

    const first = await app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle',
      payload: { code }, headers: { 'x-pos-key': posKey },
    });
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json().valueJod).toBe(3);
    expect(first.json().redemption.status).toBe('settled');

    // The double-spend guard. Two tills scanning one code must not both pay.
    const replay = await app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle',
      payload: { code }, headers: { 'x-pos-key': posKey },
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json().error).toBe('redemption_already_settled');
  });

  it('a settled code does NOT come back as the member’s live one', async () => {
    const live = await app.inject({ method: 'GET', url: '/v1/me/redemption', headers: auth() });
    expect(live.json().redemption).toBeNull();
  });

  it('🔴 the till route is closed without the POS key', async () => {
    const r = await app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle', payload: { code: 'ABCD2345' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('the website settles a code the member owns', async () => {
    const made = (await redeem(200)).json();
    const r = await app.inject({
      method: 'POST', url: '/v1/loyalty/redemption/settle',
      payload: { code: made.redemption.code },
      headers: auth({ 'idempotency-key': randomUUID() }),
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().valueJod).toBe(2);
  });

  it('🔴 the website refuses someone ELSE’s code, indistinguishably from a fake one', async () => {
    const mine = (await redeem(100)).json();
    const other = await signIn(app, '0781111111');
    const stolen = await app.inject({
      method: 'POST', url: '/v1/loyalty/redemption/settle',
      payload: { code: mine.redemption.code },
      headers: { authorization: `Bearer ${other}`, 'idempotency-key': randomUUID() },
    });
    const invented = await app.inject({
      method: 'POST', url: '/v1/loyalty/redemption/settle',
      payload: { code: 'ZZZZ9999' },
      headers: { authorization: `Bearer ${other}`, 'idempotency-key': randomUUID() },
    });
    // The SAME answer, so this cannot be used to discover which codes are live.
    expect(stolen.statusCode).toBe(404);
    expect(invented.statusCode).toBe(404);
    expect(stolen.json()).toEqual(invented.json());
  });

  it('🔴 an expired code returns the points IN FULL', async () => {
    // The invariant that makes spending-at-creation honest. Swept on a
    // controlled clock — the backend takes `at`, so no fake timers are needed.
    //
    // ON ITS OWN MEMBER, deliberately: the sweep returns EVERY expired code the
    // member holds, so run against the shared fixture it counted a redemption
    // an earlier test had left pending and answered 2. That was the sweep being
    // right and the assertion being wrong.
    const m = await backend.findOrCreateByPhone('+962790000001');
    await backend.addPoints(m.id, 1000, 'رصيد اختبار', 'Test grant');
    const before = liveBalance((await backend.getMember(m.id)).lots);

    const made = await backend.createRedemption(m.id, 250);
    expect(liveBalance((await backend.getMember(m.id)).lots)).toBe(before - 250);

    const past = new Date(Date.parse(made.expiresAt) + 1000);
    expect(await backend.sweepRedemptions(m.id, past)).toBe(1);
    expect(liveBalance((await backend.getMember(m.id)).lots)).toBe(before);

    // ...and it cannot then be settled: the points are already back.
    await expect(backend.settleRedemption(made.id, 'pos', past)).rejects.toThrow();
  });

  it('🔴 a SETTLED code is never swept — that would pay the member twice', async () => {
    const m = await backend.findOrCreateByPhone('+962790000002');
    await backend.addPoints(m.id, 1000, 'رصيد اختبار', 'Test grant');
    const made = await backend.createRedemption(m.id, 150);
    const after = liveBalance((await backend.getMember(m.id)).lots);
    await backend.settleRedemption(made.id, 'pos', new Date());

    const past = new Date(Date.parse(made.expiresAt) + 1000);
    expect(await backend.sweepRedemptions(m.id, past)).toBe(0);
    expect(liveBalance((await backend.getMember(m.id)).lots)).toBe(after);
  });

  it('cancelling returns the points immediately, and is idempotent', async () => {
    const made = (await redeem(120)).json();
    const before = await balance();

    const c = await app.inject({
      method: 'POST', url: '/v1/me/redemption/cancel',
      payload: { redemptionId: made.redemption.id },
      headers: auth({ 'idempotency-key': randomUUID() }),
    });
    expect(c.statusCode, c.body).toBe(200);
    expect(c.json().pointsBalance).toBe(before + 120);

    const again = await app.inject({
      method: 'POST', url: '/v1/me/redemption/cancel',
      payload: { redemptionId: made.redemption.id },
      headers: auth({ 'idempotency-key': randomUUID() }),
    });
    expect(again.statusCode).toBe(200);
    expect(await balance()).toBe(before + 120);      // not twice
  });

  it('redeeming more than the balance is refused and moves nothing', async () => {
    const before = await balance();
    const r = await redeem(before + 1);
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('insufficient_points');
    expect(await balance()).toBe(before);
  });
});
