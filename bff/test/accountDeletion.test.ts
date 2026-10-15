import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { config as loyalty } from '@almond/shared/config';
import { isDeletionDue, newDeletion } from '@almond/shared/loyalty/accountDeletion';
import { build } from '../src/server';
import { config } from '../src/config';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { __resetOtpState } from '../src/auth/otp';
import { signIn } from './lib/signIn';

/**
 * AD1-AD2 — account deletion (owner, 2026-10-15: «اضف حذف الحساب», «مهلة تراجع
 * قبل الحذف نعم», «عند الحذف يبقى الرصيد مربوط بالمعلومات ورقم الهاتف», «النقاط
 * لا تسقط الا بالموعدها»). AD1 is the shared rule, AD2 the HTTP surface. Both
 * backends: T37 in backend-contract.test.ts.
 */
const DAY = 86_400_000;

describe('AD1 the grace period', () => {
  it(`a request is carried out ${loyalty.ACCOUNT_DELETION_GRACE_DAYS} days later — not a moment sooner`, () => {
    const at = new Date('2026-10-15T09:00:00Z');
    const d = newDeletion(at);
    expect(d.requestedAt).toBe(at.toISOString());
    expect(Date.parse(d.eraseAfter) - at.getTime()).toBe(loyalty.ACCOUNT_DELETION_GRACE_DAYS * DAY);
    expect(isDeletionDue(d, new Date(Date.parse(d.eraseAfter) - 1))).toBe(false);
    expect(isDeletionDue(d, new Date(d.eraseAfter))).toBe(true);
  });
});

