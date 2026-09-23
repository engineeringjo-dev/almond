import { serviceUnavailable } from '../http-error';
import type { PaymentProvider } from './provider';

/**
 * The provider when none is configured: every call is an honest 503.
 *
 * It never pretends. A card checkout on a deployment with no gateway is
 * refused (402 before it gets here, or 503 here) — the wallet and cash keep
 * working, and nobody is shown a "paid" order that nothing charged.
 */
export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = 'unconfigured';

  private refuse(): never {
    throw serviceUnavailable(
      'payment_provider_unconfigured',
      'card payment is not available on this server (PAYMENT_PROVIDER is not set)',
    );
  }

  async createIntent(): Promise<never> { this.refuse(); }
  async getCapture(): Promise<never> { this.refuse(); }
  verifyWebhook(): never { this.refuse(); }
}
