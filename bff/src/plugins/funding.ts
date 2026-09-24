import { config } from '../config';

/**
 * MAY THIS PROCESS CREATE VALUE AGAINST A PAYMENT IT NEVER SAW?
 *
 * No route in the BFF captures a card, CliQ or cash payment — every such branch
 * says "a PSP would capture here (out of scope)". So a request that names one of
 * those methods is a request that has paid NOTHING, and three routes turned it
 * into money anyway:
 *
 *   POST /v1/wallet/topup           credited `amount` from the body, plus the
 *                                   reload bonus in points. `{"amount":5000}`
 *                                   was 5,000 JOD of spendable wallet.
 *   POST /v1/checkout               granted points (redeemable at the till via
 *                                   /v1/loyalty/redeem) and window spend (which
 *                                   buys a rung that is never taken away) on an
 *                                   order that was never paid for.
 *
 * Only the WALLET is funded server-side: debitWallet moves real stored value
 * before anything is granted. Everything else is allowed only where nothing is
 * real — a non-production process on the in-memory store, which is dev and the
 * test suite. A persistent store is real money whatever NODE_ENV says, so
 * DATABASE_URL closes this too: a staging box that forgot NODE_ENV=production
 * must not become a mint.
 *
 * When a PSP lands, the fix is a capture reference verified server-side on the
 * route (docs/LOYALTY-ODOO-ARCHITECTURE.md T30), not a change to this function.
 */
export function unfundedValueAllowed(): boolean {
  return config.NODE_ENV !== 'production' && !config.DATABASE_URL;
}
