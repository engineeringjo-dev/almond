import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

/**
 * Guards the inbound Ishbek status webhook (POST /api/delivery/webhook):
 * HMAC-SHA256 over the RAW body, `sha256=<hex>` in x-ishbek-signature, fail
 * closed when ISHBEK_WEBHOOK_SECRET is unset, and the +03:00 timestamp contract.
 *
 * server/ishbek.ts reads the secret once at import, so each test stubs the env
 * and imports a fresh copy of the route.
 */

const SECRET = 'whsec_test_123';

async function loadRoute(secret: string | undefined = SECRET) {
  vi.resetModules();
  vi.stubEnv('ISHBEK_WEBHOOK_SECRET', secret);
  return import('./route');
}

const sign = (raw: string, key = SECRET) =>
  'sha256=' + createHmac('sha256', key).update(raw).digest('hex');

function req(raw: string, signature?: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature != null) headers['x-ishbek-signature'] = signature;
  return new Request('https://almond.test/api/delivery/webhook', { method: 'POST', headers, body: raw });
}

const EVENT = {
  orderId: 'order_abc',
  dispatchId: 'disp_order_abc',
  fleet: 'careem',
  status: 'picked_up',
  occurredAt: '2026-09-23T12:05:00+03:00',
};
const RAW = JSON.stringify(EVENT);

describe('webhook signature verification', () => {
  it('accepts a correctly signed event', async () => {
    const { POST } = await loadRoute();
    const res = await POST(req(RAW, sign(RAW)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejects a missing signature header (401)', async () => {
    const { POST } = await loadRoute();
    expect((await POST(req(RAW, null))).status).toBe(401);
  });

  it('rejects an empty signature header (401)', async () => {
    const { POST } = await loadRoute();
    expect((await POST(req(RAW, ''))).status).toBe(401);
  });

  it('rejects a signature made with the wrong secret (401)', async () => {
    const { POST } = await loadRoute();
    expect((await POST(req(RAW, sign(RAW, 'not-the-secret')))).status).toBe(401);
  });

  it('rejects a valid signature replayed over a DIFFERENT body (401)', async () => {
    const { POST } = await loadRoute();
    const tampered = JSON.stringify({ ...EVENT, status: 'delivered' });
    expect((await POST(req(tampered, sign(RAW)))).status).toBe(401);
  });

  it('signs the RAW bytes: re-serialised JSON with different whitespace does not verify', async () => {
    const { POST } = await loadRoute();
    const pretty = JSON.stringify(EVENT, null, 2);
    expect((await POST(req(pretty, sign(RAW)))).status).toBe(401);
    expect((await POST(req(pretty, sign(pretty)))).status).toBe(200);
  });

  it.each([
    ['bare hex without the sha256= prefix', (raw: string) => sign(raw).slice('sha256='.length)],
    ['sha1= prefix', (raw: string) => sign(raw).replace('sha256=', 'sha1=')],
    ['truncated', (raw: string) => sign(raw).slice(0, -2)],
    ['one extra char', (raw: string) => sign(raw) + '0'],
  ])('rejects a malformed signature: %s (401)', async (_l, make) => {
    const { POST } = await loadRoute();
    expect((await POST(req(RAW, make(RAW)))).status).toBe(401);
  });

  it('FAILS CLOSED when ISHBEK_WEBHOOK_SECRET is unset — even a signature made with an empty key is refused', async () => {
    const { POST } = await loadRoute(undefined);
    expect((await POST(req(RAW, sign(RAW, '')))).status).toBe(401);
    expect((await POST(req(RAW, null))).status).toBe(401);
  });

  it('FAILS CLOSED when ISHBEK_WEBHOOK_SECRET is the empty string', async () => {
    const { POST } = await loadRoute('');
    expect((await POST(req(RAW, sign(RAW, '')))).status).toBe(401);
  });
});

describe('webhook payload contract (after a valid signature)', () => {
  it('rejects invalid JSON with 400', async () => {
    const { POST } = await loadRoute();
    const raw = '{"orderId":';
    expect((await POST(req(raw, sign(raw)))).status).toBe(400);
  });

  it.each([
    ['a bare UTC Z stamp', '2026-09-23T09:05:00Z'],
    ['no offset at all', '2026-09-23T12:05:00'],
    ['a missing occurredAt', undefined],
  ])('rejects %s with 422', async (_l, occurredAt) => {
    const { POST } = await loadRoute();
    const raw = JSON.stringify({ ...EVENT, occurredAt });
    const res = await POST(req(raw, sign(raw)));
    expect(res.status).toBe(422);
  });

  it('accepts any explicit offset (the contract is "has an offset", not "+03:00" only)', async () => {
    const { POST } = await loadRoute();
    const raw = JSON.stringify({ ...EVENT, occurredAt: '2026-09-23T09:05:00+00:00' });
    expect((await POST(req(raw, sign(raw)))).status).toBe(200);
  });

  // REGRESSION — fixed 2026-09-23 (was low): src/app/api/delivery/webhook/route.ts:30 — `event.occurredAt`
  // is read without checking that the parsed JSON is an object. A signed body of
  // `null` makes `event.occurredAt` throw a TypeError outside the try/catch,
  // which escapes the handler as an unhandled 500. Only the holder of the secret
  // can send it, so the impact is a 500 in the logs rather than a bypass.
  it('a signed body of `null` is rejected with 4xx, not an unhandled TypeError', async () => {
    const { POST } = await loadRoute();
    const raw = 'null';
    const res = await POST(req(raw, sign(raw)));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
