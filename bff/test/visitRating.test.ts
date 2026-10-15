import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import {
  isValidStars, normalizeComment, pendingVisit, visitRatingRulesFromConfig,
} from '@almond/shared/loyalty/visitRating';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { signIn } from './lib/signIn';

/**
 * VR1-VR2 — the thank-you after a visit (owner, 2026-10-15, after Al Ameed:
 * «ابني لقطة التقييم واضافة النقاط»). VR1 is the shared rule; VR2 is the HTTP
 * surface. Both backends keep ratings the same way: T37 in
 * backend-contract.test.ts.
 */
const DAY = 86_400_000;
const NOW = new Date('2026-10-15T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const buy = (ref: string, createdAt: string, deltaPoints = 30, branchId: string | null = 'rabyeh') =>
  ({ kind: 'purchase' as const, sourceRef: ref, branchId, deltaPoints, createdAt });

describe('VR1 pendingVisit', () => {
  const rules = visitRatingRulesFromConfig();

  it('asks about the newest purchase, with the points it added and its branch', () => {
    expect(pendingVisit([buy('pos:A', ago(2)), buy('pos:B', ago(0.1), 33)], new Set(), NOW)).toEqual({
      ref: 'pos:B', branchId: 'rabyeh', points: 33, at: ago(0.1),
    });
  });

  it('never digs up an older visit: the newest is rated, so nothing is asked', () => {
    expect(pendingVisit([buy('pos:A', ago(1)), buy('pos:B', ago(0.1))], new Set(['pos:B']), NOW)).toBeNull();
  });

  it(`asks for ${rules.promptDays} days after the purchase and not a moment longer`, () => {
    expect(pendingVisit([buy('pos:A', ago(rules.promptDays - 0.01))], new Set(), NOW)).not.toBeNull();
    expect(pendingVisit([buy('pos:A', ago(rules.promptDays + 0.01))], new Set(), NOW)).toBeNull();
  });

  it('only a purchase with a branch and a reference is a visit', () => {
    expect(pendingVisit([
      { kind: 'bonus', sourceRef: 'pos:X', branchId: 'rabyeh', deltaPoints: 50, createdAt: ago(0.1) },
      { kind: 'refund', sourceRef: 'pos:X', branchId: 'rabyeh', deltaPoints: -30, createdAt: ago(0.1) },
      buy('pos:Y', ago(0.1), 30, null),
      { kind: 'purchase', sourceRef: null, branchId: 'rabyeh', deltaPoints: 30, createdAt: ago(0.1) },
    ], new Set(), NOW)).toBeNull();
  });

  it(`an app order waits ${rules.orderDelayMinutes} minutes (it is not collected yet); a till purchase is asked at once`, () => {
    const min = 60_000 / DAY;
    expect(pendingVisit([buy('order:o1', ago((rules.orderDelayMinutes - 1) * min))], new Set(), NOW)).toBeNull();
    expect(pendingVisit([buy('order:o1', ago((rules.orderDelayMinutes + 1) * min))], new Set(), NOW)?.ref).toBe('order:o1');
    expect(pendingVisit([buy('pos:S/1', ago(1 * min))], new Set(), NOW)?.ref).toBe('pos:S/1');
    // A fresh order hides an older till visit rather than dragging it back up.
    expect(pendingVisit([buy('pos:S/1', ago(0.5)), buy('order:o2', ago(1 * min))], new Set(), NOW)).toBeNull();
  });

  it('a purchase that earned nothing is still a visit, with 0 points', () => {
    expect(pendingVisit([buy('order:o1', ago(0.1), 0)], new Set(), NOW)?.points).toBe(0);
  });

  it('stars are 1-5 whole; a comment is trimmed, empty is null, long is cut', () => {
    expect([0, 1, 5, 6, 2.5, '3', null].map(isValidStars)).toEqual([false, true, true, false, false, false, false]);
    expect(normalizeComment('   ')).toBeNull();
    expect(normalizeComment('  ممتاز  ')).toBe('ممتاز');
    expect(Array.from(normalizeComment('ق'.repeat(rules.commentMax + 50))!)).toHaveLength(rules.commentMax);
  });
});

describe('VR2 GET/POST /v1/me/visit-rating', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let seq = 900;
  const DRINK = menuItems.find((m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0]?.price > 0)!;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    backend = createMemoryBackend();
    app = await build(backend);
  });

  const member = async () => signIn(app, `+96279${String(++seq).padStart(7, '0')}`);
  const memberWithId = async () => {
    const phone = `+96279${String(++seq).padStart(7, '0')}`;
    const token = await signIn(app, phone);
    return { token, id: (await backend.findOrCreateByPhone(phone)).id };
  };
  const later = () => new Date(Date.now() + (visitRatingRulesFromConfig().orderDelayMinutes + 1) * 60_000);
  const pending = async (token: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/visit-rating', headers: auth(token) })).json().visit;
  const rate = (token: string, payload: unknown) =>
    app.inject({ method: 'POST', url: '/v1/me/visit-rating', headers: auth(token), payload: payload as object });

  it('after an order: not at once, then asked; rated once, earns nothing, and not asked again', async () => {
    const { token, id } = await memberWithId();
    expect(await pending(token)).toBeNull();
    const order = await app.inject({
      method: 'POST', url: '/v1/checkout', headers: { ...auth(token), 'idempotency-key': randomUUID() },
      payload: {
        branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash',
        lines: [{ itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [], qty: 2 }],
      },
    });
    expect(order.statusCode, order.body).toBe(201);
    expect(await pending(token)).toBeNull();                      // not collected yet
    const visit = (await backend.getPendingVisit(id, later()))!;
    expect(visit).toMatchObject({ ref: `order:${order.json().orderId}`, branchId: 'b1', points: order.json().pointsEarned });

    const pointsBefore = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth(token) })).json().points;
    const res = await rate(token, { ref: visit.ref, stars: 5, comment: '  قهوة ممتازة  ' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().rating).toMatchObject({ ref: visit.ref, branchId: 'b1', stars: 5, comment: 'قهوة ممتازة' });
    const pointsAfter = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth(token) })).json().points;
    expect(pointsAfter).toBe(pointsBefore);                       // «لا تعد بشيء»

    expect(await backend.getPendingVisit(id, later())).toBeNull();
    const again = await rate(token, { ref: visit.ref, stars: 1 });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('visit_already_rated');
  });

  it('refuses another member\'s visit, an unknown visit, bad stars, and anyone signed out', async () => {
    const { token: a, id: aId } = await memberWithId();
    const b = await member();
    const order = await app.inject({
      method: 'POST', url: '/v1/checkout', headers: { ...auth(a), 'idempotency-key': randomUUID() },
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [{ itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [], qty: 1 }] },
    });
    const ref = `order:${order.json().orderId}`;
    expect((await rate(b, { ref, stars: 4 })).statusCode).toBe(404);
    expect((await rate(a, { ref: 'order:nope', stars: 4 })).statusCode).toBe(404);
    for (const stars of [0, 6, 3.5, '5']) expect((await rate(a, { ref, stars })).statusCode, String(stars)).toBe(400);
    expect((await rate(a, { ref: 'wallet:1', stars: 4 })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/me/visit-rating', payload: { ref, stars: 4 } })).statusCode).toBe(401);
    // None of that rated it.
    expect((await backend.getPendingVisit(aId, later()))?.ref).toBe(ref);
  });
});
