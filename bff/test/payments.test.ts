import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { menuItems } from '@almond/shared/menu';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { config, insecureBootReasons } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { __mockPaymentProvider, paymentProvider, paymentProviderConfigError, UnconfiguredPaymentProvider } from '../src/payments';
import { MOCK_SIGNATURE_HEADER } from '../src/payments/mock';
import { cartHash } from '../src/payments/intent';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * PAY — THE CARD-GATEWAY SEAM. A card order is placed ONLY against a payment
 * the provider confirms captured, for exactly the re-priced total of exactly
 * this basket, owned by this member and unspent. Everything here runs against
 * the mock gateway; a real one implements the same interface.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const saved = { PAYMENT_PROVIDER: config.PAYMENT_PROVIDER, NODE_ENV: config.NODE_ENV, DATABASE_URL: config.DATABASE_URL };

let phoneSeq = 0;
const freshPhone = () => `079${String(5_000_000 + phoneSeq++).padStart(7, '0')}`;
const subOf = (token: string) =>
  (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub: string }).sub;
const ITEM = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0 && m.sizes[0].price > 0)!;
const cart = (qty = 2, paymentMethod = 'visa') => ({
  branchId: 'b1', orderType: 'pickup', paymentMethod,
  lines: [{ itemId: ITEM.id, sizeId: ITEM.sizes[0].id, optionIds: [], qty }],
});