describe('AD2 /v1/me/deletion and the sweep', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let seq = 400;
  const KEY = 'test-admin-key-'.padEnd(32, 'x');
  const setAdminKey = (v: string) => { (config as unknown as { ADMIN_KEY: string }).ADMIN_KEY = v; };
  const DRINK = menuItems.find((m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0]?.price > 0)!;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    backend = createMemoryBackend();
    app = await build(backend);
    setAdminKey(KEY);
  });
  afterAll(async () => { await app.close(); setAdminKey(''); });

  const phone = () => `+96277${String(++seq).padStart(7, '0')}`;
  const again = async (p: string) => {
    __resetOtpState();
    const { code } = (await import('../src/auth/otp')).requestOtp(p);
    return app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: p, code } });
  };
  /** A member with a full profile, a paid order and a rating comment. */
  const fullMember = async () => {
    const p = phone();
    const token = await signIn(app, p);
    const id = (await backend.findOrCreateByPhone(p)).id;
    const profile = await app.inject({
      method: 'POST', url: '/v1/me/profile', headers: auth(token),
      payload: { name: 'حمزة', birthday: '1990-04-20', gender: 'male' },
    });
    expect(profile.statusCode, profile.body).toBe(200);
    const order = await app.inject({
      method: 'POST', url: '/v1/checkout', headers: { ...auth(token), 'idempotency-key': randomUUID() },
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [{ itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [], qty: 3 }] },
    });
    expect(order.statusCode, order.body).toBe(201);
    await backend.rateVisit(id, { ref: `order:${order.json().orderId}`, stars: 5, comment: 'كلامي أنا' }, new Date());
    return { p, token, id };
  };

  it('ask → the date; ask again → the same date; withdraw → gone', async () => {
    const { token } = await fullMember();
    const first = await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: auth(token) });
    expect(first.statusCode, first.body).toBe(200);
    const { deletion } = first.json();
    expect(Date.parse(deletion.eraseAfter) - Date.parse(deletion.requestedAt)).toBe(loyalty.ACCOUNT_DELETION_GRACE_DAYS * DAY);
    const second = await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: auth(token) });
    expect(second.json().deletion).toEqual(deletion);              // never moves
    expect((await app.inject({ method: 'GET', url: '/v1/me/deletion', headers: auth(token) })).json().deletion).toEqual(deletion);
    const off = await app.inject({ method: 'DELETE', url: '/v1/me/deletion', headers: auth(token) });
    expect(off.json()).toEqual({ cancelled: true });
    expect((await app.inject({ method: 'GET', url: '/v1/me/deletion', headers: auth(token) })).json().deletion).toBeNull();
  });

  it('signing in again during the grace period withdraws the request, and says so', async () => {
    const { p, token } = await fullMember();
    await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: auth(token) });
    const back = await again(p);
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json().deletionCancelled).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/v1/me/deletion', headers: auth(token) })).json().deletion).toBeNull();
    // An ordinary sign-in says nothing was cancelled.
    expect((await again(p)).json().deletionCancelled).toBe(false);
  });

  it('🔴 after the grace period: the profile and the comments go; the phone, points, history and bonus stamp stay', async () => {
    const { p, token, id } = await fullMember();
    const before = await backend.getMember(id);
    const historyBefore = await backend.getHistory(id);
    expect(before.name).toBe('حمزة');
    const listedBefore = await app.inject({ method: 'GET', url: '/v1/admin/visit-ratings?days=1', headers: { 'x-admin-key': KEY } });
    expect(listedBefore.statusCode, listedBefore.body).toBe(200);
    expect(listedBefore.json().ratings.some((r: { comment: string | null }) => r.comment === 'كلامي أنا')).toBe(true);
    expect(liveBalance(before.lots)).toBeGreaterThan(0);
    await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: auth(token) });

    // The sweep is the back office's; a member token cannot run it.
    expect((await app.inject({ method: 'POST', url: '/v1/admin/deletions/sweep', headers: auth(token) })).statusCode).toBe(401);
    // Run today: nothing is due yet.
    const today = await app.inject({ method: 'POST', url: '/v1/admin/deletions/sweep', headers: { 'x-admin-key': KEY } });
    expect(today.json()).toEqual({ erased: 0 });
    expect((await backend.getMember(id)).name).toBe('حمزة');

    const due = new Date(Date.now() + (loyalty.ACCOUNT_DELETION_GRACE_DAYS + 1) * DAY);
    expect(await backend.eraseDueDeletions(due)).toBe(1);
    expect(await backend.eraseDueDeletions(due)).toBe(0);            // idempotent
    const after = await backend.getMember(id);
    expect(after).toMatchObject({ name: '', birthday: null, gender: null, phone: before.phone });
    expect(after.profileBonusAt).toBe(before.profileBonusAt);        // the bonus is not paid twice
    expect(after.lots).toEqual(before.lots);                         // «النقاط لا تسقط الا بالموعدها»
    expect(after.walletLots).toEqual(before.walletLots);
    expect(await backend.getHistory(id)).toEqual(historyBefore);
    expect(await backend.getDeletion(id)).toBeNull();
    // Their words are gone from the back office's list; the stars stay.
    const listed = await app.inject({ method: 'GET', url: '/v1/admin/visit-ratings?days=1', headers: { 'x-admin-key': KEY } });
    const theirs = listed.json().ratings.filter((r: { ref: string }) => historyBefore.some((h) => h.sourceRef === r.ref));
    expect(theirs).toHaveLength(1);
    expect(theirs[0]).toMatchObject({ stars: 5, comment: null });

    // Back with the same number: the same account and balance, an empty profile,
    // and nothing to cancel.
    const back = await again(p);
    expect(back.json()).toMatchObject({ member: { id, name: '' }, deletionCancelled: false });
  });

  it('a profile completed again after returning does not pay the bonus twice', async () => {
    const { p, token, id } = await fullMember();
    await app.inject({ method: 'POST', url: '/v1/me/deletion', headers: auth(token) });
    await backend.eraseDueDeletions(new Date(Date.now() + (loyalty.ACCOUNT_DELETION_GRACE_DAYS + 1) * DAY));
    const back = (await again(p)).json().token as string;
    const pointsBefore = liveBalance((await backend.getMember(id)).lots);
    const res = await app.inject({
      method: 'POST', url: '/v1/me/profile', headers: auth(back),
      payload: { name: 'حمزة', birthday: '1990-04-20', gender: 'male' },
    });
    expect(res.json().bonusGranted).toBe(0);
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(pointsBefore);
  });
});
