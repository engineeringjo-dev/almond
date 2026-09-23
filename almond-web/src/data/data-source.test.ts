import { describe, expect, it, vi } from 'vitest';
import type { Order } from '@almond/shared/types';

/**
 * Guards the DATA_SOURCE switch (src/lib/config.ts) and every seam that reads
 * it: payment (src/data/payment.ts), delivery (src/data/delivery.ts) and the
 * menu (src/data/menu.ts#getMenu).
 *
 * The invariant that matters most: under 'odoo' NOTHING may silently fall back
 * to mock behaviour — above all, a payment must never be reported 'paid'
 * without a gateway.
 *
 * `DATA_SOURCE` is computed at import time, so each case stubs the env and
 * imports fresh modules.
 */

async function withSource<T>(source: string | undefined, load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', source);
  return load();
}

const order = { id: 'order_42' } as Order;

describe('lib/config DATA_SOURCE', () => {
  it("defaults to the shared default ('mock') when the env var is unset", async () => {
    const cfg = await withSource(undefined, () => import('@/lib/config'));
    expect(cfg.DATA_SOURCE).toBe('mock');
    expect(cfg.isMock).toBe(true);
  });

  it("is 'odoo' when NEXT_PUBLIC_DATA_SOURCE=odoo", async () => {
    const cfg = await withSource('odoo', () => import('@/lib/config'));
    expect(cfg.DATA_SOURCE).toBe('odoo');
    expect(cfg.isMock).toBe(false);
  });

  // REGRESSION — fixed 2026-09-23 (was medium): src/lib/config.ts:10-12 — the env var is CAST, not
  // validated. `NEXT_PUBLIC_DATA_SOURCE=Odoo` (case typo), `=live`, or `=` (an
  // empty value, which `??` does not catch) yields a DATA_SOURCE that is
  // neither 'mock' nor 'odoo'. Every consumer tests `=== 'odoo'`, so the whole
  // site then runs the MOCK paths — payForOrder() reports `status: 'paid'`
  // with no gateway (see the payment test below) — while `isMock` is false, so
  // anything gating on isMock believes it is live. It should fail at boot.
  it.each([['Odoo'], ['live'], ['']])(
    'an unrecognised NEXT_PUBLIC_DATA_SOURCE=%j is rejected at import, not silently treated as mock',
    async (value) => {
      await expect(withSource(value, () => import('@/lib/config'))).rejects.toThrow();
    },
  );
});

describe('data/payment payForOrder', () => {
  it('mock approves instantly with a deterministic id', async () => {
    const { payForOrder } = await withSource('mock', () => import('@/data/payment'));
    await expect(payForOrder(order)).resolves.toEqual({ id: 'pay_order_42', status: 'paid' });
  });

  it("odoo REFUSES (no gateway wired) rather than pretending the order is paid", async () => {
    const { payForOrder } = await withSource('odoo', () => import('@/data/payment'));
    await expect(payForOrder(order)).rejects.toThrow(/not wired/);
  });

  // BUG (high once a gateway exists): src/components/checkout/CheckoutView.tsx:112
  // `if (paymentMethod !== 'cash') void payForOrder(order);` — the result is
  // discarded and the rejection is unhandled; the order is then saved, the
  // cart cleared and the success page shown whether or not payment succeeded.
  // Under 'odoo' today that is every card/CliQ order: "placed", never paid.
  // Needs a component/integration test (out of scope for this unit suite).
  it.todo('checkout awaits payForOrder and does not place the order when payment fails');

  // Consequence of the config.ts bug above, pinned at the money seam.
  it('a typo such as NEXT_PUBLIC_DATA_SOURCE=Odoo must not mark an order paid', async () => {
    // The module refuses to load at all, so no payForOrder exists to say "paid".
    await expect(withSource('Odoo', () => import('@/data/payment'))).rejects.toThrow(
      /must be 'mock' or 'odoo'/,
    );
  });
});

describe('data/delivery (browser side)', () => {
  it('mock returns the local flat fee / ETA and makes no request', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const d = await withSource(undefined, () => import('@/data/delivery'));
    expect(await d.quoteDelivery()).toEqual({ fee: d.DELIVERY_FEE, etaMinutes: d.DELIVERY_ETA });
    expect(await d.dispatchDelivery(order)).toEqual({
      id: 'disp_order_42',
      fleet: 'careem',
      status: 'assigned',
      etaMinutes: d.DELIVERY_ETA,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('odoo calls OUR server routes (never Ishbek directly) and sends no key', async () => {
    const fetchFn = vi.fn(async (_u: string, _i?: RequestInit) =>
      new Response(JSON.stringify({ fee: 2, etaMinutes: 30 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const d = await withSource('odoo', () => import('@/data/delivery'));
    expect(await d.quoteDelivery({ branchId: 'rabyeh' })).toEqual({ fee: 2, etaMinutes: 30 });
    await d.dispatchDelivery(order);

    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/api/delivery/quote', '/api/delivery/dispatch']);
    for (const [, init] of fetchFn.mock.calls) {
      const headers = init!.headers as Record<string, string>;
      expect(Object.keys(headers).map((h) => h.toLowerCase())).toEqual(['content-type']);
    }
    expect(JSON.parse(fetchFn.mock.calls[1][1]!.body as string)).toEqual({ order });
  });

  it('odoo surfaces a non-2xx from our route as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 502 })));
    const d = await withSource('odoo', () => import('@/data/delivery'));
    await expect(d.quoteDelivery()).rejects.toThrow('/api/delivery/quote → 502');
  });
});

describe('data/menu getMenu', () => {
  it('mock returns the shared menu', async () => {
    const [{ getMenu }, shared] = await withSource(undefined, () =>
      Promise.all([import('@/data/menu'), import('@almond/shared/menu')]),
    );
    const m = await getMenu();
    expect(m.items).toBe(shared.menuItems);
    expect(m.categories).toBe(shared.categories);
  });

  it('odoo throws instead of serving the stale bundled menu', async () => {
    const { getMenu } = await withSource('odoo', () => import('@/data/menu'));
    await expect(getMenu()).rejects.toThrow(/not wired/);
  });
});
