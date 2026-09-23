import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem, Order } from '@almond/shared/types';

/**
 * Guards the server-only Ishbek client (src/server/ishbek.ts):
 *   - it is LIVE only when DATA_SOURCE === 'odoo' AND ISHBEK_KEY is set;
 *     otherwise every call is a local mock and nothing leaves the process;
 *   - live calls carry X-Ishbek-Key (server-side only);
 *   - the dispatch payload prices lines correctly and keeps +03:00 stamps;
 *   - verifyWebhookSignature is constant-shape and fails closed.
 */

async function load(env: { source?: string; key?: string; secret?: string } = {}) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', env.source);
  vi.stubEnv('ISHBEK_KEY', env.key);
  vi.stubEnv('ISHBEK_WEBHOOK_SECRET', env.secret);
  return import('@/server/ishbek');
}

function stubFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

const line = (over: Partial<CartItem> = {}): CartItem => ({
  lineId: 'l1',
  itemId: 'latte',
  nameAr: 'لاتيه',
  nameEn: 'Latte',
  emoji: '☕',
  sizeId: 'M',
  sizeNameAr: 'وسط',
  sizeNameEn: 'Medium',
  unitBasePrice: 2.5,
  customizations: [
    { groupId: 'milk', optionId: 'oat', nameAr: 'شوفان', nameEn: 'Oat', priceDelta: 0.35 },
    { groupId: 'shot', optionId: 'x', nameAr: 'شوت', nameEn: 'Shot', priceDelta: 0.1 },
  ],
  qty: 2,
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: 'order_1',
  userId: 'u1',
  type: 'delivery',
  branchId: 'rabyeh',
  branchNameAr: 'الرابية',
  branchNameEn: 'Rabyeh',
  items: [line()],
  subtotal: 5.9,
  tax: 0,
  discount: 0,
  total: 7.4,
  paymentMethod: 'visa',
  paidFromBalance: false,
  status: 'received',
  createdAt: '2026-09-23T12:00:00.000+03:00',
  targetReadyAt: '2026-09-23T12:10:00.000+03:00',
  prepMinutes: 10,
  deliveryAddress: 'Rabyeh, Amman',
  ...over,
});

describe('live/mock switch', () => {
  it('mock (default) never calls fetch, even with a key present', async () => {
    const fetchFn = stubFetch({});
    const i = await load({ key: 'k' });
    expect(await i.ishbekQuote({})).toEqual({ fee: 1.5, etaMinutes: 35 });
    expect(await i.ishbekDispatch(order())).toEqual({
      id: 'disp_order_1',
      fleet: 'careem',
      status: 'assigned',
      etaMinutes: 35,
    });
    expect(await i.ishbekCancel({ dispatchId: 'd', orderId: 'o' })).toEqual({ status: 'cancelled' });
    expect(await i.ishbekStatus('o')).toEqual({ status: 'assigned' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('odoo WITHOUT a key stays mock (no unauthenticated calls to Ishbek)', async () => {
    const fetchFn = stubFetch({});
    const i = await load({ source: 'odoo' });
    await i.ishbekQuote({});
    await i.ishbekDispatch(order());
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('odoo + key goes live with X-Ishbek-Key and maps the quote reply', async () => {
    const fetchFn = stubFetch({ recommended: { fee: 2.25, etaMinutes: 41 } });
    const i = await load({ source: 'odoo', key: 'ishbek-secret-key' });
    expect(await i.ishbekQuote({ branchId: 'rabyeh' })).toEqual({ fee: 2.25, etaMinutes: 41 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toMatch(/^https?:\/\//);
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ branchId: 'rabyeh' }) });
    expect((init!.headers as Record<string, string>)['X-Ishbek-Key']).toBe('ishbek-secret-key');
  });

  it('live dispatch maps the reply and defaults a missing ETA to 35', async () => {
    stubFetch({ dispatchId: 'D9', fleet: 'talabat', status: 'assigned' });
    const i = await load({ source: 'odoo', key: 'k' });
    expect(await i.ishbekDispatch(order())).toEqual({
      id: 'D9',
      fleet: 'talabat',
      status: 'assigned',
      etaMinutes: 35,
    });
  });

  it('live non-2xx throws (the route turns it into 502)', async () => {
    stubFetch({ error: 'nope' }, 503);
    const i = await load({ source: 'odoo', key: 'k' });
    await expect(i.ishbekQuote({})).rejects.toThrow(/503/);
    await expect(i.ishbekStatus('o')).rejects.toThrow(/503/);
  });
});

describe('buildDispatchPayload', () => {
  it('prices each line as base + customizations, rounded to 3dp, with size as a modifier', async () => {
    const i = await load();
    const p = i.buildDispatchPayload(order());
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({ itemId: 'latte', name: 'لاتيه', qty: 2, unitPrice: 2.95 });
    expect(p.lines[0].modifiers[0]).toEqual({ groupId: 'size', optionId: 'M', name: 'وسط', priceDelta: 0 });
    expect(p.lines[0].modifiers).toHaveLength(3);
  });

  it('avoids float noise (0.1 + 0.2 style) in unitPrice', async () => {
    const i = await load();
    const p = i.buildDispatchPayload(
      order({
        items: [
          line({
            unitBasePrice: 0.1,
            customizations: [{ groupId: 'g', optionId: 'o', nameAr: 'x', nameEn: 'x', priceDelta: 0.2 }],
          }),
        ],
      }),
    );
    expect(p.lines[0].unitPrice).toBe(0.3);
  });

  it('keeps the +03:00 stamps untouched and never emits a bare Z', async () => {
    const i = await load();
    const p = i.buildDispatchPayload(order());
    expect(p.timing.placedAt).toBe('2026-09-23T12:00:00.000+03:00');
    expect(p.timing.readyAt).toBe('2026-09-23T12:10:00.000+03:00');
    expect(JSON.stringify(p)).not.toMatch(/\d{2}Z"/);
  });

  it('uses an empty dropoff text when the order has no address', async () => {
    const i = await load();
    expect(i.buildDispatchPayload(order({ deliveryAddress: undefined })).dropoff).toEqual({ text: '' });
  });
});

describe('verifyWebhookSignature', () => {
  const body = '{"a":1}';
  const sig = (k: string) => 'sha256=' + createHmac('sha256', k).update(body).digest('hex');

  it('true only for the exact sha256=<lowercase hex> of the raw body', async () => {
    const i = await load({ secret: 's' });
    expect(i.verifyWebhookSignature(body, sig('s'))).toBe(true);
    expect(i.verifyWebhookSignature(body + ' ', sig('s'))).toBe(false);
    expect(i.verifyWebhookSignature(body, sig('t'))).toBe(false);
    expect(i.verifyWebhookSignature(body, null)).toBe(false);
    expect(i.verifyWebhookSignature(body, '')).toBe(false);
  });

  it('does not throw on a length mismatch (timingSafeEqual would)', async () => {
    const i = await load({ secret: 's' });
    expect(() => i.verifyWebhookSignature(body, 'sha256=00')).not.toThrow();
    expect(i.verifyWebhookSignature(body, 'sha256=00')).toBe(false);
  });

  it('is case-sensitive: an UPPER-case hex digest is rejected (documented contract: lowercase)', async () => {
    const i = await load({ secret: 's' });
    expect(i.verifyWebhookSignature(body, 'sha256=' + sig('s').slice(7).toUpperCase())).toBe(false);
  });

  it('fails closed with no secret configured', async () => {
    const i = await load({});
    expect(i.verifyWebhookSignature(body, sig(''))).toBe(false);
  });
});
