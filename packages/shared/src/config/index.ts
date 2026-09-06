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
  //
  // THE ENTRY RATE. The ladder is 2% → 4% → 6%, expressed as this base rate
  // times the tier ramp in loyalty/constants.ts (1.0 / 2.0 / 3.0). The customer
  // is told "×2 then ×1.5"; the code stores the ramp against the base.
  //
  // 1 point = 1 qirsh exactly (measured on 10,621 live redemptions, median
  // 100.0000 points/JOD), so these ARE cashback percentages, not an abstract
  // currency. 2 pts/JOD = 2% back.
  //
  // Owner's design, 2026-09-06. It replaced a flat 5 for a reason that is
  // narrative, not financial: 2/4/6 accrues 21% less than a flat 5 but costs
  // almost the same cash (15,133 vs 15,503 JOD/yr), because it concentrates
  // points in the tier that redeems 87% while a flat rate scatters them into a
  // base that redeems 18% and never comes back. The ladders cost the same; only
  // one of them has a story. See docs/LOYALTY-TIERS-NEW.ar.md.
  //
  // WHAT THE RESEARCH SAYS ABOUT THIS NUMBER, so nobody re-derives it: at the
  // measured member basket the entry rung pays 0.123-0.131 JOD a visit, and the
  // median member's largest balance EVER held at 2% is 18.8 points (0.188 JOD).
  // The entry rate is not the thing that brings anyone back and must not be
  // asked to be. That job belongs to SECOND_VISIT_VOUCHER below.
  POINTS_PER_JOD: 2,
  POINTS_PER_JOD_REDEEM: 100, // 100 beans = 1 JOD
  // RETIRED 2026-09-06. Was 1.5 (pay from the wallet, earn +50%).
  //
  // Zero rows in 171,291 live transactions — it was never used by anyone. It
  // also collides head-on with the ladder's narrative: the only multiplier the
  // customer is shown must be the ×2 at promotion, and a second, invisible
  // multiplier both muddies that and pays twice on a dinar the customer already
  // handed over. Kept at 1.0 rather than deleted so earn.ts keeps its shape and
  // the decision stays attached to the number.
  WALLET_EARN_MULTIPLIER: 1.0,
  // Hard ceiling on the stacked earn multiplier — applied in loyalty/earn.ts,
  // which is the only place. `cap = total × POINTS_PER_JOD × MAX_EARN_MULTIPLIER`.
  //
  // 2026-09-06: this stopped being an OFFER DIAL and became a SAFETY VALVE.
  // With the wallet multiplier, the bonus day and the weekday bonus all retired,
  // the only thing left that stacks is the tier ramp itself, so the reachable
  // stack is exactly the top tier: 3.0 × base (= 6 pts/JOD on a 2 pts/JOD base).
  //
  // 🔴 DO NOT LOWER THIS BELOW 3.0. At 3.0 or less the ceiling silently trims
  // the 6% tier back toward the 4% tier and the ladder's whole promise breaks
  // with no error anywhere — the member is simply told 6% and paid less. T6 in
  // bff/test/earn.test.ts is what catches that. Raising it is harmless; it only
  // ever binds on a stack that no longer exists.
  //
  // NOTE: the ceiling does NOT cover COMBO_BONUS_POINTS — the combo is added
  // after it, as it always has been. Bringing the combo inside is D4, an offer
  // change gated on LOYALTY-EARN-PATCH §8.7, not a bug fix.
  MAX_EARN_MULTIPLIER: 3.5,
  // Digital reload bonus beans (pre-commitment lever, adapted from the SB ToU
  // "Digital Reload Bonus Stars"). Highest qualifying tier applies. Admin-set.
  WALLET_RELOAD_BONUS: [
    { minJOD: 20, bonusBeans: 50 },
    { minJOD: 35, bonusBeans: 120 },
  ] as { minJOD: number; bonusBeans: number }[],
  // RETIRED 2026-09-06. Was enabled with a Tuesday ×2.
  //
  // Zero rows in 171,291 live transactions. And it was never safe to run as
  // built: there is no server-side record of an activation, so `bonusDayActivated`
  // arriving from a device is self-crediting — which is why T7c pins every
  // server call site to `false`. Kept configured rather than deleted so those
  // invariants keep something to assert against.
  BONUS_BEAN_DAY: {
    enabled: false,
    multiplier: 2,
    weekdays: [2],
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
  // RETIRED 2026-09-06. Was [{ weekday: 5, rate: 0.5 }] — Friday +50%.
  //
  // Zero rows in 171,291 live transactions, and pointed the wrong way: Friday is
  // the week's volume TROUGH (index 83.2) and carries its HIGHEST basket (6.24
  // JOD). It paid the most where the customer needed it least. Empty = off; the
  // dial stays so the mechanism is one edit away if a real promotion wants it.
  WEEKDAY_EARN_BONUS: [
  ] as readonly { readonly weekday: number; readonly rate: number }[],
  // Gentle bean expiry (SB "Star expiration"): points stay active for this many
  // months after the last activity for the 2% and 4% rungs; the 6% rung never
  // expires (owner: "الأسود ما بينتهي"). Kept generous on purpose (§5 — never
  // punish the regular member).
  //
  // The liability lane recommends turning expiry OFF entirely: on Almond's own
  // vintage triangle a 12-month inactivity rule harvests ~557 JOD, because the
  // dormant balances sit with members who redeem 0.63% of what they earn. Not
  // worth the one angry customer. Left as-is because switching it off is an
  // offer decision; the number is recorded so it needs no re-derivation.
  BEAN_EXPIRY_MONTHS: 12,
  TAX_RATE: 0.16, // 16% (section 4.6)
  // The combo price discount is WITHDRAWN — the business stopped running it
  // (owner, 2026-09-04: "الكومبو راح من كل مكان"). Kept at 0 rather than
  // deleted so cart/totals.ts keeps its shape and `brunchDiscount` still
  // reports a line the UI can render if it ever comes back.
  BRUNCH_COMBO_DISCOUNT: 0,
  // The points ARE the combo now, and the only combo reward — the app already
  // advertises "مشروب + طعام" on the offers carousel and in the cart upsell.
  //
  // Both were live at once until 2026-09-04: totals.ts took 1.000 JOD off the
  // price AND earn.ts added 50 points (0.500 JOD), so a pair cost 1.500 JOD.
  // They also disagreed on what a pair IS — totals.ts counts the `isBrunch`
  // flag, combo.ts counts the item's category — so one basket could be priced
  // two ways. Only one side survives, and it is this one.
  //
  // 2026-09-06, owner: halved 50 → 25, "because the combo is already a discount".
  //
  // 🔴 TWO THINGS TO KNOW BEFORE TOUCHING THIS NUMBER.
  //
  // (1) It is the single largest uncertain line in the whole programme. At 25
  // points it models to ~6,411 JOD/yr of accrual — 29% of the total — and every
  // dinar of that rests on ONE assumption nobody has ever measured: that 35% of
  // identified invoices contain a drink+food pair. Nothing has ever observed it.
  // `pos_categ_ids` from an Odoo POS product export settles it in minutes, and
  // it is the highest-return unanswered question on the list. At 15% the line is
  // a third of what is modelled; at 55% it is half again as large.
  //
  // (2) Combo points are added AFTER the ceiling (D4/§8.7 of
  // docs/LOYALTY-EARN-PATCH.md), so they are the one grant MAX_EARN_MULTIPLIER
  // does not bound. On a small pair — a 2.50 drink and a 1.90 cookie — 25 points
  // is 5.7% of the bill on top of everything else.
  //
  // The mechanic-space panel recommended setting this to 0 outright, on the
  // ground that an unmeasured 35% assumption should not carry a 3,970 JOD/yr
  // cash line. That is an offer decision, not a code fix, so the owner's 25
  // stands until he says otherwise — but the recommendation is recorded here so
  // it is one edit away and nobody has to re-derive it.
  COMBO_BONUS_POINTS: 25,
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
  // ---- Tier qualification (loyalty/constants.ts holds the ramp itself) ----
  //
  // Qualifying spend is measured over a ROLLING 90-DAY WINDOW and re-evaluated
  // QUARTERLY. Both numbers are measured, not chosen:
  //   - 90 days over 30: at a 30-day window 66.8% of everyone holding tier 2+
  //     is demoted the following month, because even the top tier averages 2.67
  //     visits in 30 days — three data points, and noise decides. At 90 days it
  //     is 26.6%.
  //   - quarterly over monthly: cuts demotions per tier-holder per year from
  //     1.74 to 0.65 (−63%) at an identical tier mix and lower cost. 70-75% of
  //     all month-to-month tier movement is Poisson noise at ANY window length.
  //
  // There is no demotion. A member who does not requalify keeps the rate they
  // hold and simply is not issued that quarter's coupon — so nothing is ever
  // taken away and there is no loss event to notify. That is deliberate: 86.1%
  // of everyone who reaches tier 2+ would be demoted at least once under a
  // demoting design, and a demotion engine was priced at 1.05 JOD saved per
  // demotion against 17-21 engineer-days.
  //
  // ⚠ THE WINDOW IS NOT IMPLEMENTED HERE. `EarnContext.windowSpend` is supplied
  // by the caller, and both current callers still hand it a rolling-12-month or
  // an ever-accumulating figure (bff/src/backend/memory.ts `addSpend` never
  // rolls anything off — the same defect measured in the live programme, where
  // there were 3,906 promotions and zero demotions in 980 days). The bucket
  // engine that makes this real is Odoo gate 4; these constants are what it must
  // implement, and what the app should display in the meantime.
  TIER_WINDOW_DAYS: 90,
  TIER_EVALUATION: 'quarterly' as 'quarterly' | 'monthly',
  /** Alternative door to tier 2: "4 visits" is sayable, "20 JOD in 90 days" is
   *  not. At the measured member basket of 5.85 JOD the two are within a rounding
   *  error of each other, and the visits door costs ~0.16 JOD/member/90 days. */
  TIER2_VISITS_ALTERNATIVE: 4,

  // ---- The second visit ----
  //
  // The one mechanic aimed at Almond's largest single loss. Three independent
  // designers, briefed from deliberately opposed angles, converged on it.
  //
  // The measured hazard at the 1→2 step is 45.8%; every later step is 68-93%.
  // No earn rate can act there — a first-time member accrues 12 qirsh and a tier
  // is computed over a history they do not have. A named item on visit 2 can.
  //
  // The 30-day window is read off the data, not chosen: the median gap for
  // members who do return is 28 days, and 30 days captures 51.1% of all eventual
  // returners. One per member, ever — that is what bounds the downside.
  //
  // Costed at 921-1,600 JOD/yr against the ladder's 15,133, because the item is
  // paid IN KIND: a 1.90 JOD pastry at 79% margin costs 0.399 JOD of material and
  // reads as 1.90. Cashback has 1.0× leverage; food has 4.8× and a 92%-margin
  // sweet has 12.5×.
  //
  // 🔴 THE HONEST OBJECTION, recorded because no designer could answer it: about
  // half the spend goes to people who were returning anyway, and Almond's own
  // data says a first reward does not re-engage — measured within-member around
  // first redemption (n=1,238), visits −1.4% and spend −4.9% against a −2.3%
  // control, where the published literature reports +3% and +17.5%. Ship this
  // against the deterministic hash holdout in LOYALTY-ODOO-ARCHITECTURE §4.11 or
  // it cannot be told apart from doing nothing.
  SECOND_VISIT_VOUCHER: {
    enabled: true,
    windowDays: 30,
    /** Condition on buying a drink: it protects the margin (they still pay for
     *  the 3.50 drink) and cuts deadweight 25-51%. */
    requiresDrink: true,
    oncePerMember: true,
    labelAr: 'تانية علينا',
    labelEn: "The second one's on us",
  },

  // Points needed for the first reward a member can actually take.
  //
  // 138, not 40. The 40-point rung was reachable in 3 visits, which was the
  // wrong axis to optimise: it is 0.40 JOD, it buys nothing on a menu whose
  // cheapest item is 0.75, and it is 8.75× smaller than the 350-point median
  // reward members have chosen 10,632 times in the live data.
  //
  // The number comes from the only disclosed evidence on what members actually
  // pick: at Starbucks the most-taken reward is the WORST value per point on the
  // menu — chosen because it is fast and unrestricted — and it is worth 23.7% of
  // one ticket. 23.7% of Almond's 5.85 JOD member basket is 1.38 JOD = 138
  // points. A reward that arrives fast and underwhelms is worse than one that
  // takes longer and lands.
  //
  // At the 2% entry rate 138 points is ~11.8 visits, which is beyond the horizon
  // where the one-and-done loss happens — that is precisely why the entry job
  // belongs to SECOND_VISIT_VOUCHER above and not to a points rung.
  FIRST_REWARD_POINTS: 138,

  CUP_TARGET: 10,
  CUP_HEAD_START: 1,
  DEFAULT_PREP_MINUTES: 7, // section 7.3
  AVG_SPEED_KMH: 30, // simple travel-time estimate
  GEOFENCE_RADIUS_M: 1000, // section 14.2 (editable from admin)
} as const;
