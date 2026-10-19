import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { owedByPurchase, splitRecovery } from '@almond/shared/loyalty';
import { BalanceWireError, parseMeBalance, toLoyaltyBalance } from '@almond/shared/loyalty/balanceWire';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import type { HistoryEntry } from '../src/backend/types';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * PO1-PO3 — THE POINTS A MEMBER OWES FROM A REFUND ARE SHOWN, LINE BY LINE.
 *
 * Review 2026-10-19, item 9: «الدين من المرتجع لا يظهر للعضو، والخصم اللاحق
 * يأتي كسطر غامض». A refund the points balance could not cover left a debt the
 * member never saw: the refund line read «خصم نقاط طلب مُسترَد» with no figure,
 * `purchasePointsDebt` reached no screen, and the later deduction arrived as
 * «تسوية نقاط مشتريات مُرتجعة», tied to whatever credit paid it rather than to
 * the refund. The owner kept the recovery itself, 2026-10-19: «من كل النقاط
 * القادمة (كما بناه Codex)» (docs/HANDOVER.md §7). So the member is told:
 *
 *   - GET /v1/me/balance carries `pointsOwed` (members.purchase_points_debt);
 *   - the refund line carries what it left owed (`pointsOwedChange` > 0) and
 *     never a signed zero;
 *   - every line that pays it back carries `pointsOwedChange` < 0 and names
 *     the refunded purchase in `sourceRef`, oldest refund first, one line per
 *     purchase;
 *   - a member's lines add up to what the balance says is owed.
 */

describe('PO1 the shared rule: what is owed, purchase by purchase, oldest refund first', () => {
  it('a refund opens a debt for its purchase; a settling line pays back the purchase it names', () => {
    expect(owedByPurchase([])).toEqual([]);
    expect(owedByPurchase([
      { sourceRef: 'pos:a', pointsOwedChange: 40 },
      { sourceRef: 'order:x', pointsOwedChange: 0 },
      { sourceRef: 'pos:a', pointsOwedChange: -30 },
      { sourceRef: 'pos:b', pointsOwedChange: 30 },
    ])).toEqual([{ ref: 'pos:a', points: 10 }, { ref: 'pos:b', points: 30 }]);
  });

  it('a recovery is split across the refunds it pays, oldest first, one piece per purchase', () => {
    const owed = [{ ref: 'pos:a', points: 10 }, { ref: 'pos:b', points: 30 }];
    expect(splitRecovery(owed, 25)).toEqual([{ ref: 'pos:a', points: 10 }, { ref: 'pos:b', points: 15 }]);
    expect(splitRecovery(owed, 5)).toEqual([{ ref: 'pos:a', points: 5 }]);
    // Two partial refunds of one purchase are one purchase to the member.
    expect(splitRecovery([{ ref: 'pos:a', points: 4 }, { ref: 'pos:a', points: 6 }], 10))
      .toEqual([{ ref: 'pos:a', points: 10 }]);
  });

  it('what the ledger cannot place is left unnamed, never pinned on the wrong purchase', () => {
    expect(splitRecovery([{ ref: 'pos:a', points: 10 }], 25))
      .toEqual([{ ref: 'pos:a', points: 10 }, { ref: null, points: 15 }]);
    expect(() => splitRecovery([], -1)).toThrow();
    expect(() => splitRecovery([], 1.5)).toThrow();
  });
});

