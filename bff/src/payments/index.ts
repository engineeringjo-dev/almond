import { config } from '../config';
import { MockPaymentProvider } from './mock';
import { UnconfiguredPaymentProvider } from './unconfigured';
import type { PaymentProvider } from './provider';

export type { PaymentProvider, Capture, CreateIntentInput, CreatedIntent, WebhookEvent } from './provider';
export { UnconfiguredPaymentProvider } from './unconfigured';
export { MockPaymentProvider } from './mock';

/**
 * THE REGISTRY — the one place a real gateway is plugged in.
 *
 * To add one (Ishbek):
 *   1. copy providers/TEMPLATE.ts to providers/<name>.ts and implement it;
 *   2. add ONE line below:   <name>: () => new <Name>Provider(),
 *   3. set PAYMENT_PROVIDER=<name> and the provider's own env vars;
 *   4. point the gateway's webhook at  POST /v1/payments/webhook/<name>.
 *
 * `mock` is registered for development and tests. TEMPLATE is deliberately NOT
 * registered: it throws "not implemented" on every call.
 */
export const PAYMENT_PROVIDERS: Readonly<Record<string, () => PaymentProvider>> = {
  mock: () => new MockPaymentProvider(),
};

const UNCONFIGURED = new UnconfiguredPaymentProvider();
/** One instance per provider name for the life of the process — a gateway
 *  client holds connections and, for the mock, the "gateway's" own state. */
const instances = new Map<string, PaymentProvider>();

/**
 * The provider this request should use. Read from config on EVERY call, so an
 * operator's env and a test's config change both take effect without a
 * rebuild (the same posture as plugins/rateLimit.ts).
 *
 *   unset                        → unconfigured (503 on every call)
 *   a registered name            → that provider
 *   `mock` in a production process → unconfigured, whatever the boot check said
 *   anything else                → unconfigured (and providers.ts refuses to boot)
 */
export function paymentProvider(): PaymentProvider {
  const name = config.PAYMENT_PROVIDER;
  if (!name) return UNCONFIGURED;
  if (name === 'mock' && config.NODE_ENV === 'production') return UNCONFIGURED;
  const make = Object.hasOwn(PAYMENT_PROVIDERS, name) ? PAYMENT_PROVIDERS[name] : undefined;
  if (!make) return UNCONFIGURED;
  let p = instances.get(name);
  if (!p) { p = make(); instances.set(name, p); }
  return p;
}

/** A PAYMENT_PROVIDER value that names nothing registered — a typo that would
 *  otherwise silently switch card payment off. null when the value is fine. */
export function paymentProviderConfigError(name: string = config.PAYMENT_PROVIDER): string | null {
  if (!name || Object.hasOwn(PAYMENT_PROVIDERS, name)) return null;
  return `PAYMENT_PROVIDER "${name}" is not a registered provider (known: ${Object.keys(PAYMENT_PROVIDERS).join(', ')}) — register it in bff/src/payments/index.ts`;
}

/** Test-only: the mock instance the registry serves, so a test can play the
 *  gateway (settle a payment, sign a webhook). */
export function __mockPaymentProvider(): MockPaymentProvider {
  let p = instances.get('mock');
  if (!p) { p = PAYMENT_PROVIDERS.mock(); instances.set('mock', p); }
  return p as MockPaymentProvider;
}
