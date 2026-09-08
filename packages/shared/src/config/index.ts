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
  // HOW LONG ONE GRANT OF POINTS LIVES, in CALENDAR months from the day it was
  // granted. Owner, verbatim: «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد وصرف
  // النقاط FIFO» — every point lives 12 months, a new purchase does NOT renew
  // it, and points are spent oldest-first. Asked whether the 6% rung keeps its
  // old exemption: «لا إعفاء — القاعدة للجميع».
  //
  // 🔴 THIS IS PER-LOT, NOT PER-ACCOUNT, and it REPLACED `BEAN_EXPIRY_MONTHS`.
  // The old dial drove an inactivity rule that zeroed the WHOLE balance after
  // 12 silent months, let any purchase reset the clock on everything, and
  // exempted the top rung. All of that is deleted (packages/shared/src/loyalty/
  // lots.ts is the replacement). The NAME changed deliberately: a surviving
  // BEAN_EXPIRY_MONTHS would tell the next reader the inactivity rule still
  // exists, and "bean" is vocabulary W4 already removed from every screen.
  //
  // THE PRICE LIST, measured over 160,935 live earn rows and 10,621 redemptions
  // with real FIFO lots, so nobody has to re-derive it:
  //
  //   lot life  | expires (of everything issued) | harvest/yr
  //   12 months |                          17.6% | 4,385 JOD
  //   18 months |                           9.3% | 2,319 JOD
  //   24 months |                           4.2% | 1,035 JOD
  //
  // against ~557 JOD/yr for the inactivity rule it replaces — 7.9× more — and
  // ~2,300 JOD/yr once scaled to the shipped 2/4/6 ladder (blended 3.63 against
  // the historical 6.884). 17.6% breakage also puts the programme inside the
  // published retail band (20-30%) instead of at zero, which is what IFRS 15
  // vintage accounting wants. Changing this number is an OFFER decision; it
  // applies only to grants made after the change, because every lot stores the
  // expiry day it was promised.
  POINT_LOT_LIFE_MONTHS: 12,
  // How long a DEAD lot's row is kept, for support and the breakage report.
  // It affects no number a member sees: a dead lot contributes 0 to every sum
  // the ledger computes from the moment it dies. At 90 days a member's array
  // holds at most 15 months of grants — ~5 rows at the measured median member
  // (1 visit / 90 days), ~55 at the p95.
  POINT_LOT_RETENTION_DAYS: 90,
  TAX_RATE: 0.16, // 16% (section 4.6)
  // The combo price discount is WITHDRAWN — the business stopped running it
  // (owner, 2026-09-04: "الكومبو راح من كل مكان"). Kept at 0 rather than
  // deleted so cart/totals.ts keeps its shape and `brunchDiscount` still
  // reports a line the UI can render if it ever comes back.
  BRUNCH_COMBO_DISCOUNT: 0,
  // The points ARE the combo — the whole offer, and the only combo reward.
  //
  // THERE IS NO PRICE DISCOUNT AND THERE NEVER WAS ONE HERE. The member pays
  // the full drink price AND the full food price; the 50 points are what they
  // get for pairing them (owner, 2026-09-06, correcting the record). The old
  // BRUNCH_COMBO_DISCOUNT below is 0 for exactly this reason.
  //
  // 🔴 THIS NUMBER WENT 50 → 25 → 50, AND THE ROUND TRIP IS THE POINT. It was
  // halved on the stated ground that "the combo is already a discount". It is
  // not, and the code already said so — BRUNCH_COMBO_DISCOUNT has been 0 since
  // 2026-09-04. The premise was wrong, so the halving is withdrawn rather than
  // re-argued. Do not re-halve it on that reasoning; if it is ever cut, it must
  // be for a reason that survives reading the line below it.
  //
  // WHAT IT COSTS, and the assumption the whole line stands on: at 50 points it
  // models to ~12,823 JOD/yr of accrual and ~18,351 JOD/yr all-in, against
  // ~18,999 for the programme it replaces. Every dinar of that rests on ONE
  // figure nobody has ever measured — that 35% of identified invoices contain a
  // drink+food pair. `pos_categ_ids` from an Odoo POS product export settles it
  // in minutes and it is the highest-return unanswered question on the list.
  //
  // ⚠ AND IT IS ABOUT TO MOVE. The offer is being surfaced on the offers page
  // (owner, 2026-09-06) precisely to raise that pair rate — which is the same
  // multiplier in the cost model. At 50% pairing the all-in figure is ~21,109
  // JOD/yr and at 65% it is ~23,867, i.e. MORE than the programme this replaces.
  // A per-invoice pair cap or a monthly readout of the real rate is the missing
  // control; neither exists yet, and this comment is where that gets noticed.
  //
  // Combo points are added AFTER the ceiling (D4/§8.7 of
  // docs/LOYALTY-EARN-PATCH.md), so they are the one grant
  // MAX_EARN_MULTIPLIER does not bound. On a small pair — a 2.50 drink and a
  // 1.90 cookie — 50 points is 11.4% of the bill on top of everything else.
  COMBO_BONUS_POINTS: 50,
  /**
   * The combo pays ONCE PER INVOICE, however many pairs the basket holds.
   *
   * Owner, 2026-09-08: «ما بدي طلب مكتب ولا اجتماع» — the offer is for a person
   * buying themselves a drink and something to eat, not for an office run.
   *
   * `comboPairs()` counts `min(drinks, foods)` and is uncapped by design; this
   * is where that count is bounded, so the counter stays a pure counter and the
   * offer decision stays one visible number. Before this, one basket of 15
   * drinks and 15 foods minted 15 x 50 = 750 points (7.50 JOD) on a single
   * invoice — and the person best placed to ring that up is an employee.
   */
  COMBO_MAX_PAIRS_PER_INVOICE: 1,
  /**
   * 🔴 DOES THE FLAT COMBO BONUS PAY ON A BILL SETTLED ENTIRELY WITH POINTS?
   *
   * Owner, 2026-09-08: «رح اعامل النقاط كنقود يستطيع استخدامها او الخصم من
   * فاتورته» — points are money off the bill — and «لا يكسب نقاط على الجزء
   * المدفوع بالنقاط»: the part paid with points earns nothing. The RATE obeys
   * that automatically (loyalty/earn.ts earns on the cash portion only, and a
   * bill paid in full with points has no cash portion).
   *
   * COMBO_BONUS_POINTS does not, because it is a FLAT grant that sits outside
   * every ceiling — see the comment above it. A 2.50 drink and a 1.90 pastry
   * paid for entirely out of a points balance would still collect 50 points.
   *
   * IT IS NOT A MINT, AND THE ARITHMETIC MATTERS HERE: the member spends 440
   * points on that 4.40 JOD pair and receives 50 back, so the balance falls to
   * 11.4% of itself each cycle and the loop terminates. What it does is inflate
   * the liability an existing balance eventually grants, by the geometric sum
   * P/(1 − 0.114) ≈ 1.129 P — i.e. up to ~12.9% more points than were ever
   * earned on a purchase, in the worst case where every single redemption is
   * exactly one combo pair paid entirely with points.
   *
   * `false` applies the owner's principle consistently: no reward on a portion
   * the member did not pay cash for. `true` is the generous side and costs the
   * number above. It is one line either way; the trade-off is written down here
   * so nobody has to re-derive it to flip it.
   */
  COMBO_BONUS_ON_POINTS_PAID_INVOICE: false,
  /**
   * 🔴 THE INVOICE CEILING. Points are earned on `min(invoice, this)`.
   *
   * This is not an offer dial and it is not there to trim a generous basket —
   * 100 JOD is roughly 12x the average paid invoice of 8.31, so no real
   * customer will ever meet it. It exists because the live programme had NO
   * such bound, and on 2025-06-23 at City Mall a single mis-keyed amount of
   * 7,085,718.64 JOD granted 28,342,875 points. That one row is 86.2% of every
   * point outstanding in the entire member table, and nobody noticed for over a
   * year: `amount_flag` fired on it, and 47 flagged rows over 2.9 years were
   * never reviewed by anyone.
   *
   * A fat finger at the till must cost a bounded amount. Owner, 2026-09-08.
   *
   * At the top rung this caps a single invoice at 100 x 6 = 600 points (6.00
   * JOD), plus the combo, which sits outside every ceiling.
   */
  MAX_EARNING_INVOICE_JOD: 100,
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
  // THE WINDOW IS IMPLEMENTED, in packages/shared/src/loyalty/window.ts, and
  // both callers go through it: the BFF stores a dated, pruned spend log and
  // the app's mock reads the same functions. Until 2026-09-08 neither did —
  // `EarnContext.windowSpend` was a rolling-12-month figure on the phone and an
  // ever-accumulating one on the server, because bff/src/backend/memory.ts's
  // `addSpend` was `m.windowSpend += jod` and never rolled anything off. That
  // is the SAME defect measured in the live programme, which produced 3,906
  // promotions and zero demotions in 980 days.
  //
  // The window is a range of AMMAN DAY KEYS, inclusive of today, not an epoch
  // delta: TIER2_VISITS_ALTERNATIVE below is denominated in distinct days, and
  // an epoch edge moves inside a single business day (see lib/ammanWeekday.ts).
  //
  // PROMOTION IS IMMEDIATE; the quarterly boundary is the requalification stamp
  // (Evaluation.requalified), not a rate gate. Both measured numbers above
  // argue about DEMOTIONS, and there is no demotion; nothing measured supports
  // deferring a promotion, which would cost the ladder its only sentence
  // ("... and your cashback DOUBLES") for ~0.20 JOD per promoted member.
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

  // ---- The control arm (LOYALTY-ODOO-ARCHITECTURE §4.11) ----
  //
  // The objection recorded above is not answerable from the data Almond has;
  // it is only answerable by withholding the mechanic from a slice of members
  // and comparing. `packages/shared/src/loyalty/holdout.ts` is the assignment;
  // this block is the only place its two dials live. They are HERE and not in
  // an env var because almond-app compiles packages/shared into the Expo
  // bundle: an env-var salt could never reach the phone, so the BFF, the app
  // and the future Odoo evaluator would each hold a different one and the same
  // member would be in different arms in different places. §4.11 also asks for
  // the salt change to be AUDITABLE — a reviewed git diff plus a red
  // golden-vector test is more auditable than an env var nobody sees. It is
  // safe to publish: member ids are server-minted `m_${randomUUID()}`
  // (bff/src/backend/memory.ts:49), so knowing the salt buys nobody a
  // treatment-arm id.
  //
  // 🔴 ROTATING THE SALT DESTROYS THE EXPERIMENT. Measured on a v1→v2 rotation
  // over 20,000 ids: 31.73% of members change arm, and EVERY HoldoutStamp
  // already written to an order becomes unreproducible — the analyst can no
  // longer tell which arm a past grant was made in. §4.11 requires the README
  // to say so in those words. If a rotation is genuinely intended, bump
  // `saltId` in the same commit and regenerate loyalty/holdout.vectors.json;
  // the stamps carry saltId so the old epoch stays readable as its own epoch.
  //
  // 🔴 THE ARM IS KEYED ON THE MEMBER ID, so Odoo cutover (`m_<uuid>` →
  // `res.partner.id`) re-randomises every arm. That is inherent to a scheme
  // that stores nothing, and it is why the arm is STAMPED on the order: the
  // stamps preserve the pre-cutover half of the analysis, and cutover is a new
  // experiment epoch with a new saltId, not a continuation of this one.
  HOLDOUT: {
    salt: 'almond-holdout-v1',
    /** Stamped on every assignment so a rotation is visible in the evidence
     *  instead of silently re-labelling it. Bump it WITH the salt, never after. */
    saltId: 'v1',
    /** Basis points (10000 = 100%) of members withheld from each experiment.
     *
     *  2000 bp = 20%. Measured power on the 45.8% 1→2 hazard (two-proportion,
     *  α=0.05, 80% power) at ~48.7 new members/day (47,720 members ÷ the
     *  980-day window): a +5pp readout takes 179 days at a 10% holdout, 101
     *  days at 20%, and 64 days at 50%. 10%→20% buys 78 days; 20%→50% buys
     *  only 37 more while withholding the voucher from half of all new
     *  members. The cost also runs BACKWARDS here — the voucher is paid in
     *  kind at 921-1,600 JOD/yr, so a 20% control arm SAVES 184-320 JOD/yr and
     *  the only thing it withholds is a benefit measured as unmeasured or
     *  negative (n=1,238: visits −1.4%, spend −4.9% against a −2.3% control).
     *
     *  Not the 10% in docs/LOYALTY-ODOO-MODULE.md:776: that figure is for a
     *  different experiment (suppressing earn entirely, denominated in 1,133
     *  member ORDERS/day); this one is denominated in enrolments. */
    holdoutShareBp: { secondVisitVoucher: 2000 } as Readonly<Record<string, number>>,
  },

  // ---- The till handshake (the QR the member shows at the counter) ----
  //
  // How long a minted POS token stays valid, in seconds. It lives HERE and not
  // only in bff/src/config.ts because two independent things need the same
  // number and neither may guess it:
  //   - the BFF mints with it (bff/src/pos/token.ts sets `exp = now + this`);
  //   - almond-app's MOCK loyalty service has to report the same `expiresIn`,
  //     or the phone's refresh cadence under DATA_SOURCE='mock' would be tuned
  //     against a number the server does not use.
  // The live app never reads this constant: it refreshes off the `expiresIn`
  // the server sends back with each token, so an operator who raises the TTL by
  // env var does not need a new app build. bff/src/config.ts reads this as its
  // default and still honours POS_TOKEN_TTL_SECONDS from the environment.
  //
  // 60 seconds is the whole security argument made concrete. The barcode this
  // replaced was `ALMOND|MEMBER|<userId>|MODE=PAY` — no signature, no expiry,
  // no single-use — so one camera phone pointed at a member's screen earned on
  // that member's account forever. A minute is longer than any real scan (the
  // measured till interaction is ~0.2 s of scanning plus 0.0-0.4 s of partner
  // resolution) and short enough that a photographed code is worthless before
  // the photographer has left the counter. It is also single-use: the jti is
  // burned on the first successful scan, so 60 seconds is the ceiling on a
  // window that normally closes in under a second.
  POS_TOKEN_TTL_SECONDS: 60,

  // 🪦 FIRST_REWARD_POINTS: 138 — DELETED 2026-09-08. There is no first reward.
  //
  // It was "the cheapest thing on the board a member may buy", derived from a
  // Starbucks menu: the most-taken Starbucks reward is worth 23.7% of one
  // ticket, and 23.7% of Almond's measured 5.85 JOD member basket is 1.38 JOD
  // = 138 points. Every part of that argument presumes a CATALOGUE — a shelf of
  // named things with prices, and therefore a cheapest one you have to save up
  // for. There is no shelf any more.
  //
  // Owner, 2026-09-08: «رح اعامل النقاط كنقود يستطيع استخدامها او الخصم من
  // فاتورته بعمل redeem لنقاطه. فهي تقلل الفاتورة او تعملها مجانية» — points are
  // money; redeeming them reduces the bill or makes it free. And on the board
  // itself: «مافي زبون حيشتري قهوة لوز» — nobody is going to buy almond milk.
  //
  // POINTS_PER_JOD_REDEEM (100 — 1 point = 1 qirsh exactly, measured on 10,621
  // live redemptions) is now the whole of the redemption rule. A balance is
  // worth what it is worth at any size; 1 point buys 1 qirsh off the bill, and
  // there is deliberately NO MINIMUM (the owner did not ask for one, and a floor
  // is the threshold coming back under another name). Do not reintroduce a
  // threshold constant here: the moment one exists, a screen will state it, and
  // the member is back to saving up for a thing instead of paying less.

  /**
   * The one-tap amounts on the redeem screen, in JOD.
   *
   * NOT A LADDER, AND NOT A THRESHOLD. Read the tombstone above before adding
   * to this list. A rung was a THING you had to save up for — it gated the
   * redemption, it had a name, and below the first one your points bought
   * nothing. These are the opposite: shortcuts past typing a number, on a
   * screen that always also offers "all of it" and accepts any amount the
   * balance covers. Deleting this array entirely would remove some taps and
   * change nothing a member is entitled to.
   *
   * They are JOD, not points, because that is the unit the member is spending —
   * the phone converts with pointsFromJod() and the value it shows comes back
   * through jodFromPoints(), so the two can never disagree.
   *
   * 1 / 2 / 5 sit at the shape of the real basket: the measured member basket
   * is 5.85 JOD (MEASURED_MEMBER_BASKET_JOD), so 1 is "a bit off this coffee",
   * 5 is "most of this order", and 2 is the middle nobody has to think about.
   */
  REDEEM_PRESET_JOD: [1, 2, 5],

  CUP_TARGET: 10,
  CUP_HEAD_START: 1,
  DEFAULT_PREP_MINUTES: 7, // section 7.3
  AVG_SPEED_KMH: 30, // simple travel-time estimate
  GEOFENCE_RADIUS_M: 1000, // section 14.2 (editable from admin)
} as const;