let seq = 0;

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('PO2 points owed over HTTP — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => {
    backend = await make();
    app = await build(backend);
  }, 60_000);
  afterAll(async () => { await app.close(); });

  const enrol = async () => {
    const d = String(7_100_000 + seq++).padStart(7, '0');
    const token = await signIn(app, `079${d}`);
    const m = await backend.findOrCreateByPhone(`+96279${d}`);
    return { token, id: m.id };
  };
  const get = async (token: string, url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode, `${url}: ${res.body}`).toBe(200);
    return res;
  };
  const balance = async (token: string) => parseMeBalance((await get(token, '/v1/me/balance')).json());
  const history = async (token: string) => (await get(token, '/v1/me/history')).json() as HistoryEntry[];
  const earn = async (id: string, points: number) => {
    const ref = `po-sale-${seq++}`;
    await backend.tillEarn({ posOrderRef: ref, memberId: id, ticketJti: ref, ticketRefusal: null,
      branchId: 'rabyeh', paidFils: 1000, paidAt: new Date(), pointsEarned: points, earn: null,
      spendJod: 1, spendDay: null, reasonAr: 'شراء', reasonEn: 'Purchase', at: new Date() });
    return ref;
  };

  let me: { token: string; id: string };
  let friend: { token: string; id: string };
  beforeEach(async () => { me = await enrol(); friend = await enrol(); });

  it('a member who owes nothing is told 0, as a number', async () => {
    const wire = (await get(me.token, '/v1/me/balance')).json();
    expect(wire.pointsOwed).toBe(0);
    expect(toLoyaltyBalance(parseMeBalance(wire), me.id).pointsOwed).toBe(0);
  });

  it('a refund the balance cannot cover is owed on the balance and on its own line, never as -0', async () => {
    const sale = await earn(me.id, 40);
    await backend.transfer({ senderId: me.id, recipientId: friend.id, kind: 'points', amount: 40, at: new Date() });
    await backend.reverseTillEarn(sale, 'returned', new Date());

    expect((await balance(me.token)).pointsOwed).toBe(40);
    const raw = (await get(me.token, '/v1/me/history')).body;
    const refund = (JSON.parse(raw) as HistoryEntry[]).find((h) => h.kind === 'refund')!;
    expect(refund).toMatchObject({ sourceRef: `pos:${sale}`, deltaPoints: 0, pointsOwedChange: 40, branchId: 'rabyeh' });
    // The line the store holds is a plain zero, not the -0 that `-reversedPoints` made.
    const stored = (await backend.getHistory(me.id)).find((h) => h.kind === 'refund')!;
    expect(Object.is(stored.deltaPoints, -0)).toBe(false);
  });

  it('every deduction names the refunded purchase it pays, oldest first, and the lines add up to what is owed', async () => {
    const first = await earn(me.id, 40);
    await backend.transfer({ senderId: me.id, recipientId: friend.id, kind: 'points', amount: 40, at: new Date() });
    await backend.reverseTillEarn(first, 'returned', new Date());
    // The next purchase pays 30 of the first refund's 40 …
    const second = await earn(me.id, 30);
    expect((await balance(me.token)).pointsOwed).toBe(10);
    // … and refunding THAT purchase leaves its own 30 owed.
    await backend.reverseTillEarn(second, 'returned too', new Date());
    expect((await balance(me.token)).pointsOwed).toBe(40);
    // 25 points from a friend pay the first purchase's last 10, then 15 of the second's.
    await backend.transfer({ senderId: friend.id, recipientId: me.id, kind: 'points', amount: 25, at: new Date() });
    expect((await balance(me.token)).pointsOwed).toBe(15);
    expect(liveBalance((await backend.getMember(me.id)).lots)).toBe(0);

    const lines = await history(me.token);
    const paying = lines.filter((h) => (h.pointsOwedChange ?? 0) < 0);
    // Newest first, as the history is served.
    expect(paying.map((h) => [h.sourceRef, h.deltaPoints, h.pointsOwedChange, h.kind])).toEqual([
      [`pos:${second}`, -15, -15, 'refund'],
      [`pos:${first}`, -10, -10, 'refund'],
      [`pos:${first}`, -30, -30, 'refund'],
    ]);
    for (const h of paying) expect(h.reasonAr).toBe('تسوية نقاط طلب مُسترَد');
    expect(lines.filter((h) => (h.pointsOwedChange ?? 0) > 0).map((h) => [h.sourceRef, h.pointsOwedChange]))
      .toEqual([[`pos:${second}`, 30], [`pos:${first}`, 40]]);
    // One ledger: the owed column sums to the balance's figure, the points to the balance.
    expect(lines.reduce((n, h) => n + (h.pointsOwedChange ?? 0), 0)).toBe(15);
    expect(lines.reduce((n, h) => n + h.deltaPoints, 0)).toBe(0);
    expect((await backend.getMember(me.id)).purchasePointsDebt).toBe(15);
  });
});

describe('PO3 the wire: `pointsOwed` is required, and a whole count of points', () => {
  const body = {
    points: 0, windowSpend: 0, visitDays: 0,
    tier: { id: 'base', nameAr: '2%', nameEn: '2%', multiplier: 1 },
    nextTier: null, nextExpiry: null, pointsOwed: 12,
  };
  it('it survives the flattening into the type the screens read', () => {
    expect(parseMeBalance(body).pointsOwed).toBe(12);
    expect(toLoyaltyBalance(parseMeBalance(body), 'u').pointsOwed).toBe(12);
  });
  it('ABSENT IS NOT 0: a server that drops it would hide a debt the member is about to pay', () => {
    const { pointsOwed: _dropped, ...without } = body;
    expect(() => parseMeBalance(without)).toThrow(BalanceWireError);
    for (const bad of [-1, 1.5, '12', null]) {
      expect(() => parseMeBalance({ ...body, pointsOwed: bad }), String(bad)).toThrow(BalanceWireError);
    }
  });
});
