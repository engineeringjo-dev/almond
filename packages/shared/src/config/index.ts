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
  // Hard ceiling on the stacked earn multiplier (loyalty/earn.ts applies it —
  // that is the only place). 5 = at most 5 × POINTS_PER_JOD × invoice = 25% of
  // the invoice in points. It is LIVE, not dead code: with BONUS_BEAN_DAY
  // enabled an activated bonus day reaches wallet 1.5 × bonus-day 2 ×
  // (1 + (tier 2.0 - 1) + weekday 0.5) = 7.5×, so the ceiling binds; with the
  // bonus day off the reachable stack is 3.75× and it does not.
  // NOTE: the ceiling does NOT cover COMBO_BONUS_POINTS — the combo is added
  // after it, as it always has been. Bringing the combo inside is D4, an offer
  // change gated on LOYALTY-EARN-PATCH §8.7, not a bug fix.
  // WARNING: this ceiling bounds POINTS ONLY. The spin wheel (spinDefaults.ts),
  // the cup (CUP_TARGET) and the subscription are separate givebacks with their
  // own costs. Total giveback ≈ 25% of an average TAX-INCLUSIVE invoice at the
  // lowest tier and ≈ 42% at the top — ≈ 29% / ≈ 49% restated on net revenue,
  // which is the basis the 65-75% gross margin is measured on. See
  // docs/LOYALTY-EARN-PATCH.md §2 D8 and §1.1. Nothing in the code sums them;
  // the design decision in §8 must.
  // Lowering it below the reachable stack changes the customer offer — do not
  // do it as a bug fix. See LOYALTY-EARN-PATCH §8.2. Admin-configurable.
  MAX_EARN_MULTIPLIER: 5,
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
  // Weekday earn bonus — an ADDITIVE fraction of the (wallet/bonus-day scaled)
  // base, keyed by weekday (0=Sun..6=Sat) IN AMMAN (see lib/ammanWeekday.ts,
  // LOYALTY-EARN-PATCH §3.6 — never the host clock). This replaces the
  // `getDay() === 5` literal that used to be hardcoded in BOTH bff/src/earn.ts
  // and loyalty.service.mock.ts. Jordan's weekend is Fri-Sat. Empty array = off.
  // Admin-configurable; changing it is a PRODUCT decision, not a deploy.
  // The assertion is `readonly` so this dial is frozen like every other one in
  // this object: earnRulesFromConfig() hands the SAME array through as
  // EarnRules.weekdayBonus, so a mutable type would let any caller rewrite the
  // weekday bonus for every subsequent grant in the process.
  WEEKDAY_EARN_BONUS: [
    { weekday: 5, rate: 0.5 }, // Friday +50% — the value that was hardcoded
  ] as readonly { readonly weekday: number; readonly rate: number }[],
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
  // "Almond Club" monthly subscription (Panera/Pret-style — proven to lift
  // repeat visits >200%). HARD daily cap avoids the margin bleed that forced
  // Pret off its unlimited model. Admin-configurable.
  SUBSCRIPTION: {
    enabled: true,
    priceJod: 18,
    drinksPerDay: 2, // hard cap per day
    periodDays: 30,
    labelAr: 'نادي ألموند',
    labelEn: 'Almond Club',
  },
  CUP_TARGET: 10,
  CUP_HEAD_START: 1,
  DEFAULT_PREP_MINUTES: 7, // section 7.3
  AVG_SPEED_KMH: 30, // simple travel-time estimate
  GEOFENCE_RADIUS_M: 1000, // section 14.2 (editable from admin)
} as const;
