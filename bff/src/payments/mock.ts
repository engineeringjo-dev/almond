import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Capture, CreateIntentInput, CreatedIntent, PaymentProvider, WebhookEvent } from './provider';

/**
 * A DETERMINISTIC FAKE GATEWAY — development and tests only.
 *
 * Production refuses to boot with PAYMENT_PROVIDER=mock (config.ts
 * insecureBootReasons), and payments/index.ts will not serve it in a
 * production process even if the boot check were bypassed: its webhook secret
 * is a constant in this repository, so in production it would be a way to mark
 * any card order paid without paying.
 *
 * It behaves like a real gateway in the ways the BFF depends on:
 *   - an intent starts `pending` and becomes `captured` or `failed` only when
 *     the "gateway" says so — here, `settle()` (tests) or a signed webhook
 *     (a developer simulating the payment page with `signWebhook()`);
 *   - `getCapture` reports the amount the gateway holds, which a test can make
 *     DIFFERENT from what was asked (`settle(ref, 'captured', otherFils)`) to
 *     prove a partial capture funds nothing;
 *   - the webhook is HMAC-signed over the raw body and compared in constant
 *     time, exactly as providers/TEMPLATE.ts requires of a real one.
 *
 * Its state is per process, like the rest of the memory backend.
 */
export const MOCK_WEBHOOK_SECRET = 'mock-payments-webhook-secret-dev-only';
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

interface MockIntent { amountFils: number; status: Capture['status']; captureRef?: string }

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly intents = new Map<string, MockIntent>();

  async createIntent(input: CreateIntentInput): Promise<CreatedIntent> {
    if (!Number.isInteger(input.amountFils) || input.amountFils <= 0) {
      throw new Error(`mock gateway: amount must be positive integer fils, got ${input.amountFils}`);
    }
    const providerRef = `mock_${input.intentId}`;
    this.intents.set(providerRef, { amountFils: input.amountFils, status: 'pending' });
    return {
      providerRef,
      redirectUrl: `https://mock-gateway.invalid/pay/${providerRef}`,
      clientSecret: `mock_secret_${input.intentId}`,
    };
  }

  async getCapture(providerRef: string): Promise<Capture> {
    const i = this.intents.get(providerRef);
    // A reference the gateway never issued is not "pending": nothing is coming.
    if (!i) return { status: 'failed', amountFils: 0 };
    return { status: i.status, amountFils: i.amountFils, ...(i.captureRef ? { captureRef: i.captureRef } : {}) };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookEvent | null {
    const presented = headers[MOCK_SIGNATURE_HEADER];
    if (typeof presented !== 'string') return null;
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(this.signWebhook(rawBody), 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    let body: { providerRef?: unknown; status?: unknown };
    try { body = JSON.parse(rawBody) as typeof body; } catch { return null; }
    if (typeof body.providerRef !== 'string' || (body.status !== 'captured' && body.status !== 'failed')) return null;
    // The mock IS the gateway: a signed "captured" event is the gateway
    // capturing, so getCapture agrees with it afterwards.
    this.settle(body.providerRef, body.status);
    return { providerRef: body.providerRef, status: body.status };
  }

  // ---- the "gateway side", for tests and local development ----

  /** The gateway captured (or declined) this payment. `amountFils` overrides
   *  the captured amount — a partial capture, for the mismatch tests. */
  settle(providerRef: string, status: 'captured' | 'failed', amountFils?: number): void {
    const i = this.intents.get(providerRef);
    if (!i) return;
    i.status = status;
    if (amountFils !== undefined) i.amountFils = amountFils;
    if (status === 'captured') i.captureRef = `mockcap_${providerRef}`;
  }

  /** The signature a real gateway would put on `rawBody`. */
  signWebhook(rawBody: string): string {
    return createHmac('sha256', MOCK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  }
}
