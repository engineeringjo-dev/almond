import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { liveBalance } from '@almond/shared/loyalty/lots';
import {
  normalizeReferralCode, referralAttachError, referralRewardFor, referralShareLink,
} from '@almond/shared/loyalty/referral';
import { config } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * RF — THE REFERRAL RAIL. Owner, 2026-09-24: reward the REFERRER only,
 * config.REFERRAL_REWARD_POINTS, ONCE PER REFERRED ACCOUNT, on the friend's
 * FIRST PAID order — not at signup. The backend contract proves the grant on
 * both stores; this file proves the shared rule and the HTTP surface, end to
 * end: a code is fetched, attached by a friend, and paid out by the friend's
 * first paid checkout — once, even when that checkout is replayed.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const savedLimits = config.RATE_LIMITS;

beforeEach(() => { __resetRateLimits(); __resetOtpState(); cfg.RATE_LIMITS = savedLimits; });

describe('RF0 the shared rule', () => {
  it('RF0.1 a code is forgiven its case, spaces, dashes and Arabic-Indic digits — not its alphabet', () => {
    expect(normalizeReferralCode(' ab-c 234 ')).toBe('ABC234');
    expect(normalizeReferralCode('ABC٢٣٤')).toBe('ABC234');
    for (const bad of ['ABC23', 'ABC2345', 'ABC0O1', 'ABC-2I4', '', null, undefined]) {
      expect(normalizeReferralCode(bad), String(bad)).toBeNull();
    }
    expect(referralShareLink('ABC234')).toBe(`${loyalty.REFERRAL_LINK_BASE}?ref=ABC234`);
  });

  it('RF0.2 🔴 the attach rule, each refusal on its own', () => {
    const ok = {
      memberId: 'f', memberPhone: '+962792222222', memberFirstPaidAt: null, alreadyAttached: false,
      referrer: { id: 'r', phone: '+962791111111' },
    };
    expect(referralAttachError(ok)).toBeNull();
    expect(referralAttachError({ ...ok, referrer: { ...ok.referrer, id: 'f' } })).toBe('referral_self');
    // The same PERSON under another id — any spelling of the one number.
    expect(referralAttachError({ ...ok, referrer: { id: 'r', phone: '0792222222' } })).toBe('referral_same_phone');
    expect(referralAttachError({ ...ok, alreadyAttached: true })).toBe('referral_already_attached');
    expect(referralAttachError({ ...ok, memberFirstPaidAt: '2026-09-24T10:00:00.000Z' })).toBe('referral_too_late');
  });

  it('RF0.3 a corporate referrer is paid 0, like the earn engine pays them; a dead dial pays 0', () => {
    expect(referralRewardFor(false)).toBe(loyalty.REFERRAL_REWARD_POINTS);
    expect(referralRewardFor(true)).toBe(0);
    for (const bad of [0, -50, Number.NaN]) expect(referralRewardFor(false, bad)).toBe(0);
    expect(referralRewardFor(false, 50.9)).toBe(50);
  });
});