beforeEach(() => { __resetRateLimits(); __resetOtpState(); cfg.PAYMENT_PROVIDER = 'mock'; });
afterEach(() => { Object.assign(cfg, saved); });

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('PAY card payments — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); }, 60_000);
  afterAll(async () => { await app.close(); });

  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() });
  const intent = (token: string, body: Record<string, unknown> = cart()) =>
    app.inject({ method: 'POST', url: '/v1/payments/intent', headers: auth(token), payload: body });
  const checkout = (token: string, body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/v1/checkout', headers: auth(token), payload: body });
  const refOf = async (intentId: string) => (await backend.getPaymentIntent(intentId))!.providerRef;
  const capture = async (intentId: string, fils?: number) =>
    __mockPaymentProvider().settle(await refOf(intentId), 'captured', fils);
  const points = async (token: string) => liveBalance((await backend.getMember(subOf(token))).lots);
  const webhook = (body: string, headers: Record<string, string> = {}, provider = 'mock') => app.inject({
    method: 'POST', url: `/v1/payments/webhook/${provider}`, payload: body,
    headers: { 'content-type': 'application/json', ...headers },
  });

  it('PAY.1 🔴 no provider configured: an intent and a webhook are an honest 503, and a card order is refused', async () => {
    cfg.PAYMENT_PROVIDER = '';
    const token = await signIn(app, freshPhone());
    const r = await intent(token);
    expect(r.statusCode).toBe(503);
    expect(r.json().error).toBe('payment_provider_unconfigured');
    expect((await webhook('{}')).statusCode).toBe(503);
    const order = await checkout(token, cart());
    expect(order.statusCode).toBe(402);
    expect(order.json().error).toBe('payment_not_captured');
  });

  it('PAY.2 🔴 a card order with no captured payment is NOT placed — not even in development', async () => {
    // Before this seam, development (the memory store) placed it AND paid
    // points on it (funding.ts). A card order that says "paid" with nothing
    // behind it must not exist at all.
    const token = await signIn(app, freshPhone());
    for (const method of ['visa', 'mastercard', 'cliq', 'paypal']) {
      const r = await checkout(token, cart(2, method));
      expect(r.statusCode, method).toBe(402);
      expect(r.json().error).toBe('payment_not_captured');
    }
    expect(await backend.getHistory(subOf(token))).toEqual([]);
    // Cash is unchanged, and a paymentIntentId on it is a client error.
    expect((await checkout(token, cart(2, 'cash'))).statusCode).toBe(201);
    expect((await checkout(token, { ...cart(2, 'cash'), paymentIntentId: 'pi_x' })).statusCode).toBe(400);
  });

  it('PAY.3 🔴 intent → gateway captures → checkout: the order is placed and earns, even where cash earns nothing', async () => {
    // A persistent store: unfundedValueAllowed() is false, so cash earns 0 —
    // the card order earns because the GATEWAY confirmed the money.
    cfg.DATABASE_URL = 'postgres://staging.example/almond';
    const token = await signIn(app, freshPhone());
    const i = await intent(token);
    expect(i.statusCode).toBe(201);
    const { intentId, amountJod, redirectUrl, clientSecret } = i.json();
    expect(intentId).toMatch(/^pi_/);
    expect(typeof redirectUrl).toBe('string');
    expect(typeof clientSecret).toBe('string');
    const stored = await backend.getPaymentIntent(intentId);
    expect(stored).toMatchObject({ status: 'pending', amountFils: Math.round(amountJod * 1000), provider: 'mock', orderId: null });
    expect(stored!.cartHash).toBe(cartHash({ branchId: 'b1', orderType: 'pickup', lines: cart().lines }));

    const early = await checkout(token, { ...cart(), paymentIntentId: intentId });
    expect(early.statusCode).toBe(402);                      // pending is not captured
    expect(await points(token)).toBe(0);

    await capture(intentId);
    const r = await checkout(token, { ...cart(), paymentIntentId: intentId });
    expect(r.statusCode).toBe(201);
    expect(r.json().total).toBe(amountJod);                  // the amount the gateway took
    expect(r.json().pointsEarned).toBeGreaterThan(0);
    expect(await points(token)).toBe(r.json().pointsEarned);
    expect(await backend.getPaymentIntent(intentId)).toMatchObject({ status: 'captured', orderId: r.json().orderId });
    // Cash, same process: nothing moved, nothing earned.
    const cash = await checkout(token, cart(2, 'cash'));
    expect(cash.json().pointsEarned).toBe(0);
  });

  it('PAY.4 🔴 one payment pays for ONE order', async () => {
    const token = await signIn(app, freshPhone());
    const { intentId } = (await intent(token)).json();
    await capture(intentId);
    expect((await checkout(token, { ...cart(), paymentIntentId: intentId })).statusCode).toBe(201);
    const earned = await points(token);
    const again = await checkout(token, { ...cart(), paymentIntentId: intentId });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('payment_intent_used');
    expect(await points(token)).toBe(earned);
  });

  it('PAY.5 🔴 a payment for another basket, a partial capture, a declined card or someone else\'s payment funds nothing', async () => {
    const token = await signIn(app, freshPhone());
    const other = await signIn(app, freshPhone());
    const refused = async (body: Record<string, unknown>, who = token) => {
      const r = await checkout(who, body);
      expect(r.statusCode, JSON.stringify(body).slice(0, 80)).toBe(402);
      expect(r.json().error).toBe('payment_not_captured');
    };
    const a = (await intent(token)).json().intentId as string;
    await capture(a);
    await refused({ ...cart(3), paymentIntentId: a });                     // a bigger basket
    await refused({ ...cart(), branchId: 'b2', paymentIntentId: a });      // another branch
    await refused({ ...cart(), paymentIntentId: a }, other);               // someone else's payment
    const partial = (await intent(token)).json();
    await capture(partial.intentId, Math.round(partial.amountJod * 1000) - 1);
    await refused({ ...cart(), paymentIntentId: partial.intentId });
    const declined = (await intent(token)).json().intentId as string;
    __mockPaymentProvider().settle(await refOf(declined), 'failed');
    await refused({ ...cart(), paymentIntentId: declined });
    await refused({ ...cart(), paymentIntentId: 'pi_does_not_exist' });
    expect(await points(token)).toBe(0);
    expect(await points(other)).toBe(0);
    // …and the untouched payment `a` still pays for ITS basket.
    expect((await checkout(token, { ...cart(), paymentIntentId: a })).statusCode).toBe(201);
  });

  it('PAY.6 🔴 the corporate discount is in the amount the gateway is asked for — and the member still earns nothing', async () => {
    const phone = freshPhone();
    await backend.saveCompany({ id: `pay${phone}`, nameAr: 'شركة', nameEn: 'Co', percentOff: 50, active: true });
    await backend.replaceRoster(`pay${phone}`, [{ phone, companyId: `pay${phone}` }]);
    const staff = await signIn(app, phone);
    const full = await signIn(app, freshPhone());
    const discounted = (await intent(staff)).json();
    const undiscounted = (await intent(full)).json();
    expect(discounted.amountJod).toBeLessThan(undiscounted.amountJod);
    await capture(discounted.intentId);
    const r = await checkout(staff, { ...cart(), paymentIntentId: discounted.intentId });
    expect(r.statusCode).toBe(201);
    expect(r.json().total).toBe(discounted.amountJod);
    expect(r.json().pointsEarned).toBe(0);
  });

  it('PAY.7 🔴 the webhook: signature over the RAW body or 401; wrong provider 404; a signed capture is recorded', async () => {
    const token = await signIn(app, freshPhone());
    const { intentId } = (await intent(token)).json();
    const ref = await refOf(intentId);
    const body = JSON.stringify({ providerRef: ref, status: 'captured' });
    const sig = __mockPaymentProvider().signWebhook(body);
    expect((await webhook(body)).statusCode).toBe(401);                                          // unsigned
    expect((await webhook(body, { [MOCK_SIGNATURE_HEADER]: sig.replace(/.$/, (c) => (c === '0' ? '1' : '0')) })).statusCode).toBe(401);
    // Re-serialised with different whitespace: not the bytes that were signed.
    expect((await webhook(JSON.stringify(JSON.parse(body), null, 1), { [MOCK_SIGNATURE_HEADER]: sig })).statusCode).toBe(401);
    // A member JWT is not a gateway signature.
    expect((await webhook(body, { authorization: `Bearer ${token}` })).statusCode).toBe(401);
    expect((await webhook(body, { [MOCK_SIGNATURE_HEADER]: sig }, 'hyperpay')).statusCode).toBe(404);
    expect((await backend.getPaymentIntent(intentId))?.status).toBe('pending');
    const ok = await webhook(body, { [MOCK_SIGNATURE_HEADER]: sig });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ received: true, intentId });
    expect((await backend.getPaymentIntent(intentId))?.status).toBe('captured');
    // An unknown reference is acknowledged (a gateway would retry for days) but matches nothing.
    const stray = JSON.stringify({ providerRef: 'mock_unknown', status: 'captured' });
    expect((await webhook(stray, { [MOCK_SIGNATURE_HEADER]: __mockPaymentProvider().signWebhook(stray) })).json())
      .toEqual({ received: true, intentId: null });
    // The webhook recorded it — and the checkout still asks the gateway itself.
    expect((await checkout(token, { ...cart(), paymentIntentId: intentId })).statusCode).toBe(201);
  });

  it('PAY.8 the intent route: member-only, idempotency-keyed, card methods only, bounded like checkout', async () => {
    const token = await signIn(app, freshPhone());
    expect((await app.inject({ method: 'POST', url: '/v1/payments/intent', payload: cart() })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/v1/payments/intent', headers: { authorization: `Bearer ${token}` }, payload: cart() })).statusCode).toBe(400);
    expect((await intent(token, cart(2, 'cash'))).statusCode).toBe(400);
    expect((await intent(token, cart(2, 'wallet'))).statusCode).toBe(400);
    expect((await intent(token, cart(1001))).statusCode).toBe(400);
    // A replayed key returns the SAME intent — no second gateway call.
    const key = randomUUID();
    const send = () => app.inject({ method: 'POST', url: '/v1/payments/intent', headers: { authorization: `Bearer ${token}`, 'idempotency-key': key }, payload: cart() });
    const first = await send();
    const again = await send();
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(again.json().intentId).toBe(first.json().intentId);
  });
});

