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
  //
  // 2026-09-03, owner's decision: lowered 5 → 2.5, i.e. the ceiling moves from
  // 25% of the invoice to 12.5%. This is DELIBERATELY below the reachable stack,
  // so unlike before it actually binds:
  //   Bean, no wallet, weekday        1.00×  → unaffected
  //   Gold, wallet, Friday            3.75×  → CUT to 2.5× (18.75% → 12.5%)
  //   any tier, activated bonus day   7.50×  → CUT to 2.5×
  // It is a real reduction for the members who stack the most, not a bug fix,
  // and it ships with notice and in-app copy the way §8.3 requires — the
  // Dunkin' 2022 and Starbucks 2026 precedents in BRIEF §4 are exactly this.
  MAX_EARN_MULTIPLIER: 2.5,
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
  // The combo price discount is WITHDRAWN — the business stopped running it
  // (owner, 2026-09-04: "الكومبو راح من كل مكان"). Kept at 0 rather than
  // deleted so cart/totals.ts keeps its shape and `brunchDiscount` still
  // reports a line the UI can render if it ever comes back.
  BRUNCH_COMBO_DISCOUNT: 0,
  // The 50 points ARE the combo now, and the only combo reward. This is what
  // the app already advertises on the offers carousel and in the cart upsell —
  // "مشروب + طعام = 50 نقطة" — so code and promise finally agree.
  //
  // Both were live at once until 2026-09-04: totals.ts took 1.000 JOD off the
  // price AND earn.ts added 50 points (0.500 JOD), so a pair cost 1.500 JOD.
  // They also disagreed on what a pair IS — totals.ts counts the `isBrunch`
  // flag, combo.ts counts the item's category — so one basket could be priced
  // two ways. Only one side survives, and it is this one.
  //
  // WATCH THIS: combo points are added AFTER the ceiling (D4/§8.7 of
  // docs/LOYALTY-EARN-PATCH.md), so they are the one grant MAX_EARN_MULTIPLIER
  // does not bound. On a small pair — a 2.50 drink and a 1.90 cookie — 50
  // points is 11.4% of the bill on top of everything else.
  COMBO_BONUS_POINTS: 50,
  // "Almond Club" monthly subscription — CANCELLED before launch (owner,
  // 2026-09-03). It converts a member's own revenue into a smaller number:
  // a member buying 12 drinks/month brings 39.7 JOD against 5.2 JOD of material
  // cost (contribution 34.5). On 18 JOD for 30 drinks that becomes 18 against
  // 12.9 (contribution 5.1) — a loss of 29.4 JOD/month per EXISTING member, and
  // −7.8 contribution if they use the full 60-drink allowance.
  //
  // The daily cap does not protect it: 2/day permits 60/month, and the binding
  // cap would have to be monthly — Pret's cap was 5/day and it still failed.
  // It only wins on NEW members who attach food, and the basket says otherwise:
  // 1.8 items, drink as the anchor, 85% of revenue from drinks at 87% material
  // margin. Panera's version works because there the drink is the attachment to
  // a food business; here the drink IS the business.
  //
  // Kept configured rather than deleted so the numbers above stay attached to
  // the decision. Re-enabling needs a monthly cap and a food condition.
  SUBSCRIPTION: {
    enabled: false,
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
