import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { menuItems, resolveItemSize } from '@almond/shared/menu';
import { reprice } from '../src/pricing';
import { build } from '../src/server';
import { signIn } from './lib/signIn';

const cake = menuItems.find((item) => item.id === 'p-10307')!;
const ambiguous = menuItems.filter((item) => new Set(item.sizes.map((size) => size.id)).size < item.sizes.length);
const line = (sizeId: 'S' | 'M' | 'L', itemId = cake.id) => ({ itemId, sizeId, optionIds: [], qty: 1 });

describe('one size identity must name one priced choice', () => {
  it('the real 25-person/50 JOD cake cannot resolve to the 15-person/30 JOD cake', () => {
    const displayed = cake.sizes.find((size) => size.nameEn === '25 (تواصي)')!;
    expect(displayed.price).toBe(50);
    expect(cake.sizes.find((size) => size.id === displayed.id)?.price).toBe(30);
    expect(resolveItemSize(cake, displayed.id)).toBeNull();
    expect(() => reprice([line(displayed.id)])).toThrow(expect.objectContaining({ statusCode: 400, code: 'size_unavailable' }));
  });

  it('refuses every ambiguous shipped choice while retaining uniquely identified choices', () => {
    expect(ambiguous.length).toBeGreaterThan(0);
    for (const item of ambiguous) {
      for (const size of item.sizes) {
        const matches = item.sizes.filter((candidate) => candidate.id === size.id);
        if (matches.length > 1) {
          expect(() => reprice([line(size.id, item.id)]), `${item.id}/${size.nameEn}`).toThrow(expect.objectContaining({ code: 'size_unavailable' }));
        } else {
          expect(reprice([line(size.id, item.id)]).items[0]).toMatchObject({ sizeId: size.id, sizeNameEn: size.nameEn, unitBasePrice: size.price });
        }
      }
    }
  });

  it('does not replace an unknown size with the first size', () => {
    const regular = menuItems.find((item) => item.sizes.length === 1 && item.sizes[0].id === 'M')!;
    expect(() => reprice([line('S', regular.id)])).toThrow(expect.objectContaining({ code: 'size_unavailable' }));
    expect(resolveItemSize(regular, 'XL')).toBeNull();
    expect(resolveItemSize(null, 'M')).toBeNull();
  });

  it('keeps the known safe S/M cake prices and identities unchanged', () => {
    expect(reprice([line('S')]).items[0]).toMatchObject({ sizeId: 'S', sizeNameEn: '(6-8) people', unitBasePrice: 16 });
    expect(reprice([line('M')]).items[0]).toMatchObject({ sizeId: 'M', sizeNameEn: '(10-12) poeple', unitBasePrice: 20 });
  });
});

describe('an ambiguous size reaches neither checkout nor payment capture', () => {
  let app: FastifyInstance;
  let token: string;
  beforeAll(async () => { app = await build(); token = await signIn(app, '0794000081'); });
  afterAll(async () => { await app.close(); });

  it.each(['/v1/checkout', '/v1/payments/intent'])('refuses the basket at %s', async (url) => {
    const before = await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` } });
    const response = await app.inject({
      method: 'POST', url,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
      payload: { branchId: 'mecca-st', orderType: 'pickup', paymentMethod: url.endsWith('intent') ? 'visa' : 'wallet', lines: [line('S'), line('L')] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('size_unavailable');
    const after = await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` } });
    expect(after.json()).toEqual(before.json());
  });
});
