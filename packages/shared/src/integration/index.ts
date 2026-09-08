import { config } from '../config';

/**
 * Central Odoo / loyalty-server / POS integration map.
 *
 * NOTHING here is active while DATA_SOURCE === 'mock'. To go live later you only
 * need to: (1) set the base URLs + auth tokens (build-time env below),
 * (2) flip DATA_SOURCE to 'odoo' (or flip a single `enabled.*` flag to bring one
 * system online before the others), (3) implement the matching live service
 * methods against these endpoint paths. See docs/ODOO-INTEGRATION.md.
 */

// Build-time secrets (EXPO_PUBLIC_* are inlined by Expo). Empty under mock.
const env = (k: string): string => (process.env[k] ?? '').trim();

export const integration = {
  /**
   * Per-system switches. Each defaults to the global DATA_SOURCE but can be
   * turned on independently when only one Odoo system is ready first.
   */
  enabled: {
    loyalty: config.DATA_SOURCE === 'odoo', // beans earn / redeem / history
    wallet: config.DATA_SOURCE === 'odoo', // e-wallet top-up / charge / balance
    gift: config.DATA_SOURCE === 'odoo', // gift-card issue / redeem
    pos: config.DATA_SOURCE === 'odoo', // POS scan → earn/redeem/charge at till
    delivery: config.DATA_SOURCE === 'odoo', // Ishbek → Careem/Talabat last-mile
  },

  baseUrls: {
    odoo: config.ODOO_BASE_URL, // Odoo 19 REST / JSON-RPC
    loyalty: config.LOYALTY_BASE_URL, // standalone loyalty/wallet/gift server
    ishbek: config.ISHBEK_BASE_URL, // delivery aggregator (Careem + Talabat fleets)
  },

  auth: {
    odooApiKey: env('EXPO_PUBLIC_ODOO_API_KEY'),
    loyaltyToken: env('EXPO_PUBLIC_LOYALTY_TOKEN'),
    // Ishbek dispatch credential — SERVER-ONLY. Never a NEXT_PUBLIC_* var: those
    // are inlined into the browser bundle, which would leak the delivery key to
    // every user. On the web it is read from `ISHBEK_KEY` inside server route
    // handlers only (see almond-web/src/server/ishbek.ts). `EXPO_PUBLIC_*` stays
    // as a fallback for the app, which must dispatch via Odoo, not directly.
    ishbekKey: env('ISHBEK_KEY') || env('EXPO_PUBLIC_ISHBEK_KEY'),
    // HMAC secret used to verify inbound Ishbek status webhooks. Server-only.
    ishbekWebhookSecret: env('ISHBEK_WEBHOOK_SECRET'),
  },

  /** Endpoint paths, relative to the matching base URL. */
  endpoints: {
    // ---- Loyalty (beans) ----
    balance: (userId: string) => `/loyalty/balance/${userId}`,
    earn: '/loyalty/earn',
    redeemReward: '/loyalty/redeem-reward',
    history: (userId: string) => `/loyalty/history/${userId}`,
    vouchers: (userId: string) => `/loyalty/vouchers/${userId}`,

    // ---- E-wallet ----
    wallet: (userId: string) => `/loyalty/wallet/${userId}`,
    walletTopup: '/loyalty/wallet/topup',
    /** POS / in-app charge that deducts from the stored-value wallet. */
    walletCharge: '/loyalty/wallet/charge',

    // ---- Gift cards ----
    giftSend: '/loyalty/gifts/send',
    giftSent: (userId: string) => `/loyalty/gifts/sent/${userId}`,
    giftRedeem: '/loyalty/gifts/redeem',

    // ---- POS scan (earn + redeem + wallet charge at the till) ----
    /**
     * The member asks for a fresh, short-lived, single-use code to show at the
     * till. THE APP CALLS THIS, and it is the only way it can obtain a barcode:
     * the screen no longer knows how to build one (it used to render
     * `MEMBER|<userId>|MODE=…` out of data printed under the QR, which anyone
     * who saw a member id could forge and anyone with a photo could replay).
     *
     * This path is the BFF's real route (`bff/src/routes/pos.ts`), unlike most
     * of the `/loyalty/*` paths in this map, which were written against a
     * standalone loyalty server that does not exist — see the header of
     * almond-app/services/loyalty.service.live.ts. Its AUTH is still the open
     * item: the route authenticates the member by JWT subject and the app holds
     * no JWT (`stores/authStore.ts` has no token field), so under
     * DATA_SOURCE='odoo' today this returns 401 and the Pay screen shows its
     * failure state. That is the correct outcome, and it is why there is no
     * fallback: a member who cannot be authenticated must be looked up by the
     * cashier, not handed a code the server never signed.
     */
    posToken: '/v1/pos/token',
    /**
     * Server-to-server: Odoo POS posts the scanned member token + invoice here
     * so the loyalty server can earn beans / redeem a reward / charge the
     * wallet. The app does NOT call this — documented for the POS team. The
     * response carries `{memberId, mode}`: the member's pay-vs-earn choice
     * travels inside the signed token, because the barcode is opaque now.
     */
    posScan: '/pos/scan',
    /** App polls this after showing the barcode to confirm the till scanned it. */
    scanStatus: (userId: string) => `/loyalty/scan-status/${userId}`,

    // ---- Delivery (Ishbek → Careem / Talabat) ----
    /** Quote the delivery fee + ETA for a branch → address. */
    deliveryQuote: '/delivery/quote',
    /** Dispatch: assign a Careem/Talabat captain to pick up from the branch. */
    deliveryDispatch: '/delivery/dispatch',
    /** Live status for a dispatched delivery. */
    deliveryStatus: (orderId: string) => `/delivery/status/${orderId}`,
    /** Cancel a dispatch within the allowed window. */
    deliveryCancel: '/delivery/cancel',
  },
} as const;

/** Authorization header for the loyalty server (Bearer token). */
export function loyaltyAuthHeaders(): Record<string, string> {
  const tok = integration.auth.loyaltyToken;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

/** Authorization header for Odoo (API key). */
export function odooAuthHeaders(): Record<string, string> {
  const key = integration.auth.odooApiKey;
  return key ? { 'X-Odoo-Api-Key': key } : {};
}

/**
 * Authorization header for Ishbek (delivery bridge). SERVER-ONLY — only call
 * this from a server route handler, never a client component, or the key would
 * be bundled into the browser.
 */
export function ishbekAuthHeaders(): Record<string, string> {
  const key = integration.auth.ishbekKey;
  return key ? { 'X-Ishbek-Key': key } : {};
}