/** A basket the checkout route prices: one drink, bought on its own. */
const DRINK = menuItems.find((m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0].price > 0)!;
const LINE = { itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [] as string[], qty: 1 };

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('RF referrals over HTTP — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); }, 60_000);
  afterAll(async () => { await app.close(); });

  let seq = 0;
  const enrol = async () => {
    const d = String(7_000_000 + seq++).padStart(7, '0');
    const token = await signIn(app, `079${d}`);
    const m = await backend.findOrCreateByPhone(`+96279${d}`);
    return { token, id: m.id };
  };
  const auth = (token: string, key?: string) => ({
    authorization: `Bearer ${token}`, ...(key ? { 'idempotency-key': key } : {}),
  });
  const getReferral = async (token: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/referral', headers: auth(token) })).json();
  const attach = (token: string, code: string) => app.inject({
    method: 'POST', url: '/v1/me/referral/attach', headers: auth(token), payload: { code },
  });
  const checkout = (token: string, key = randomUUID()) => app.inject({
    method: 'POST', url: '/v1/checkout', headers: auth(token, key),
    // Cash: in this in-memory, non-production process the funding gate lets it
    // count as paid (plugins/funding.ts), exactly as the other suites rely on.
    payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [LINE] },
  });
  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);

  it('RF1 GET /v1/me/referral: my code, my link, what it earned — the same code every time', async () => {
    const me = await enrol();
    const first = await getReferral(me.token);
    expect(first).toEqual({
      code: expect.stringMatching(/^[A-Z2-9]{6}$/),
      link: referralShareLink(first.code),
      referredCount: 0, rewardedCount: 0, pointsEarned: 0,
      rewardPoints: loyalty.REFERRAL_REWARD_POINTS,
      attachedCode: null, canAttach: true,
    });
    expect((await getReferral(me.token)).code).toBe(first.code);
    const noAuth = await app.inject({ method: 'GET', url: '/v1/me/referral' });
    expect(noAuth.statusCode).toBe(401);
  });

  it('RF2 🔴 attach → the friend\'s FIRST PAID checkout pays the referrer once; a replayed checkout pays nothing more', async () => {
    const referrer = await enrol();
    const friend = await enrol();
    await backend.setProfile(referrer.id, { name: 'سارة خالد', birthday: null, gender: null });
    const { code } = await getReferral(referrer.token);

    expect((await attach(friend.token, 'nope')).json().error).toBe('referral_code_invalid');
    expect((await attach(friend.token, 'ZZZZZZ')).json().error).toBe('referral_code_not_found');
    expect((await attach(referrer.token, code)).json().error).toBe('referral_self');
    const ok = await attach(friend.token, code.toLowerCase());
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json()).toEqual({ attached: true, code, referrerDisplayName: 'سارة خ.', replay: false });
    const replay = await attach(friend.token, code);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().replay).toBe(true);
    expect(await getReferral(friend.token)).toMatchObject({ attachedCode: code, canAttach: false });

    // Signup and attach paid nothing: the reward waits for money.
    expect(await points(referrer.id)).toBe(0);

    const key = randomUUID();
    const paid = await checkout(friend.token, key);
    expect(paid.statusCode, paid.body).toBe(201);
    expect(await points(referrer.id)).toBe(loyalty.REFERRAL_REWARD_POINTS);
    // The same request again (a retry): the stored answer, and nothing granted.
    const again = await checkout(friend.token, key);
    expect(again.headers['idempotent-replay']).toBe('true');
    // A second, genuinely new paid order: still nothing more.
    expect((await checkout(friend.token)).statusCode).toBe(201);
    expect(await points(referrer.id)).toBe(loyalty.REFERRAL_REWARD_POINTS);
    expect(await getReferral(referrer.token)).toMatchObject({
      referredCount: 1, rewardedCount: 1, pointsEarned: loyalty.REFERRAL_REWARD_POINTS,
    });
  });

  it('RF3 after a paid order no code can be attached, and the screen is told so', async () => {
    const referrer = await enrol();
    const late = await enrol();
    expect((await checkout(late.token)).statusCode).toBe(201);
    expect((await getReferral(late.token)).canAttach).toBe(false);
    const { code } = await getReferral(referrer.token);
    const r = await attach(late.token, code);
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('referral_too_late');
  });

  it('RF4 attaching is rate-limited per member — a 6-character code is not a guessing game', async () => {
    cfg.RATE_LIMITS = { ...savedLimits, referralAttachPerMember: { max: 2, windowSeconds: 60 } };
    const me = await enrol();
    expect((await attach(me.token, 'ZZZZZZ')).statusCode).toBe(404);
    expect((await attach(me.token, 'ZZZZZY')).statusCode).toBe(404);
    const third = await attach(me.token, 'ZZZZZX');
    expect(third.statusCode).toBe(429);
    expect(third.json().error).toBe('rate_limited');
  });
});