describe('PAY.9 production posture', () => {
  const strong = {
    NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), POS_TOKEN_SECRET: 'y'.repeat(48),
    POS_SCAN_KEY: 'z'.repeat(32), ADMIN_KEY: 'w'.repeat(32), CORS_ORIGINS: 'https://almond.jo',
    DATABASE_URL: 'postgresql://x', TRUST_PROXY_SET: true,
  };

  it('🔴 production refuses to boot on the mock gateway — and unset is allowed (card payment answers 503)', () => {
    expect(insecureBootReasons({ ...strong, PAYMENT_PROVIDER: 'mock' }).join(' | ')).toMatch(/PAYMENT_PROVIDER is "mock"/);
    expect(insecureBootReasons({ ...strong, PAYMENT_PROVIDER: '' })).toEqual([]);
    expect(insecureBootReasons({ ...strong, NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock' })).toEqual([]);
  });

  it('🔴 even past the boot check, a production process never serves the mock', () => {
    cfg.PAYMENT_PROVIDER = 'mock';
    cfg.NODE_ENV = 'production';
    expect(paymentProvider()).toBeInstanceOf(UnconfiguredPaymentProvider);
    cfg.NODE_ENV = saved.NODE_ENV;
    expect(paymentProvider().name).toBe('mock');
  });

  it('a provider name that is not registered refuses to boot in every environment', async () => {
    expect(paymentProviderConfigError('hyperpay')).toMatch(/not a registered provider/);
    expect(paymentProviderConfigError('mock')).toBeNull();
    expect(paymentProviderConfigError('')).toBeNull();
    cfg.PAYMENT_PROVIDER = 'hyperpay';
    await expect(build(createMemoryBackend())).rejects.toThrow(/PAYMENT_PROVIDER "hyperpay"/);
  });
});
