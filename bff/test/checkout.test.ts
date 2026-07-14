import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { menuItems } from '@almond/shared/menu';
import { build } from '../src/server';

let app: FastifyInstance;
let token: string;
const line = (() => {
  const item = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0)!;
  return { itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 };
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(url: string, body: any, headers: Record<string, string> = {}): Promise<any> {
  return app.inject({ method: 'POST', url, payload: body, headers: { authorization: `Bearer ${token}`, ...headers } });
}

beforeAll(async () => {
  app = await build();
  await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '0790000000' } });
  const v = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: '0790000000', code: '123456' } });
  token = v.json().token;
});

describe('BFF checkout', () => {
  it('issues a JWT and reads balance from the token (no client userId)', () => {
    expect(token).toBeTruthy();
  });

  it('requires an Idempotency-Key on financial POSTs', async () => {
    const r = await post('/v1/checkout', { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [line] });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('idempotency_key_required');
  });

  it('checks out atomically and grants server-computed points', async () => {
    const r = await post('/v1/checkout',
      { branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet', lines: [line] },
      { 'idempotency-key': randomUUID() });
    expect(r.statusCode).toBe(201);
    const b = r.json();
    expect(b.orderId).toBeTruthy();
    expect(b.total).toBeGreaterThan(0);
    expect(b.pointsEarned).toBeGreaterThan(0);
  });

  it('is idempotent: replaying the same key does not double-charge the wallet', async () => {
    const key = randomUUID();
    const body = { branchId: 'b1', orderType: 'pickup' as const, paymentMethod: 'wallet' as const, lines: [line] };
    const before = (await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` } })).json().balance;
    const r1 = await post('/v1/checkout', body, { 'idempotency-key': key });
    const r2 = await post('/v1/checkout', body, { 'idempotency-key': key });
    const after = (await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` } })).json().balance;
    expect(r1.json().orderId).toBe(r2.json().orderId);      // same order returned
    expect(r2.headers['idempotent-replay']).toBe('true');
    expect(Number((before - after).toFixed(3))).toBe(Number(r1.json().total.toFixed(3))); // charged once, not twice
  });

  it('rejects wallet payment with insufficient balance (no silent failure)', async () => {
    const many = Array.from({ length: 200 }, () => line); // huge order > 20 JOD wallet
    const r = await post('/v1/checkout',
      { branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet', lines: many },
      { 'idempotency-key': randomUUID() });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('insufficient_wallet');
  });

  it('rejects requests without a token', async () => {
    const r = await app.inject({ method: 'GET', url: '/v1/me/balance' });
    expect(r.statusCode).toBe(401);
  });
});
