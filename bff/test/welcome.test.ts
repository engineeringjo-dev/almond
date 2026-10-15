import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { config as loyalty } from '@almond/shared/config';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { BalanceWireError, parseMeBalance } from '@almond/shared/loyalty/balanceWire';
import { welcomeBonusFor, welcomeBonusOffered } from '@almond/shared/loyalty/welcome';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';
import { SHIPPED_WELCOME_BONUS_POINTS, setWelcomeGift } from '../../packages/shared/test-setup/no-welcome-gift';

/**
 * WG1-WG3 — the welcome gift. Owner, 2026-10-15: «امنح ٢٠٠ نقطة تفعل بعد اول
 * عملية شراء وتنزيل نقاط عالتطبيق». WG1 is the shared rule, WG2 the HTTP
 * surface on both backends, WG3 the wire. The grant itself is held in both
 * backends by T37 (backend-contract.test.ts).
 */
describe('WG1 the rule', () => {
  it('ships at 200 points — the test setup holds the dial at 0, never the shipped value', () => {
    expect(SHIPPED_WELCOME_BONUS_POINTS).toBe(200);
    expect(loyalty.WELCOME_BONUS_POINTS).toBe(0);
  });

  it('pays once, never to a corporate member, and a nonsense dial pays nothing', () => {
    expect(welcomeBonusFor(false, false, 200)).toBe(200);
    expect(welcomeBonusFor(true, false, 200)).toBe(0);          // already settled
    expect(welcomeBonusFor(false, true, 200)).toBe(0);          // earns no points at all
    for (const bad of [0, -200, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(welcomeBonusFor(false, false, bad), String(bad)).toBe(0);
    }
    expect(welcomeBonusFor(false, false, 200.9)).toBe(200);
    expect(welcomeBonusOffered(200)).toBe(200);
    expect(welcomeBonusOffered(0)).toBe(0);
  });
});

const DRINK = menuItems.find((m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0].price > 0)!;
const LINE = { itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [] as string[], qty: 1 };
/** One counter for the whole file: both backends sign in through the same OTP
 *  module, whose resend cooldown would refuse a number used a moment ago. */
let seq = 0;

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('WG2 the gift over HTTP — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => {
    setWelcomeGift(SHIPPED_WELCOME_BONUS_POINTS);
    backend = await make();
    app = await build(backend);
  }, 60_000);
  afterAll(async () => { setWelcomeGift(0); await app.close(); });

  const enrol = async () => {
    const d = String(6_000_000 + seq++).padStart(7, '0');
    const token = await signIn(app, `079${d}`);
    const m = await backend.findOrCreateByPhone(`+96279${d}`);
    return { token, id: m.id, phone: `+96279${d}` };
  };
  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() });
  const balance = async (token: string) =>
    parseMeBalance((await app.inject({ method: 'GET', url: '/v1/me/balance', headers: { authorization: `Bearer ${token}` } })).json());
  const checkout = (token: string) => app.inject({
    method: 'POST', url: '/v1/checkout', headers: auth(token),
    // Cash counts as paid in this non-production process (plugins/funding.ts).
    payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [LINE] },
  });

  it('a new member is SHOWN the gift and holds none of it; the first paid order makes it theirs, once', async () => {
    const me = await enrol();
    const before = await balance(me.token);
    expect(before).toMatchObject({ points: 0, welcomeBonusPending: SHIPPED_WELCOME_BONUS_POINTS });

    const paid = await checkout(me.token);
    expect(paid.statusCode, paid.body).toBe(201);
    const earned = paid.json().pointsEarned as number;
    expect(paid.json().pointsBalance).toBe(earned + SHIPPED_WELCOME_BONUS_POINTS);
    expect(await balance(me.token)).toMatchObject({
      points: earned + SHIPPED_WELCOME_BONUS_POINTS, welcomeBonusPending: 0,
    });
    const history = (await app.inject({ method: 'GET', url: '/v1/me/history', headers: { authorization: `Bearer ${me.token}` } })).json();
    expect(history.filter((h: { reasonEn: string }) => h.reasonEn === 'Welcome gift')).toEqual([
      expect.objectContaining({ deltaPoints: SHIPPED_WELCOME_BONUS_POINTS, kind: 'bonus', branchId: 'b1' }),
    ]);

    const second = await checkout(me.token);
    expect(second.json().pointsBalance).toBe(earned * 2 + SHIPPED_WELCOME_BONUS_POINTS);
  });

  it('a corporate member is never shown it, and is never paid it', async () => {
    const me = await enrol();
    await backend.saveCompany({ id: `wg${seq}`, nameAr: '', nameEn: 'Co', percentOff: 50, active: true });
    await backend.replaceRoster(`wg${seq}`, [{ phone: me.phone, companyId: `wg${seq}` }]);
    expect((await balance(me.token)).welcomeBonusPending).toBe(0);
    expect((await checkout(me.token)).statusCode).toBe(201);
    expect(liveBalance((await backend.getMember(me.id)).lots)).toBe(0);
  });

  it('leaving with account deletion and coming back with the same number does not pay it twice', async () => {
    const me = await enrol();
    await checkout(me.token);
    const stamped = (await backend.getMember(me.id)).welcomeBonusAt;
    expect(stamped).not.toBeNull();
    await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: { authorization: `Bearer ${me.token}` } });
    await backend.eraseDueDeletions(new Date(Date.now() + (loyalty.ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000));
    expect((await backend.getMember(me.id)).welcomeBonusAt).toBe(stamped);
    expect((await balance(me.token)).welcomeBonusPending).toBe(0);
  });
});

describe('WG3 the wire', () => {
  const body = {
    points: 0, windowSpend: 0, visitDays: 0,
    tier: { id: 'base', nameAr: '2%', nameEn: '2%', multiplier: 1 },
    nextTier: null, nextExpiry: null,
  };
  it('absent is 0 — a server that predates the gift under-promises, it never breaks the app', () => {
    expect(parseMeBalance(body).welcomeBonusPending).toBe(0);
    expect(parseMeBalance({ ...body, welcomeBonusPending: 200 }).welcomeBonusPending).toBe(200);
  });
  it('anything but a whole, non-negative count of points is a named error', () => {
    for (const bad of [-1, 1.5, '200', null]) {
      expect(() => parseMeBalance({ ...body, welcomeBonusPending: bad }), String(bad)).toThrow(BalanceWireError);
    }
  });
});
