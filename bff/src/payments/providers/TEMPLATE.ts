/**
 * ════════════════════════════════════════════════════════════════════════════
 *  TEMPLATE — a real card gateway for the Almond BFF.  NOT REGISTERED.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * For Ishbek. Copy this file to `providers/<gateway>.ts` (e.g. hyperpay.ts,
 * meps.ts, networkintl.ts), rename the class, implement the three methods, and
 * register it in `bff/src/payments/index.ts`:
 *
 *     export const PAYMENT_PROVIDERS = {
 *       mock: () => new MockPaymentProvider(),
 *       hyperpay: () => new HyperPayProvider(),          // ← one line
 *     };
 *
 * Then set, on the server only (never in an app or web bundle):
 *
 *     PAYMENT_PROVIDER=hyperpay
 *     PAYMENT_GATEWAY_BASE_URL=https://eu-prod.oppwa.com      (sandbox URL in staging)
 *     PAYMENT_GATEWAY_ENTITY_ID=…                              (merchant/entity/outlet id)
 *     PAYMENT_GATEWAY_ACCESS_TOKEN=…                           (server API key — SECRET)
 *     PAYMENT_GATEWAY_WEBHOOK_SECRET=…                         (webhook signing key — SECRET)
 *     PAYMENT_RETURN_URL=https://app.almond.jo/pay/return      (optional)
 *
 * and point the gateway's webhook/notification URL at
 *
 *     POST https://<bff>/v1/payments/webhook/hyperpay
 *
 * WHAT IS ALREADY DONE FOR YOU (do not re-implement it in the provider):
 *   - the cart is re-priced on the server and the amount is handed to you in
 *     integer FILS; you never see a client-supplied amount;
 *   - the intent row, its binding to the member and to the basket, and the
 *     "one payment pays for one order" rule live in the database;
 *   - /v1/checkout calls `getCapture` and refuses the order (402) unless it
 *     answers `captured` with EXACTLY the order total;
 *   - the webhook route reads the RAW body for you and answers 401 when
 *     `verifyWebhook` returns null.
 *
 * THE RULES (bff/src/payments/provider.ts explains each):
 *   1. Amounts in integer fils. JOD has 3 decimals: 5.250 JOD = 5250 fils.
 *      Format for the gateway with `(fils / 1000).toFixed(3)` and parse back
 *      with `Math.round(Number(amount) * 1000)` — never keep a float around.
 *   2. getCapture asks the GATEWAY, server-to-server, with the secret. It never
 *      trusts a redirect query string or anything the phone says.
 *   3. verifyWebhook: HMAC (or the gateway's scheme) over the RAW body, compared
 *      with crypto.timingSafeEqual on equal-length buffers, BEFORE parsing.
 *      Anything unsigned, mis-signed or unparseable → return null.
 *      If the gateway ENCRYPTS notifications (HyperPay does: AES-256-GCM with
 *      the webhook key, IV and auth tag in headers), decrypt first — the GCM
 *      auth tag IS the signature check; a decrypt failure → return null.
 *   4. Secrets from process.env, read here, never logged, never returned.
 *   5. Anything unexpected from the gateway → throw. Never guess "pending".
 *      The route turns a thrown error into a 5xx and no order is placed.
 *
 * Status mapping is gateway-specific. Map ONLY a completed capture/sale to
 * 'captured' (e.g. HyperPay result codes /^(000\.000\.|000\.100\.1|000\.[36])/
 * on a DB/"debit" payment; MEPS/MPGS `result=SUCCESS` with
 * `order.status=CAPTURED`; Network International `state=CAPTURED`/`PURCHASED`).
 * An authorisation that has not been captured is 'pending'.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Capture, CreateIntentInput, CreatedIntent, PaymentProvider, WebhookEvent } from '../provider';

/** Read one required secret. Throws at first use if it is missing — a gateway
 *  with no key must fail loudly, never fall back to an empty string. */
function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — the payment gateway cannot be called`);
  return v;
}

/** Constant-time comparison of two signatures (hex/base64 strings). */
export function signaturesMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class TemplateGatewayProvider implements PaymentProvider {
  /** The registry name and the webhook path segment. Lowercase. */
  readonly name = 'template';

  async createIntent(_input: CreateIntentInput): Promise<CreatedIntent> {
    // 1. const base = requiredEnv('PAYMENT_GATEWAY_BASE_URL');
    //    const token = requiredEnv('PAYMENT_GATEWAY_ACCESS_TOKEN');
    // 2. POST to the gateway's "create checkout/session/order" endpoint:
    //      amount            = (input.amountFils / 1000).toFixed(3)
    //      currency          = input.currency            ('JOD')
    //      merchant reference = input.intentId            (our id — reconciliation)
    //      description       = input.description
    //      return/redirect   = input.returnUrl
    //    with `Authorization: Bearer ${token}` and a timeout (AbortSignal.timeout(10_000)).
    // 3. !response.ok, or no id in the body → throw.
    // 4. return { providerRef: <gateway id>, redirectUrl?: <hosted page>, clientSecret?: <sdk token> };
    void requiredEnv;
    throw new Error('not implemented');
  }

  async getCapture(_providerRef: string): Promise<Capture> {
    // 1. GET the payment/order status for `providerRef` from the gateway,
    //    server-to-server, with the secret token.
    // 2. Map the gateway's result to 'captured' | 'pending' | 'failed' (see the
    //    header). Parse the captured amount back to integer fils:
    //      amountFils: Math.round(Number(body.amount) * 1000)
    //    and check the currency is 'JOD' — anything else → throw.
    // 3. return { status, amountFils, captureRef: <gateway transaction id> };
    throw new Error('not implemented');
  }

  verifyWebhook(_rawBody: string, _headers: Record<string, string | undefined>): WebhookEvent | null {
    // 1. const secret = requiredEnv('PAYMENT_GATEWAY_WEBHOOK_SECRET');
    // 2. const presented = headers['x-signature'];   // the gateway's header name
    //    if (typeof presented !== 'string') return null;
    // 3. const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    //    if (!signaturesMatch(presented, expected)) return null;
    //    (or decrypt, for gateways that encrypt — see the header)
    // 4. Parse ONLY now: try { JSON.parse(rawBody) } catch { return null }.
    // 5. Map the event to { providerRef, status: 'captured' | 'failed' }, or
    //    return null for an event type this integration does not handle.
    void createHmac;
    throw new Error('not implemented');
  }
}
