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
    // Read on both runtimes (Expo inlines EXPO_PUBLIC_*, Next inlines NEXT_PUBLIC_*).
    ishbekKey: env('EXPO_PUBLIC_ISHBEK_KEY') || env('NEXT_PUBLIC_ISHBEK_KEY'),
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
     * Server-to-server: Odoo POS posts the scanned member token + invoice here
     * so the loyalty server can earn beans / redeem a reward / charge the
     * wallet. The app does NOT call this — documented for the POS team.
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
