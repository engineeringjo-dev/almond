/**
 * Single config switch (section 6.1).
 * Flip DATA_SOURCE to 'odoo' when the real API is ready — NOTHING else changes.
 */
export const config = {
  DATA_SOURCE: 'mock' as 'mock' | 'odoo',
  ODOO_BASE_URL: 'https://api.almond.jo/v1',
  LOYALTY_BASE_URL: 'https://loyalty.almond.jo',
  ISHBEK_BASE_URL: 'https://api.ishbek.com', // delivery bridge → Careem / Talabat
  DELIVERY_REDIRECT_URL: 'https://almondcoffeehouse.com/order',

  // Loyalty / pricing constants (section 2.4)
  POINTS_PER_JOD: 5,
  POINTS_PER_JOD_REDEEM: 100, // 100 beans = 1 JOD
  // Pay-from-wallet earns +50% beans (Wallet spec §1.2). Applied to the base
  // earn BEFORE the tier multiplier (tier stacks on top). Admin-configurable.
  WALLET_EARN_MULTIPLIER: 1.5,
  // Digital reload bonus beans (pre-commitment lever, adapted from the SB ToU
  // "Digital Reload Bonus Stars"). Highest qualifying tier applies. Admin-set.
  WALLET_RELOAD_BONUS: [
    { minJOD: 20, bonusBeans: 50 },
    { minJOD: 35, bonusBeans: 120 },
  ] as { minJOD: number; bonusBeans: number }[],
  // Activatable "Double Beans Day" promo (variable-reward lever, adapted from
  // SB "Double Star Day"). Admin sets which weekdays qualify (0=Sun..6=Sat) and
  // the multiplier; the member must Activate it to earn the bonus that day.
  BONUS_BEAN_DAY: {
    enabled: true,
    multiplier: 2,
    weekdays: [2], // one day/week (Tue) keeps the reward scarce; admin can change
    labelAr: 'يوم النقاط المضاعفة',
    labelEn: 'Double Points Day',
  },
  // Gentle bean expiry (SB "Star expiration"): beans stay active for this many
  // months after the last activity for Bean/Silver; Gold/Black never expire.
  // Kept generous on purpose (§5 — never punish the regular member).
  BEAN_EXPIRY_MONTHS: 12,
  TAX_RATE: 0.16, // 16% (section 4.6)
  BRUNCH_COMBO_DISCOUNT: 1.0, // -1.000 JOD (section 5) — superseded by COMBO_BONUS_POINTS
  // Drink + food combo: each drink paired with a food item earns the customer
  // 50 bonus points (= 0.5 JOD value at 100 points = 1 JOD). Bonus POINTS, not a
  // price discount. Admin-configurable.
  COMBO_BONUS_POINTS: 50,
  CUP_TARGET: 10,
  CUP_HEAD_START: 1,
  DEFAULT_PREP_MINUTES: 7, // section 7.3
  AVG_SPEED_KMH: 30, // simple travel-time estimate
  GEOFENCE_RADIUS_M: 1000, // section 14.2 (editable from admin)
} as const;
