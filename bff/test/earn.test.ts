import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import {
  computeEarn, earnedPoints, earnRulesFromConfig, jodFromPoints, type ComboBasket, type EarnRules,
} from '@almond/shared/loyalty/earn';
import { ammanWeekday } from '@almond/shared/lib/ammanWeekday';
import { computeTotals } from '@almond/shared/cart';
import { comboBasket, comboPairs } from '@almond/shared/lib/combo';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import type { CartItem } from '@almond/shared/types';
import * as bffEarn from '../src/earn';
import { reprice } from '../src/pricing';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import {
  REPO, ROOTS, EXT, collectSources, stripComments, type SourceFile,
} from './lib/sources';
import { signIn } from './lib/signIn';

/**
 * §7 of docs/LOYALTY-EARN-PATCH.md: T1-T10, T12 and T14. T11, T13 and T15 need
 * the app's own module resolution and live in almond-app/test/.
 *
 * READ THIS BEFORE CHANGING A NUMBER IN HERE.
 * D4 — moving the combo bonus INSIDE the ceiling — is an OFFER CHANGE gated on
 * §8.7 and is deliberately NOT shipped (see packages/shared/src/loyalty/earn.ts,
 * the comment above the ceiling). The combo is therefore still added AFTER the
 * cap, exactly as the pre-patch bff/src/earn.ts:21 did. T5, T5b and T6 are
 * written against THAT — the shipped semantics — and not against §7's literal
 * text, which assumes D4 is in. Each of the three says what it becomes when
 * §8.7 is decided. If a change to earn.ts makes them red, the change moved
 * money: gate it, do not edit the expectations.
 */

const MON = new Date('2026-09-07T10:00:00Z'); // Monday in Amman
const FRI = new Date('2026-09-11T10:00:00Z'); // Friday in Amman
const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday (BONUS_BEAN_DAY weekday)

/** Every dial the assertions below depend on, pinned as literals. A config
 *  edit changes exactly one test (the first), not the meaning of all of them. */
const RULES: EarnRules = {
  pointsPerJod: 5,
  // Deliberately NOT the shipped 100. Points are money now — the redeemed part
  // of a bill comes off before the rate — so this rate is inside the grant, and
  // a test suite that pinned it at 100 could not tell "reads the dial" from
  // "divides by a literal 100". At 10, one point is worth ten times what the
  // shipped rate makes it worth, and every expectation below moves if the
  // implementation stops reading the field.
  pointsPerJodRedeem: 10,
  // The OLD four-rung ramp, kept deliberately: these arithmetic tests exist to
  // prove the CALCULATION, and pinning a ramp that is no longer shipped is the
  // strongest possible statement that they do not depend on the current offer.
  // The shipped ladder is asserted separately, against SHIPPED.
  tierRamp: [
    { id: 'bean', threshold: 0, multiplier: 1.0 },
    { id: 'silver', threshold: 100, multiplier: 1.25 },
    { id: 'gold', threshold: 300, multiplier: 1.5 },
    { id: 'black', threshold: 750, multiplier: 2.0 },
  ],
  walletMultiplier: 1.5,
  // Deliberately NOT the shipped value — see SHIPPED below.
  maxEarnMultiplier: 5,
  comboBonusPoints: 50,
  // Deliberately NOT the shipped values: these arithmetic tests predate both
  // caps and must keep proving the calculation without them. 999 pairs and a
  // 1e9 JOD ceiling are "effectively unbounded" without being Infinity, which
  // the guards in computeEarn reject.
  comboMaxPairsPerInvoice: 999,
  comboBonusOnPointsPaidInvoice: false,
  maxEarningInvoiceJod: 1e9,
  weekdayBonus: [{ weekday: 5, rate: 0.5 }],
  bonusDay: { enabled: true, multiplier: 2, weekdays: [2] },
};

/** The dials as actually shipped. This is a WHOLLY different offer from
 *  RULES, not a one-value variation of it:
 *
 *    - the ladder is 2 / 4 / 6 points per JOD — a base of 2 with a 1.0/2.0/3.0
 *      ramp — qualifying on 20 and 65 JOD of 90-day spend;
 *    - the bonus day and the Friday bonus are RETIRED (zero rows in 171,291
 *      live transactions); the wallet multiplier was retired with them on
 *      2026-09-06 and REINSTATED at 1.5 on 2026-09-08 (the gift-card promise);
 *    - the ceiling is a safety valve at 4.5× — exactly the reachable stack
 *      (top rung 3.0 × wallet 1.5), so it trims nothing that can happen;
 *    - the combo is 50 points: the halving to 25 was withdrawn on 2026-09-06
 *      once the owner confirmed the pair carries NO price discount at all.
 *
 *  Combo points are still added AFTER the ceiling, so they remain the single
 *  grant MAX_EARN_MULTIPLIER does not bound — which is why the T6 matrix below
 *  still has to prove the escape rather than assume it. */
const SHIPPED: EarnRules = {
  pointsPerJod: 2,
  pointsPerJodRedeem: 100,
  tierRamp: [
    { id: 'base', threshold: 0, multiplier: 1.0 },
    { id: 'plus', threshold: 20, multiplier: 2.0 },
    { id: 'top', threshold: 65, multiplier: 3.0 },
  ],
  // 1.5 since 2026-09-08 — the gift-card promise «٥٠٪ رصيد نقاط اضافي عند
  // صرفها». It was 1.0 while the promotion was retired.
  walletMultiplier: 1.5,
  maxEarnMultiplier: 4.5,
  comboBonusPoints: 50,
  comboMaxPairsPerInvoice: 1,
  comboBonusOnPointsPaidInvoice: false,
  maxEarningInvoiceJod: 100,
  weekdayBonus: [],
  bonusDay: { enabled: false, multiplier: 2, weekdays: [2] },
};

/**
 * A real drink and a real food item, chosen by the SAME classifier `comboPairs`
 * uses. The literals here were `'mineral-water'` and `'cake-pop'` — Talabat ids
 * — and the Odoo pull renumbered everything to `p-<odooId>`, so `itemKind` fell
 * through to 'other' for both, `comboPairs` returned 0 where the test expected
 * 10, and a passing combo rule read as a broken one. Prices stay explicit
 * because the arithmetic below is the point; only the identity is derived.
 */
const COMBO_DRINK = menuItems.find((m) => itemKind(m.id) === 'drink')!;
const COMBO_FOOD = menuItems.find((m) => itemKind(m.id) === 'food')!;

/**
 * `n` drinks at `drink` JOD and `n` foods at `food` JOD, as the engine takes
 * them (EarnContext.combo). The bare pair COUNT the engine used to take was
 * deleted on 2026-09-24, when the pair started REPLACING its own regular points
 * — the engine now needs the pair's price to take it out of the base. The
 * defaults are the 2.50 drink + 1.90 cookie used throughout this file.
 */
const pairBasket = (n: number, drink = 2.5, food = 1.9): ComboBasket | undefined => (n > 0
  ? { drinks: [{ unitJod: drink, qty: n }], foods: [{ unitJod: food, qty: n }] }
  : undefined);

function cartLine(itemId: string, unitBasePrice: number, qty: number, isDrink: boolean): CartItem {
  return {
    lineId: `${itemId}__M`, itemId, nameAr: '', nameEn: '', emoji: '',
    sizeId: 'M', sizeNameAr: '', sizeNameEn: '',
    unitBasePrice, customizations: [], qty, isDrink,
  };
}

describe('earn: the dials the tests are written against', () => {
  it('earn: earnRulesFromConfig() still matches the pinned rule set', () => {
    // If this fails, a config value moved. Decide whether that was an offer
    // change (§8) before touching any other expectation in this file.
    expect(earnRulesFromConfig()).toEqual(SHIPPED);
  });

  it('earn: the shipped ladder is exactly 2 / 4 / 6 points per JOD', () => {
    // 1 point = 1 qirsh, so these ARE cashback percentages. If any of the three
    // numbers below moves, the customer-facing promise moved with it.
    const at = MON;
    expect(computeEarn({ total: 10, windowSpend: 0, at }, SHIPPED).points).toBe(20);   // 2%
    expect(computeEarn({ total: 10, windowSpend: 20, at }, SHIPPED).points).toBe(40);  // 4%
    expect(computeEarn({ total: 10, windowSpend: 65, at }, SHIPPED).points).toBe(60);  // 6%

    // The steps the member is told: "×2", then "×1.5".
    const ramp = SHIPPED.tierRamp;
    expect(ramp[1].multiplier / ramp[0].multiplier).toBe(2);
    expect(ramp[2].multiplier / ramp[1].multiplier).toBe(1.5);

    // Just below each threshold the member is still on the rung below — the
    // gate is `>=`, and an off-by-one here would hand out a rate nobody earned.
    expect(computeEarn({ total: 10, windowSpend: 19.99, at }, SHIPPED).tierId).toBe('base');
    expect(computeEarn({ total: 10, windowSpend: 64.99, at }, SHIPPED).tierId).toBe('plus');
  });

  it('earn: the ceiling no longer trims — the top-rung wallet payer is paid the nine', () => {
    // 🔴 THIS TEST REVERSED TWICE, AND BOTH REVERSALS ARE THE FINDING.
    //
    // It first asserted the ceiling was a safety valve that "must never bind on
    // a real input" — true while the wallet multiplier, the bonus day and the
    // Friday bonus were all retired: nothing stacked.
    //
    // Reinstating the wallet multiplier put a stack back, and on 2026-09-08 this
    // test was rewritten to assert the opposite: 6% × 1.5 = 9% nominal against a
    // 3.5 ceiling = 7%, so a top-rung member paying from the wallet was quietly
    // paid TWO PERCENTAGE POINTS LESS than the two dials promised. The test said
    // in its own comment that this "is a decision" waiting to be made.
    //
    // It was made the same day. Owner, on the gap: «لا نكذب على الناس» — pay the
    // nine. MAX_EARN_MULTIPLIER went 3.5 → 4.5, which is exactly the reachable
    // stack, so the ceiling now equals it and trims nothing.
    //
    // What this test guards NOW is that the nine actually arrives. If anyone
    // lowers the ceiling back under 4.5, the silent rate cut returns and this
    // fails.
    const topRung = Math.max(...SHIPPED.tierRamp.map((r) => r.multiplier));
    const nominal = topRung * SHIPPED.walletMultiplier;
    expect(nominal).toBe(SHIPPED.maxEarnMultiplier);   // the ceiling IS the stack

    const heaviest = {
      total: 10, windowSpend: 10_000, paidFromBalance: true, bonusDayActivated: true, at: FRI,
    };
    const r = computeEarn(heaviest, SHIPPED);
    // `capApplied` is `cappable > cap`, strict — equal is not trimmed.
    expect(r.capApplied).toBe(false);
    expect(r.effectiveMultiplier).toBe(SHIPPED.maxEarnMultiplier);
    expect(r.points).toBe(90);                       // 9%, the rate both dials promise
    expect(r.points).toBe(10 * SHIPPED.pointsPerJod * nominal);

    // Cash on the same rung is still the plain 6% — the cap only bites where
    // something actually stacks.
    const cash = computeEarn({ ...heaviest, paidFromBalance: false }, SHIPPED);
    expect(cash.capApplied).toBe(false);
    expect(cash.points).toBe(60);

    // 🔴 THE REGRESSION THIS TEST HAS ALWAYS EXISTED FOR. Lowering the ceiling
    // below the top rung does not raise an error anywhere — it silently pays
    // the 6% member less than 6% while the app goes on calling them the 6%
    // tier. Asserted on the CASH path, which the wallet stack no longer masks.
    const throttled = computeEarn(
      { ...heaviest, paidFromBalance: false },
      { ...SHIPPED, maxEarnMultiplier: 2.5 },
    );
    expect(throttled.capApplied).toBe(true);
    expect(throttled.points).toBe(50);          // 5%, not the 6% promised
    expect(throttled.points).toBeLessThan(cash.points);
  });

  it('earn: the reachable stack is 4.5× base (top rung × wallet) — 9 points per JOD, and the ceiling does not trim it', () => {
    // Pinned against the SHIPPED config (earnRulesFromConfig), not the SHIPPED
    // literal above, so a config edit that re-creates the silent rate cut fails
    // here by name. The wallet multiplier is LIVE; the old earn.ts comment that
    // called it retired and put the cap at 3.5× was wrong on both counts.
    const rules = earnRulesFromConfig();
    const topRung = Math.max(...rules.tierRamp.map((r) => r.multiplier));
    expect(topRung).toBe(3);
    expect(rules.walletMultiplier).toBe(1.5);
    expect(topRung * rules.walletMultiplier).toBe(4.5);
    expect(rules.maxEarnMultiplier).toBe(4.5);
    expect(config.MAX_EARN_MULTIPLIER).toBe(4.5);

    const topFromWallet = { total: 100, windowSpend: 65, paidFromBalance: true, at: MON };
    const r = computeEarn(topFromWallet, rules);
    expect(r.tierId).toBe('top');
    expect(r.base).toBe(200);                                 // 2 points/JOD
    expect(r.effectiveMultiplier).toBe(4.5);                  // 4.5× base…
    expect(r.points).toBe(900);                               // …= 9 points/JOD = 9%
    expect(r.cap).toBe(900);
    expect(r.capApplied).toBe(false);                         // equal is not trimmed

    // Lowering the cap below 4.5 — by even a hundredth — trims the nine
    // (100 JOD, so a hundredth of a multiplier is two whole points).
    const trimmed = computeEarn(topFromWallet, { ...rules, maxEarnMultiplier: 4.49 });
    expect(trimmed.capApplied).toBe(true);
    expect(trimmed.points).toBeLessThan(900);
    expect(trimmed.points).toBe(898);
  });

  it('earn: the combo is 50 points, and there is no price discount to go with it', () => {
    // Both were live at once until 2026-09-04 — totals.ts took 1.000 JOD off
    // the price AND earn.ts added 50 points on the same pair, so a pair cost
    // 1.500 JOD. Only the points survive.
    //
    // The dial then went 50 → 25 → 50. The halving was argued from "the combo
    // is already a discount"; it is not, and BRUNCH_COMBO_DISCOUNT below has
    // been 0 since the discount was withdrawn, so the premise was already false
    // in this file. The pair is full drink price + full food price + 50 points.
    //
    // These two assertions belong together: if BRUNCH_COMBO_DISCOUNT ever goes
    // back above 0 while this dial stays at 50, the double payment is back and
    // the "no discount" reasoning above silently stops being true.
    expect(earnRulesFromConfig().comboBonusPoints).toBe(50);
    expect(config.BRUNCH_COMBO_DISCOUNT).toBe(0);

    // ONCE PER INVOICE. Three pairs in one basket still pay one bonus — owner,
    // 2026-09-08, «ما بدي طلب مكتب ولا اجتماع». Uncapped, this basket paid 150
    // and a fifteen-pair order paid 750 (7.50 JOD) on a single invoice.
    expect(config.COMBO_MAX_PAIRS_PER_INVOICE).toBe(1);
    const three = computeEarn({ total: 13.2, combo: pairBasket(3), at: MON }, SHIPPED);
    expect(three.comboBonus).toBe(50);
    expect(three.comboPairsPaid).toBe(1);
    // ONE pair's units leave the regular base — the other two pairs' units
    // earn like any other line (owner, 2026-09-24).
    expect(three.comboExcludedJod).toBeCloseTo(4.4, 9);
    expect(three.earningTotal).toBeCloseTo(8.8, 9);
    // The counter is untouched — the cap lives in earn.ts, not in comboPairs().
    expect(computeEarn({ total: 10, combo: pairBasket(0), at: MON }, SHIPPED).comboBonus).toBe(0);
  });

  it('earn: the invoice ceiling bounds a mis-key at the till', () => {
    // 🔴 The live programme had no such bound. On 2025-06-23 at City Mall one
    // mis-keyed amount of 7,085,718.64 JOD granted 28,342,875 points — 86.2% of
    // every point outstanding in the member table, from a single row that
    // `amount_flag` did flag and nobody ever reviewed.
    expect(config.MAX_EARNING_INVOICE_JOD).toBe(100);

    const misKey = computeEarn({ total: 7_085_718.64, windowSpend: 10_000, at: MON }, SHIPPED);
    expect(misKey.invoiceCapApplied).toBe(true);
    expect(misKey.earningTotal).toBe(100);
    expect(misKey.points).toBe(600);            // 100 JOD at the 6% rung, and no more
    // What it would have been without the ceiling, for the record: 425,143,118.
    expect(misKey.points).toBeLessThan(1_000);

    // It does not bind on any real invoice — the average paid invoice is 8.31.
    const real = computeEarn({ total: 8.31, at: MON }, SHIPPED);
    expect(real.invoiceCapApplied).toBe(false);
    expect(real.earningTotal).toBe(8.31);

    // And it fails LOUDLY rather than defaulting: an unset ceiling used to make
    // `Math.min(total, undefined)` NaN, which propagated into the grant.
    expect(() => computeEarn({ total: 10, at: MON }, { ...SHIPPED, maxEarningInvoiceJod: undefined as unknown as number }))
      .toThrow(/maxEarningInvoiceJod/);
  });

  it('earn: the wallet multiplier is BACK, and the other two stay retired', () => {
    // 🔴 THIS TEST REVERSED ON 2026-09-08, AND THE REVERSAL IS THE POINT.
    //
    // It used to assert all three promotions were retired, on the evidence that
    // between them they fired in ZERO of 171,291 live transactions. That
    // evidence still stands for the bonus day and the weekday bonus, and they
    // are still off.
    //
    // The wallet multiplier is different now because the OFFER changed. The
    // owner is selling gift cards that «تعطي ٥٠٪ رصيد نقاط اضافي عند صرفها»,
    // and gift-card balance and top-up balance are one thing («نفس رصيد
    // الشحن»). The multiplier is the mechanism for that promise, so it is on
    // deliberately — and the reason it fired zero times before is that nothing
    // was ever sold on it.
    expect(config.WALLET_EARN_MULTIPLIER).toBe(1.5);
    expect(config.BONUS_BEAN_DAY.enabled).toBe(false);
    expect(config.WEEKDAY_EARN_BONUS).toEqual([]);

    // The two that ARE retired must be inert, not merely unset: the heaviest
    // input that could trigger them earns exactly the wallet-only rate.
    const walletOnly = computeEarn({ total: 10, windowSpend: 65, paidFromBalance: true, at: MON }, SHIPPED);
    const stacked = computeEarn(
      { total: 10, windowSpend: 65, paidFromBalance: true, bonusDayActivated: true, at: FRI },
      SHIPPED,
    );
    expect(stacked.points).toBe(walletOnly.points);
    expect(stacked.bonusDayBonus).toBe(0);
    expect(stacked.weekdayBonus).toBe(0);

    // ...and the wallet bonus is real money, so it is asserted as an OUTCOME,
    // not as a flag: paying from the wallet must actually pay more.
    const cash = computeEarn({ total: 10, windowSpend: 65, at: MON }, SHIPPED);
    expect(walletOnly.points).toBeGreaterThan(cash.points);
    expect(walletOnly.walletBonus).toBeGreaterThan(0);
  });

  it('earn: the top-rung wallet payer gets the full 6% × 1.5, ceiling and all', () => {
    // 🔴 THE CEILING WAS LOAD-BEARING AND IS NOT ANY MORE — deliberately. It
    // used to sit at 3.5 under a 4.5 stack and pay 7% against a 9% promise;
    // raised to 4.5 on 2026-09-08 so the promise and the payment are one number.
    // Anyone lowering the cap is cutting the top-rung wallet rate, and this test
    // is where they find out.
    const r = computeEarn({ total: 100, windowSpend: 65, paidFromBalance: true, at: MON }, SHIPPED);
    const topRung = SHIPPED.tierRamp[SHIPPED.tierRamp.length - 1].multiplier;
    const nominal = 100 * SHIPPED.pointsPerJod * topRung * SHIPPED.walletMultiplier; // 6% × 1.5
    const capped = 100 * SHIPPED.pointsPerJod * SHIPPED.maxEarnMultiplier;     // the ceiling
    expect(capped).toBe(nominal);          // the ceiling no longer sits under it
    expect(r.points).toBe(Math.round(nominal));
    expect(r.capApplied).toBe(false);
  });

  it('earn: combo points escape the ceiling — the one grant it does not bound', () => {
    // Not a bug to fix here: D4/§8.7 gates moving the combo inside the cap as an
    // offer change. This test exists so the escape is visible and measured
    // rather than discovered later. A 2.50 drink + a 1.90 cookie is 4.40 JOD.
    //
    // 50 points on a 4.40 JOD pair is 11.4% of the bill and nothing bounds it —
    // since 2026-09-24 INSTEAD of the pair's regular points (here: the whole
    // bill, so the regular grant and the cap are both 0).
    const r = computeEarn({ total: 4.4, combo: pairBasket(1), at: MON }, SHIPPED);
    expect(r.points).toBe(50);
    expect(r.points).toBeGreaterThan(Math.round(r.cap));
    expect(r.points - r.comboBonus).toBeLessThanOrEqual(Math.round(r.cap));
    expect(r.comboBonus / (4.4 * 100)).toBeCloseTo(0.1136, 3); // 11.4% of the bill
  });
});

// ---------------------------------------------------------------------------
// T33 — POINTS ARE MONEY: the earn is on the CASH portion of the bill.
//
// Owner, 2026-09-08: «رح اعامل النقاط كنقود يستطيع استخدامها او الخصم من فاتورته
// بعمل redeem لنقاطه. فهي تقلل الفاتورة او تعملها مجانية» — points are money and
// a redeem takes them off the bill, making it cheaper or free. And, asked
// whether a member earns on the part they paid with points: «لا يكسب نقاط على
// الجزء المدفوع بالنقاط» — no.
//
// Without this, points mint points. A 5 JOD bill settled with 3 JOD of points
// earning on 5 pays the member for money they never handed over; it is small at
// 2% but it never terminates, and 65.1% of live redemption days carried no cash
// transaction at all. Starbucks awards no stars on a redemption either.
// ---------------------------------------------------------------------------
describe('T33 earn: the redeemed portion of a bill earns nothing', () => {
  it('T33a a bill paid entirely with points earns nothing on the rate', () => {
    // 10 JOD, settled with 1000 points (= 10.00 JOD at 100 points/JOD).
    const free = computeEarn({ total: 10, pointsRedeemed: 1000, at: MON }, SHIPPED);
    expect(free.redeemedJod).toBe(10);
    expect(free.cashTotal).toBe(0);
    expect(free.earningTotal).toBe(0);
    expect(free.base).toBe(0);
    expect(free.points).toBe(0);
    expect(free.effectiveMultiplier).toBe(0);

    // ... at EVERY rung. The rate is a percentage of nothing, so the ladder
    // cannot rescue it — this is the loop the owner closed.
    for (const windowSpend of [0, 20, 65, 10_000]) {
      expect(computeEarn({ total: 10, pointsRedeemed: 1000, windowSpend, at: MON }, SHIPPED).points)
        .toBe(0);
    }
    // And the invoice is still on the record: §5b re-derives the grant from the
    // breakdown, and `total` alone no longer determines it.
    expect(free.total).toBe(10);
    expect(free.pointsRedeemed).toBe(1000);
  });

  it('T33b a partly-paid bill earns on the remainder, and on nothing else', () => {
    // THE OWNER'S OWN EXAMPLE: a 5 JOD bill settled with 3 JOD of points.
    const r = computeEarn({ total: 5, pointsRedeemed: 300, at: MON }, SHIPPED);
    expect(r.redeemedJod).toBe(3);
    expect(r.cashTotal).toBe(2);
    expect(r.points).toBe(4);                       // 2% of the 2 JOD of cash

    // It is EXACTLY the grant on a 2 JOD cash bill — the equivalence is the
    // whole rule, stated as an assertion rather than as arithmetic.
    expect(r.points).toBe(computeEarn({ total: 2, at: MON }, SHIPPED).points);
    // ... and it is not the grant on the 5 JOD invoice, which is what the code
    // paid before this change.
    expect(computeEarn({ total: 5, at: MON }, SHIPPED).points).toBe(10);
    expect(r.points).toBeLessThan(10);
  });

  it('T33c redeeming more than the bill can never produce a negative base', () => {
    // Over-redemption is the NORMAL case for "make it free": paying a bill to
    // exactly zero needs ceil(total x 100) points, which usually overshoots.
    const over = computeEarn({ total: 4, pointsRedeemed: 100_000, at: MON }, SHIPPED);
    expect(over.cashTotal).toBe(0);
    expect(over.base).toBe(0);
    expect(over.points).toBe(0);
    expect(over.points).toBeGreaterThanOrEqual(0);
    expect(over.cashTotal).toBeGreaterThanOrEqual(0);

    // A negative or fractional count cannot buy anything either: points are
    // whole and a redemption is never negative.
    expect(computeEarn({ total: 4, pointsRedeemed: -1000, at: MON }, SHIPPED).points)
      .toBe(computeEarn({ total: 4, at: MON }, SHIPPED).points);
    expect(computeEarn({ total: 4, pointsRedeemed: 250.9, at: MON }, SHIPPED).pointsRedeemed)
      .toBe(250);
  });

  it('T33d the redemption comes off BEFORE the invoice ceiling', () => {
    // 150 JOD invoice, 60 JOD of it paid with points, ceiling 100.
    //   redemption first (correct): min(150 - 60, 100) = 90 JOD earns.
    //   ceiling first (wrong):      min(150, 100) - 60 = 40 JOD earns.
    // The ceiling guards against a mis-key at the till; it is not an allowance
    // for a redemption to eat.
    const r = computeEarn({ total: 150, pointsRedeemed: 6000, at: MON }, SHIPPED);
    expect(r.cashTotal).toBe(90);
    expect(r.earningTotal).toBe(90);
    expect(r.invoiceCapApplied).toBe(false);
    expect(r.points).toBe(180);
    // The other order, spelled out so the failure is legible if it ever returns.
    expect(r.points).not.toBe(80);
  });

  it('T33e the ceiling still binds on the cash that is left', () => {
    // 200 JOD invoice, 50 JOD of points: 150 JOD of cash, clamped to 100.
    const r = computeEarn({ total: 200, pointsRedeemed: 5000, at: MON }, SHIPPED);
    expect(r.cashTotal).toBe(150);
    expect(r.earningTotal).toBe(100);
    expect(r.invoiceCapApplied).toBe(true);
    expect(r.points).toBe(200);

    // ... including on the mis-key the ceiling exists for. 6000 points is 60
    // JOD against 7,085,718.64: a redemption cannot lift the clamp.
    const misKey = computeEarn(
      { total: 7_085_718.64, pointsRedeemed: 6000, windowSpend: 10_000, at: MON }, SHIPPED,
    );
    expect(misKey.invoiceCapApplied).toBe(true);
    expect(misKey.earningTotal).toBe(100);
    expect(misKey.points).toBe(600);
  });

  it('T33f the points→JOD conversion is read off the rules, in one place', () => {
    // Same 50 points, two rule sets. At RULES (10 points/JOD) they are worth
    // 5 JOD; at SHIPPED (100 points/JOD) they are worth 0.50. An implementation
    // that divided by a literal 100 would give the same answer twice.
    const cheap = computeEarn({ total: 10, pointsRedeemed: 50, at: MON }, RULES);
    expect(cheap.redeemedJod).toBe(5);
    expect(cheap.cashTotal).toBe(5);
    expect(cheap.points).toBe(25);                  // 5 JOD x 5 points/JOD

    const shipped = computeEarn({ total: 10, pointsRedeemed: 50, at: MON }, SHIPPED);
    expect(shipped.redeemedJod).toBe(0.5);
    expect(shipped.points).toBe(19);                // 9.50 JOD x 2 points/JOD

    // The exported conversion is the SAME one, so POST /v1/loyalty/redeem hands
    // the member the number the earn will later charge against.
    expect(jodFromPoints(50, RULES)).toBe(cheap.redeemedJod);
    expect(jodFromPoints(50, SHIPPED)).toBe(shipped.redeemedJod);
    expect(jodFromPoints(100)).toBe(1);             // config: 100 points = 1 JOD
  });

  it('T33g the flat combo bonus does not pay on a bill settled entirely with points', () => {
    // The rate needs no rule here — a percentage of zero cash is zero — but
    // COMBO_BONUS_POINTS is 50 FLAT and sits outside every ceiling, so a pair
    // bought with points alone would still collect it.
    const ctx = { total: 4.4, combo: pairBasket(1), pointsRedeemed: 440, at: MON };
    const withheld = computeEarn(ctx, SHIPPED);
    expect(withheld.cashTotal).toBe(0);
    expect(withheld.comboSuppressedByRedemption).toBe(true);
    expect(withheld.comboPairsPaid).toBe(0);
    expect(withheld.comboBonus).toBe(0);
    expect(withheld.points).toBe(0);

    // THE DIAL, and the cost of the other side. It is one boolean, and it is
    // the generous reading: the member spends 440 points on the pair and gets
    // 50 back, so a balance falls to 11.4% of itself each cycle — bounded, but
    // it inflates what an existing balance eventually grants by ~12.9%.
    const generous = computeEarn(ctx, { ...SHIPPED, comboBonusOnPointsPaidInvoice: true });
    expect(generous.comboSuppressedByRedemption).toBe(false);
    expect(generous.comboBonus).toBe(50);
    expect(generous.points).toBe(50);
    // …and a withheld bonus takes nothing out of the base: a pair that is not
    // paid the combo keeps earning like any other line.
    expect(withheld.comboExcludedJod).toBe(0);
    expect(generous.comboBonus / (4.4 * config.POINTS_PER_JOD_REDEEM)).toBeCloseTo(0.1136, 3);
  });

  it('T33h a partly-paid bill still pays the combo — the rule is about a FREE bill', () => {
    // 4.40 JOD with 4.00 of points: 0.40 of cash is still cash.
    const r = computeEarn({ total: 4.4, combo: pairBasket(1), pointsRedeemed: 400, at: MON }, SHIPPED);
    expect(r.comboSuppressedByRedemption).toBe(false);
    expect(r.comboBonus).toBe(50);
    // The pair IS the whole bill, so it earns its 50 and nothing regular —
    // the 0.40 of cash paid for the pair (it was 51 while the combo sat on top).
    expect(r.points).toBe(50);
  });

  it('T33i a genuinely free invoice is unchanged — the test is the REDEMPTION', () => {
    // A 0 JOD basket (comped, staff, a fully-discounted line) has no redemption
    // behind it. Its behaviour is deliberately untouched, which is why the
    // suppression tests `redeemedJod > 0 && cashTotal === 0` and not
    // `cashTotal === 0`. T6's grid asserts this case at every weekday.
    const free = computeEarn({ total: 0, combo: pairBasket(1, 0, 0), at: MON }, SHIPPED);
    expect(free.comboSuppressedByRedemption).toBe(false);
    expect(free.comboBonus).toBe(50);
    expect(free.points).toBe(50);
  });

  it('T33j a nonsensical redemption rate fails loudly instead of zeroing the grant', () => {
    // A rate of 0 makes every redemption worth Infinity JOD, so cashTotal is 0
    // and EVERY member silently earns nothing — the same shape as the NaN the
    // invoice-ceiling guard exists to prevent.
    for (const bad of [0, -100, Number.NaN, undefined as unknown as number]) {
      expect(() => computeEarn({ total: 10, at: MON }, { ...SHIPPED, pointsPerJodRedeem: bad }))
        .toThrow(/pointsPerJodRedeem/);
      expect(() => jodFromPoints(100, { ...SHIPPED, pointsPerJodRedeem: bad }))
        .toThrow(/pointsPerJodRedeem/);
    }
  });

  it('T33k an absent redemption means zero — every existing call site is unmoved', () => {
    // The field is optional and defaults to nothing, exactly as heldRungId did.
    const omitted = computeEarn({ total: 10, windowSpend: 65, combo: pairBasket(1), at: MON }, SHIPPED);
    const explicitZero = computeEarn(
      { total: 10, windowSpend: 65, combo: pairBasket(1), pointsRedeemed: 0, at: MON }, SHIPPED,
    );
    expect(omitted).toEqual(explicitZero);
    expect(omitted.pointsRedeemed).toBe(0);
    expect(omitted.redeemedJod).toBe(0);
    expect(omitted.cashTotal).toBe(omitted.total);
    // Everything but the combo pair — which earns its 50 instead.
    expect(omitted.earningTotal).toBeCloseTo(omitted.total - omitted.comboExcludedJod, 9);
  });

  it('T33l no redemption can ever RAISE a grant, and none escapes the ceiling', () => {
    // The monotonicity is the property that makes this safe to expose on the
    // wire later: a caller cannot buy points by claiming a redemption.
    const REDEEMED = [0, 1, 250, 1000, 100_000];
    for (const total of [0, 4.4, 8.31, 20.3, 150]) {
      for (const pairs of [0, 1]) {
        for (const windowSpend of [0, 65]) {
          let previous = Number.POSITIVE_INFINITY;
          for (const pointsRedeemed of REDEEMED) {
            const r = computeEarn(
              { total, pointsRedeemed, combo: pairBasket(pairs), windowSpend, at: MON }, SHIPPED,
            );
            const where = JSON.stringify({ total, pointsRedeemed, pairs, windowSpend });
            expect(r.points, where).toBeGreaterThanOrEqual(0);
            expect(r.cashTotal, where).toBeGreaterThanOrEqual(0);
            expect(r.cashTotal, where).toBeLessThanOrEqual(total);
            expect(r.earningTotal, where).toBeLessThanOrEqual(SHIPPED.maxEarningInvoiceJod);
            // The ceiling invariant of T6, still holding under redemption.
            expect(r.points - r.comboBonus, where).toBeLessThanOrEqual(Math.round(r.cap));
            expect(r.points, where).toBeLessThanOrEqual(previous);
            previous = r.points;
          }
        }
      }
    }
  });

  it('T33m checkout states what was redeemed on the order, explicitly', () => {
    // The VALUE is not pinned here — unlike bonusDayActivated, which may only
    // ever be false, a real redemption rail SHOULD put a real number on this
    // line. What is pinned is that the field is stated at all, so that when
    // /v1/checkout learns to take points off a bill the grant cannot silently
    // keep earning on the full invoice. It is 0 today because the two rails are
    // separate: POST /v1/loyalty/redeem spends points against no order id.
    const src = readFileSync(join(REPO, 'bff/src/routes/checkout.ts'), 'utf8');
    expect(src).toMatch(/pointsRedeemed:/);
  });
});

describe('earn: the arithmetic (T1-T4)', () => {
  it('T1 earn: base rate is 5 points per JOD (1 point = 1 qirsh)', () => {
    expect(computeEarn({ total: 10, at: MON }, RULES).points).toBe(50);
  });

  it('T2 earn: paying from the wallet adds +50% of base', () => {
    expect(computeEarn({ total: 10, paidFromBalance: true, at: MON }, RULES).points).toBe(75);
  });

  it('T3 earn: the tier multiplier comes from rolling-window spend', () => {
    const black = computeEarn({ total: 10, windowSpend: 750, at: MON }, RULES);
    expect(black.tierId).toBe('black');
    expect(black.points).toBe(100);
    expect(computeEarn({ total: 10, windowSpend: 99, at: MON }, RULES).tierId).toBe('bean');
  });

  it('T4 earn: the weekday bonus is read from config, not from getDay()', () => {
    // This is the test that would have made D3 impossible.
    const off: EarnRules = { ...RULES, weekdayBonus: [] };
    expect(computeEarn({ total: 10, at: FRI }, off).points).toBe(50);

    const on: EarnRules = { ...RULES, weekdayBonus: [{ weekday: 5, rate: 0.5 }] };
    expect(computeEarn({ total: 10, at: FRI }, on).points).toBe(75);
    expect(computeEarn({ total: 10, at: MON }, on).points).toBe(50);
  });

  it('earn: earnedPoints() is computeEarn().points and nothing else', () => {
    const ctx = { total: 7.2, windowSpend: 300, paidFromBalance: true, combo: pairBasket(2, 1, 1), at: FRI };
    expect(earnedPoints(ctx, RULES)).toBe(computeEarn(ctx, RULES).points);
  });
});

describe('earn: the combo REPLACES the pair\'s regular points (owner, 2026-09-24) — TC', () => {
  it('TC1 🔴 the pair\'s two lines contribute NO regular points; every other line earns exactly as before', () => {
    // A 2.50 latte, a 1.90 cookie — the pair — and a 6.00 cake on the side.
    const withPair = computeEarn({
      total: 10.4,
      combo: { drinks: [{ unitJod: 2.5, qty: 1 }], foods: [{ unitJod: 1.9, qty: 1 }, { unitJod: 6, qty: 1 }] },
      at: MON,
    }, SHIPPED);
    // The same invoice WITHOUT the pair's two lines, and no combo at all.
    const restAlone = computeEarn({ total: 6, at: MON }, SHIPPED);
    expect(withPair.comboExcludedJod).toBeCloseTo(4.4, 9);
    expect(withPair.earningTotal).toBeCloseTo(6, 9);
    // Regular points = the cake's, to the point — the latte and the cookie add
    // nothing on top of the flat 50.
    expect(withPair.points - withPair.comboBonus).toBe(restAlone.points);
    expect(withPair.points).toBe(restAlone.points + SHIPPED.comboBonusPoints);
    // And at every rung and wallet stack — the multipliers apply to the rest only.
    for (const windowSpend of [0, 20, 65]) {
      for (const paidFromBalance of [false, true]) {
        const ctx = { windowSpend, paidFromBalance, at: MON };
        const a = computeEarn({ ...ctx, total: 10.4, combo: { drinks: [{ unitJod: 2.5, qty: 1 }], foods: [{ unitJod: 1.9, qty: 1 }, { unitJod: 6, qty: 1 }] } }, SHIPPED);
        const b = computeEarn({ ...ctx, total: 6 }, SHIPPED);
        expect(a.points, JSON.stringify(ctx)).toBe(b.points + 50);
      }
    }
  });

  it('TC2 🔴 the pair is the CHEAPEST drink unit + the CHEAPEST food unit — the fewest regular points removed', () => {
    // Two drinks (4.00, 2.00) and two foods (3.00, 1.00), in a deliberately
    // unhelpful order. The customer-favourable pair is 2.00 + 1.00.
    const r = computeEarn({
      total: 10,
      combo: {
        drinks: [{ unitJod: 4, qty: 1 }, { unitJod: 2, qty: 1 }],
        foods: [{ unitJod: 3, qty: 1 }, { unitJod: 1, qty: 1 }],
      },
      windowSpend: 65, at: MON,
    }, SHIPPED);
    expect(r.comboExcludedJod).toBe(3);
    expect(r.earningTotal).toBe(7);
    // …which is the best the member could have been given: every other pairing
    // leaves fewer regular points.
    for (const [d, f] of [[4, 3], [4, 1], [2, 3]]) {
      const alt = computeEarn({ total: 10 - d - f, windowSpend: 65, at: MON }, SHIPPED).points + 50;
      expect(r.points, `${d}+${f}`).toBeGreaterThanOrEqual(alt);
    }
    // A line of two units is one unit of the pair plus one ordinary unit.
    const two = computeEarn({
      total: 6.9, combo: { drinks: [{ unitJod: 2.5, qty: 2 }], foods: [{ unitJod: 1.9, qty: 1 }] }, at: MON,
    }, SHIPPED);
    expect(two.comboExcludedJod).toBeCloseTo(4.4, 9);
    expect(two.points).toBe(computeEarn({ total: 2.5, at: MON }, SHIPPED).points + 50);
  });

  it('TC3 no pair, or a retired offer, removes nothing — the pair then earns like any line', () => {
    const drinksOnly = computeEarn({ total: 5, combo: { drinks: [{ unitJod: 2.5, qty: 2 }], foods: [] }, at: MON }, SHIPPED);
    expect(drinksOnly.comboExcludedJod).toBe(0);
    expect(drinksOnly.points).toBe(computeEarn({ total: 5, at: MON }, SHIPPED).points);
    // COMBO_BONUS_POINTS = 0 is how the offer is retired: then the pair must
    // keep its regular points, or retiring it would cut everyone's cashback.
    const retired = computeEarn({ total: 4.4, combo: pairBasket(1), at: MON }, { ...SHIPPED, comboBonusPoints: 0 });
    expect(retired.comboPairsPaid).toBe(0);
    expect(retired.comboExcludedJod).toBe(0);
    expect(retired.points).toBe(computeEarn({ total: 4.4, at: MON }, SHIPPED).points);
  });

  it('TC4 a discounted invoice takes the pair out at its DISCOUNTED share (comboBasket scales by total/subtotal)', () => {
    const cart = [cartLine(COMBO_DRINK.id, 2.5, 1, true), cartLine(COMBO_FOOD.id, 1.5, 1, false), cartLine(COMBO_FOOD.id, 6, 1, false)];
    const half = computeTotals(cart, computeTotals(cart, 0).subtotal / 2).total;   // a 50% standing discount
    const combo = comboBasket(cart, half);
    expect(combo.drinks[0].unitJod).toBeCloseTo(1.25, 9);
    const r = computeEarn({ total: half, combo, at: MON }, SHIPPED);
    expect(r.comboExcludedJod).toBeCloseTo(2, 9);          // (2.50 + 1.50) / 2
    expect(r.earningTotal).toBeCloseTo(3, 9);              // the cake's half
  });
});

describe('earn: the ceiling (D1) and where the combo sits (D4) — T5, T5b', () => {
  it('T5 earn: the combo REPLACES the pair\'s regular points; the rest earns, capped as ever', () => {
    // §4 D4 secondary example, priced through computeTotals so the tax basis
    // (§1.1) cannot drift. Prices INCLUDE the 8% tax, as at the till, so a
    // 17.50 basket is a 17.50 invoice (it was 20.30 while 16% was added on top).
    const cart = [
      cartLine(COMBO_DRINK.id, 0.75, 10, true),
      cartLine(COMBO_FOOD.id, 1.0, 10, false),
    ];
    const invoice = computeTotals(cart, 0).total;
    expect(invoice).toBeCloseTo(17.5, 6);
    expect(comboPairs(cart)).toBe(10);
    const combo = comboBasket(cart, invoice);

    // 🔴 OWNER, 2026-09-24: the pair's units earn NO regular points; the
    // invoice gets the combo instead. Under RULES (pairs uncapped) all twenty
    // units are paired, so there is nothing left to earn a rate on: 10 × 50.
    // Before the change this was 588 — the 500 ON TOP of 88 regular points.
    const r = computeEarn({ total: invoice, combo, at: MON }, RULES);
    expect(r.comboBonus).toBe(500);
    expect(r.comboExcludedJod).toBeCloseTo(17.5, 9);
    expect(r.earningTotal).toBe(0);
    expect(r.cap).toBe(0);
    expect(r.points).toBe(500);
    // The combo is still OUTSIDE the ceiling (D4 not in — §8.7).
    expect(r.points).toBeGreaterThan(r.cap);
    expect(r.capApplied).toBe(false);

    // SHIPPED: ONE pair per invoice — the cheapest drink (0.75) and the
    // cheapest food (1.00) leave the base; the other 18 units earn the entry
    // rate: 15.75 × 2 = 31.5 → 32, plus 50.
    const shipped = computeEarn({ total: invoice, combo, at: MON }, SHIPPED);
    expect(shipped.comboPairsPaid).toBe(1);
    expect(shipped.comboExcludedJod).toBeCloseTo(1.75, 9);
    expect(shipped.earningTotal).toBeCloseTo(15.75, 9);
    expect(shipped.points).toBe(32 + 50);
    // WHEN §8.7 SHIPS D4 the combo moves inside the cap; the exclusion stays.
  });

  it('T5b earn: a zero-priced food item still pays the full combo — and removes only what it cost', () => {
    // §4 D4 primary example: 10 x mineral water + 10 x a ZERO-priced Mother's
    // Day cake ⇒ subtotal 7.50, invoice 7.50 (tax is inside the price).
    const cart = [
      cartLine(COMBO_DRINK.id, 0.75, 10, true),
      // The zero price is supplied HERE, by the fixture — it is the point of the
      // test. The identity is derived because 'mother-s-day-coffee-cake' was a
      // Talabat id; and note the Odoo pull now refuses to ship any item whose
      // cheapest complete configuration is 0.000, so no such menu row exists to
      // point at any more. A zero-priced LINE is still reachable (a voucher, a
      // staff item) and still mints combo points, which is what §8.7 is about.
      cartLine(COMBO_FOOD.id, 0, 10, false),
    ];
    const invoice = computeTotals(cart, 0).total;
    expect(invoice).toBeCloseTo(7.5, 6);
    expect(comboPairs(cart)).toBe(10);

    // Every pair's drink leaves the base (the food cost nothing), so the bill
    // earns only its combo: 500 points on a 7.50 JOD invoice = 66.7% of it.
    const r = computeEarn({ total: invoice, combo: comboBasket(cart, invoice), at: MON }, RULES);
    expect(r.comboBonus).toBe(500);
    expect(r.comboExcludedJod).toBeCloseTo(7.5, 9);
    expect(r.points).toBe(500);
    expect(r.points / config.POINTS_PER_JOD_REDEEM / r.total).toBeCloseTo(0.667, 3);
    // THE EXPOSURE, stated as an assertion so it cannot be forgotten: the flat
    // 50-points-per-pair combo is outside the ceiling by all 500 points here.
    expect(r.points - Math.round(r.cap)).toBe(500);

    // Assert against r.cap, never a hand-computed literal. §7 T5b predicts 217
    // because it evaluates `8.7 * 25`, which IS 217.49999999999997 in IEEE-754.
    // computeEarn does not associate it that way: base = 8.7 * 5 = 43.5 (exact
    // in binary), then cap = 43.5 * 5 = 217.5 (exact), which rounds to 218.
    const plain = computeEarn({ total: 8.7, at: MON }, RULES);
    expect(8.7 * 25).toBe(217.49999999999997);
    expect(plain.cap).toBe(217.5);
    expect(Math.round(plain.cap)).toBe(218);
    // WHEN §8.7 SHIPS D4 the combo becomes capped too.
  });

  it('D1 earn: the ceiling is LIVE — it binds on an activated bonus day', () => {
    // The reachable stack on a bonus day is wallet 1.5 x bonus-day 2 x
    // (1 + (tier 2.0 - 1)) = 6x base, so the 5x ceiling trims the grant. This
    // is what makes MAX_EARN_MULTIPLIER stop being dead code (D1).
    const r = computeEarn(
      { total: 7.2, windowSpend: 750, paidFromBalance: true, bonusDayActivated: true, at: TUE },
      RULES,
    );
    expect(r.base).toBeCloseTo(36, 6);
    expect(r.cap).toBeCloseTo(180, 6);
    expect(r.subtotal).toBeCloseTo(216, 6);
    expect(r.capApplied).toBe(true);
    expect(r.points).toBe(180);
    expect(r.effectiveMultiplier).toBeCloseTo(5, 9);
  });

  it('D1 earn: with the bonus day off the reachable stack is 3.75x and the cap does not bind', () => {
    // §8.2: wallet 1.5 x (1 + (tier 2.0 - 1) + Friday 0.5) = 3.75x.
    const r = computeEarn(
      { total: 7.2, windowSpend: 750, paidFromBalance: true, at: FRI },
      RULES,
    );
    expect(r.capApplied).toBe(false);
    expect(r.points).toBe(135);
    expect(r.effectiveMultiplier).toBeCloseTo(3.75, 9);
  });

  it('D2 earn: bonusDayActivated defaults to false — no caller can assert it into the grant', () => {
    const claimed = computeEarn({ total: 10, at: TUE }, RULES);
    expect(claimed.bonusDayBonus).toBe(0);
    expect(claimed.points).toBe(50);
    // It is paid ONLY when the caller passes the server-verified flag.
    expect(computeEarn({ total: 10, bonusDayActivated: true, at: TUE }, RULES).points).toBe(100);
  });
});

describe('T6 earn: total giveback ceiling — no input can exceed MAX_EARN_MULTIPLIER x base', () => {
  // THIS IS THE GIVEBACK-CEILING TEST.
  const TOTALS = [0, 0.75, 1.75, 7.2, 8.7, 20.3, 50];
  const WINDOW_SPEND = [0, 100, 300, 750];
  const PAIRS = [0, 1, 5, 25];
  // 2026-09-06 is a Sunday in Amman; seven consecutive days = weekday 0..6.
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 6 + i, 10, 0, 0)));

  it('the seven grid days really are Amman weekday 0..6', () => {
    expect(DAYS.map((d) => ammanWeekday(d))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('the capped component of every grant is bounded by the ceiling', () => {
    let sawCapBind = false;
    let sawComboEscape = false;

    for (const total of TOTALS) {
      for (const windowSpend of WINDOW_SPEND) {
        for (const paidFromBalance of [false, true]) {
          for (const bonusDayActivated of [false, true]) {
            for (const pairs of PAIRS) {
              for (const at of DAYS) {
                // Cheap units (0.10 + 0.05 a pair) so most cells keep a
                // regular base beside the combo; the dearer cells exercise a
                // base the pairs consume entirely.
                const r = computeEarn(
                  {
                    total, windowSpend, paidFromBalance, bonusDayActivated,
                    combo: pairBasket(pairs, 0.1, 0.05), at,
                  },
                  RULES,
                );
                const where = JSON.stringify({
                  total, windowSpend, paidFromBalance, bonusDayActivated,
                  pairs, weekday: r.weekday,
                });

                // The combo is a flat, per-pair grant that sits OUTSIDE the
                // ceiling (D4 is gated on §8.7). Everything else is inside it.
                const capped = r.points - r.comboBonus;
                expect(r.comboBonus, where).toBe(pairs * RULES.comboBonusPoints);

                // r.cap IS base x maxEarnMultiplier, computed once inside the
                // function under test — no re-derivation here. Math.round
                // because `points` is whole points and `cap` is not.
                expect(capped, where).toBeLessThanOrEqual(Math.round(r.cap));

                // The total bound on what may ever be granted, for any input.
                expect(r.points, where).toBeLessThanOrEqual(Math.round(r.cap) + r.comboBonus);

                if (r.base > 0) {
                  // The ratio form. The tolerance is 0.5/base, not 1e-9: the
                  // grant is rounded to whole points while the ceiling is not,
                  // so at total = 0.75 (base 3.75, cap 18.75) a capped grant of
                  // 19 points is 5.067x base and is still the ceiling working.
                  const slack = 0.5 / r.base + 1e-9;
                  expect(capped / r.base, where)
                    .toBeLessThanOrEqual(RULES.maxEarnMultiplier + slack);
                  expect(r.effectiveMultiplier, where).toBe(r.points / r.base);
                } else {
                  // No regular base — a free bill, or one the pairs used up
                  // entirely: the combo is all that is paid.
                  expect(r.effectiveMultiplier, where).toBe(0);
                  expect(r.points, where).toBe(pairs * RULES.comboBonusPoints);
                }

                if (r.capApplied) sawCapBind = true;
                if (r.points > Math.round(r.cap)) {
                  sawComboEscape = true;
                  // The ONLY way past the ceiling is the combo (§8.7).
                  expect(pairs, where).toBeGreaterThan(0);
                }
              }
            }
          }
        }
      }
    }

    // The grid must actually exercise both edges, or it proves nothing.
    expect(sawCapBind).toBe(true);
    expect(sawComboEscape).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T7 / T8 / T27 — the static walk over every workspace.
//
// The walk itself now lives in bff/test/lib/sources.ts (§G gate 1): it also
// covers `integrations/` and `.py` / `.js`, so the Odoo module and the POS
// JavaScript are inside T7's reach rather than invisible to it. T27 below is
// what keeps that true.
// ---------------------------------------------------------------------------

let sources: SourceFile[];
beforeAll(() => { sources = collectSources(); });

const EXEMPT_MARKER = /\/\/\s*earn-arith-exempt:/;
/** Exemption is per LINE: the line itself, or the line directly above it. */
function isExempt(f: SourceFile, i: number): boolean {
  return EXEMPT_MARKER.test(f.raw[i]) || (i > 0 && EXEMPT_MARKER.test(f.raw[i - 1]));
}

describe('T7 earn: no module outside @almond/shared/loyalty/earn computes points', () => {
  // THIS IS THE ANTI-DIVERGENCE TEST. D2 existed because the earn arithmetic
  // was written twice. It cannot come back while every constant it needs is
  // unreachable outside the one implementation.
  const WHOLESALE_EXEMPT = new Set([
    'packages/shared/src/config/index.ts',   // the declarations
    'packages/shared/src/loyalty/earn.ts',   // the one implementation
  ]);

  const PATTERNS: { re: RegExp; sharedIsExempt: boolean }[] = [
    { re: /\bPOINTS_PER_JOD\b(?!_REDEEM)/, sharedIsExempt: false },
    { re: /\bMAX_EARN_MULTIPLIER\b/, sharedIsExempt: false },
    { re: /\bWALLET_EARN_MULTIPLIER\b/, sharedIsExempt: false },
    { re: /\bCOMBO_BONUS_POINTS\b/, sharedIsExempt: false },
    { re: /\bcomboBonusPoints\s*\(/, sharedIsExempt: false },
    // The tier ramp is legitimate for DISPLAY everywhere; what must not spread
    // is deriving an earn multiplier from it outside the shared function.
    { re: /\btierFromSpend\b/, sharedIsExempt: true },
  ];

  it('every earn constant outside the shared implementation is exempted by line', () => {
    const offenders: string[] = [];
    for (const f of sources) {
      if (WHOLESALE_EXEMPT.has(f.path)) continue;
      const inShared = f.path.startsWith('packages/shared/');
      f.code.forEach((line, i) => {
        for (const p of PATTERNS) {
          if (p.sharedIsExempt && inShared) continue;
          if (p.re.test(line) && !isExempt(f, i)) {
            offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
            return;
          }
        }
      });
    }
    expect(
      offenders,
      'earn arithmetic must live in packages/shared/src/loyalty/earn.ts — see '
      + `docs/LOYALTY-EARN-PATCH.md §3. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('T7b the BFF earn module IS the shared function, not a copy of it', () => {
    // Identity, not equal numbers: two implementations that agree today are
    // exactly the state D2 was in. bff/src/earn.ts must be a re-export.
    expect(bffEarn.computeEarn).toBe(computeEarn);
    expect(bffEarn.earnedPoints).toBe(earnedPoints);
    expect(bffEarn.earnRulesFromConfig).toBe(earnRulesFromConfig);
    // ... and the file itself is a re-export: no operator, no Math, no body.
    const src = stripComments(readFileSync(join(REPO, 'bff/src/earn.ts'), 'utf8').split('\n'), 'ts')
      .join('\n');
    expect(src).not.toMatch(/Math\./);
    expect(src).not.toMatch(/[+\-*/]\s|\breturn\b|\bfunction\b|=>/);
  });

  it('T7c every server call site pins bonusDayActivated to false (D2)', () => {
    // The server has NO record of a bonus-day activation (promoStore is device
    // state), so a client-asserted flag is a self-crediting vector — §3.2 / §8.1.
    // The explicit `false` in routes/checkout.ts is the only thing enforcing
    // that, and T10 alone cannot see it: T10's expected value is built with the
    // parameter OMITTED (which also defaults to false), so on six days out of
    // seven a route that started paying the bonus day would cancel out and stay
    // green. This assertion is source-level, so it holds on every weekday.
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('bff/src/')) continue;
      f.code.forEach((line, i) => {
        // (1) Every computeEarn/earnedPoints call must pass it explicitly.
        if (/\b(?:computeEarn|earnedPoints)\s*\(/.test(line)) {
          const callSite = f.code.slice(i, i + 14).join('\n');
          if (!/bonusDayActivated\s*:\s*false/.test(callSite)) {
            offenders.push(`${f.path}:${i + 1}: call does not pin bonusDayActivated: false`);
          }
        }
        // (2) ... and the ONLY value the server may ever give it is `false`,
        // so it can never be read off a request body or a member record.
        if (/\bbonusDayActivated\b/.test(line) && !/bonusDayActivated\s*:\s*false/.test(line)) {
          offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      'the BFF must never pay an activated bonus day: there is no server-side'
      + ' activation record, so a client-supplied flag is self-crediting.'
      + ` See §3.2 / §8.1. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('the walk actually looked at the files it claims to guard', () => {
    // A walk that silently found nothing would pass every assertion above.
    const paths = new Set(sources.map((f) => f.path));
    expect(paths.has('almond-app/services/loyalty.service.mock.ts')).toBe(true);
    expect(paths.has('almond-web/src/data/order.ts')).toBe(true);
    expect(paths.has('bff/src/routes/checkout.ts')).toBe(true);
    expect(paths.has('packages/shared/src/loyalty/earn.ts')).toBe(true);
    expect(sources.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// T27 — the walk reaches what it claims to guard, and the stripper preserves
// code. docs/LOYALTY-ODOO-ARCHITECTURE.md §F.0 / §G gate 1.
//
// The test above is the ancestor of this one and is deliberately kept: it
// guards the four TypeScript files. T27 guards the WIDENING — the roots and
// extensions added so that an Odoo-side earn evaluator cannot be written
// outside T7's view — and, more importantly, guards the widening's own hazard.
// ---------------------------------------------------------------------------
describe('T27 the static walk covers what it claims, and does not eat the code', () => {
  it('walks integrations/ and collects Python and POS JavaScript', () => {
    // These are real files in the repo today, not placeholders for future work:
    // the previous walk (`ROOTS` without `integrations`, `/\.tsx?$/`) saw NONE
    // of them, and reported nothing while doing so.
    const paths = new Set(sources.map((f) => f.path));
    expect(paths.has('integrations/almond_followers_guard/models/pos_order.py')).toBe(true);
    expect(paths.has('integrations/almond_branch/models/pos_order.py')).toBe(true);
    expect(paths.has('integrations/pos_meps_apex/static/src/app/payment_meps.js')).toBe(true);

    // And the extensions are actually reaching files, not just declared.
    expect(sources.filter((f) => f.path.endsWith('.py')).length).toBeGreaterThan(5);
    expect(sources.filter((f) => f.path.endsWith('.js')).length).toBeGreaterThan(0);
  });

  it('the roots and extensions the Odoo work will land in are declared', () => {
    // Gate 4 writes integrations/almond_loyalty/{services/earn.py,
    // static/src/app/earn_formula.js}. If either root or extension is dropped
    // later, T7 goes quiet instead of red — so assert the configuration itself.
    expect(ROOTS).toContain('integrations');
    expect(EXT.test('earn.py')).toBe(true);
    expect(EXT.test('earn_formula.js')).toBe(true);
    expect(EXT.test('pay.tsx')).toBe(true);
  });

  it('THE CANARY: comment stripping did not blank the TypeScript', () => {
    // The hazard §F.0 names. A single unconditional stripper with a '#' rule
    // truncates every hex colour literal, and they are pervasive in the app.
    // T7, T8 and T24 would keep passing over the wreckage.
    for (const p of [
      'almond-app/components/ui/Button.tsx',
      // Was components/loyalty/Cup.tsx until the cup was deleted 2026-09-08.
      // The canary needs a file that REALLY CONTAINS hex literals — the first
      // replacement was constants/theme.ts, which turned out to be a re-export
      // shim with none, and the test said so immediately. Verified by grep:
      // this one carries them inline.
      'almond-app/components/gift/GiftCardTile.tsx',
    ]) {
      const f = sources.find((s) => s.path === p);
      expect(f, `${p} must be in the walk`).toBeDefined();
      expect(f!.code.join('\n'), `${p}: hex literals were eaten by the stripper`)
        .toContain('#');
    }

    // The stripper is not simply a no-op either: it still removes comments.
    expect(stripComments(['const a = 1; // POINTS_PER_JOD'], 'ts')).toEqual(['const a = 1; ']);
    expect(stripComments(['const c = "#ABCDEF";'], 'ts')).toEqual(['const c = "#ABCDEF";']);
  });

  it('the Python branch strips comments and docstrings, not code', () => {
    // A '#' comment goes; a '#' inside a string stays; a docstring naming an
    // earn constant is prose, not an implementation — otherwise the only way to
    // keep T7 green would be to delete the explanation.
    expect(stripComments(['rate = 4  # POINTS_PER_JOD'], 'py')).toEqual(['rate = 4  ']);
    expect(stripComments(['colour = "#ABCDEF"'], 'py')).toEqual(['colour = "#ABCDEF"']);
    expect(stripComments(['x = 1', '"""POINTS_PER_JOD lives in shared."""', 'y = 2'], 'py'))
      .toEqual(['x = 1', '', 'y = 2']);
    const block = stripComments(
      ['"""', 'MAX_EARN_MULTIPLIER is not applied here.', '"""', 'z = 3'],
      'py',
    );
    expect(block).toEqual(['', '', '', 'z = 3']);
  });
});

describe('T8 earn: the Friday literal is gone from every codebase', () => {
  it('no code anywhere still hardcodes getDay() === 5 (D3)', () => {
    const hits: string[] = [];
    for (const f of sources) {
      f.code.forEach((line, i) => {
        if (/getDay\(\)\s*===\s*5/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('no code reads a business day off a freshly-constructed host clock (§3.6)', () => {
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === 'packages/shared/src/lib/ammanWeekday.ts') continue;
      f.code.forEach((line, i) => {
        if (/\bnew Date\([^)]*\)\.getDay\(\)/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('no host-clock weekday read survives anywhere (§9 checklist item 2)', () => {
    // The ratchet, now closed. almond-app/lib/bonusDay.ts was the last one: it
    // gated the ×2 banner and its Activate control on the DEVICE clock while
    // computeEarn gated the grant on ammanWeekday(), so off an Amman timezone
    // the app advertised a double it would then not pay — D2 reopened on the
    // bonus-day dial. Both now read ammanWeekday(). This list stays empty.
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === 'packages/shared/src/lib/ammanWeekday.ts') continue;
      f.code.forEach((line, i) => {
        if (/\.getDay\(\)/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('T14 earn: client and server agree across the Thursday/Friday boundary (§3.6)', () => {
  // THIS IS THE TEST THAT STOPS D2 COMING BACK THROUGH THE CLOCK.
  const BOUNDARY: { iso: string; ammanWeekday: number }[] = [
    { iso: '2026-09-10T19:30:00Z', ammanWeekday: 4 }, // 22:30 Amman, Thursday
    { iso: '2026-09-10T21:30:00Z', ammanWeekday: 5 }, // 00:30 Amman, Friday
    { iso: '2026-09-10T23:30:00Z', ammanWeekday: 5 }, // 02:30 Amman, Friday
    { iso: '2026-09-11T00:30:00Z', ammanWeekday: 5 }, // 03:30 Amman, Friday
  ];

  const originalTZ = process.env.TZ;
  afterAll(() => { process.env.TZ = originalTZ; });

  it('the Amman weekday is the same on a UTC host and on an Amman host', () => {
    for (const { iso, ammanWeekday: expected } of BOUNDARY) {
      const at = new Date(iso);
      process.env.TZ = 'UTC';
      const utcRun = ammanWeekday(at);
      const utcHostDay = new Date(iso).getDay();
      process.env.TZ = 'Asia/Amman';
      const ammanRun = ammanWeekday(at);
      const ammanHostDay = new Date(iso).getDay();

      expect(utcRun, iso).toBe(expected);
      expect(ammanRun, iso).toBe(expected);
      // ... and the host clock genuinely disagrees with itself here, which is
      // what makes this test capable of failing if the implementation ever
      // regresses to Date#getDay().
      expect(ammanHostDay, iso).toBe(expected);
      if (iso === '2026-09-10T21:30:00Z' || iso === '2026-09-10T23:30:00Z') {
        expect(utcHostDay, iso).toBe(4); // the host would say Thursday
        expect(utcHostDay).not.toBe(expected);
      }
    }
  });

  it('the grant is the same on a UTC host and on an Amman host', () => {
    for (const { iso, ammanWeekday: wd } of BOUNDARY) {
      const at = new Date(iso);
      process.env.TZ = 'UTC';
      const onUtc = computeEarn({ total: 7.2, at }, RULES).points;
      process.env.TZ = 'Asia/Amman';
      const onAmman = computeEarn({ total: 7.2, at }, RULES).points;
      expect(onUtc, iso).toBe(onAmman);
      // 7.2 x 5 = 36 base; Friday pays +50% ⇒ 54. The 00:30-03:30 Amman window
      // is the one where a host-clock server would have paid 36 and the phone
      // would have promised 54 — the D2 failure mode on the D3 dial.
      expect(onUtc, iso).toBe(wd === 5 ? 54 : 36);
    }
  });
});

describe('T10 checkout: the points the route grants equal computeEarn on the same inputs', () => {
  let app: FastifyInstance;
  let token: string;
  const line = (() => {
    const item = menuItems.find(
      (m) => m.inStock !== false && m.sizes.length > 0 && m.sizes[0].price > 0,
    )!;
    return { itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 };
  })();

  beforeAll(async () => {
    app = await build();
    token = await signIn(app, '0790000000');
  });

  it('grants exactly computeEarn({ total, windowSpend, paidFromBalance, combo }).points', async () => {
    // A single line is one kind of item, so it can never make a pair. Pinned,
    // because the route feeds the priced combo lines into the grant.
    const { combo } = reprice([line]);
    expect(Math.min(combo.drinks.length, combo.foods.length)).toBe(0);

    const auth = { authorization: `Bearer ${token}` };
    const before = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth })).json();

    const r = await app.inject({
      method: 'POST', url: '/v1/checkout',
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet', lines: [line] },
      headers: { ...auth, 'idempotency-key': randomUUID() },
    });
    expect(r.statusCode).toBe(201);
    const body = r.json();

    // body.total is the TAX-INCLUSIVE total (§1.1). Asserting against
    // body.subtotal is the bug this test exists to catch.
    // `bonusDayActivated: false` is EXPLICIT here, matching the route. Omitting
    // it defaults to false too, which is exactly why omitting it was unsafe:
    // the two calls then differed only on a BONUS_BEAN_DAY weekday, so a route
    // that began self-crediting the bonus day would pass six days out of seven.
    const at = new Date();
    const ctx = {
      total: body.total,
      windowSpend: before.windowSpend,
      paidFromBalance: true,
      combo,
      bonusDayActivated: false,
      at,
    };
    expect(body.pointsEarned).toBe(computeEarn(ctx).points);
    expect(body.pointsEarned).toBeGreaterThan(0);
    // Tax is INSIDE the price (as at the till): the member pays the subtotal,
    // and a real, positive part of it is tax.
    expect(body.total).toBeCloseTo(body.subtotal, 6);
    expect(body.tax).toBeGreaterThan(0);

    // On a bonus-day weekday the two answers genuinely differ, so the assertion
    // above has teeth on that day. On every other day T7c is what holds the
    // line — this branch is the belt, T7c is the braces.
    const rules = earnRulesFromConfig();
    if (rules.bonusDay.enabled && rules.bonusDay.weekdays.includes(ammanWeekday(at))) {
      expect(body.pointsEarned).not.toBe(computeEarn({ ...ctx, bonusDayActivated: true }).points);
    }
  });

  it('T10b checkout: the breakdown behind the grant is persisted on the order (§5b)', async () => {
    // A return value nothing writes down observes nothing (§4 D8 item 1). The
    // route must hand the breakdown to the backend, or the shadow delta in §5b
    // cannot be reconstructed and D8's goal is not met.
    //
    // CHANGED 2026-09-23 with the checkout atomicity fix: the route no longer
    // calls backend.recordEarnBreakdown(order.id, earn) as a separate step —
    // the breakdown travels INSIDE backend.checkout, and is written in the same
    // transaction as the order and the grant it describes. What is pinned is
    // unchanged in substance: the funded breakdown reaches the order.
    const src = readFileSync(join(REPO, 'bff/src/routes/checkout.ts'), 'utf8');
    const call = src.slice(src.indexOf('backend.checkout('));
    expect(call.slice(0, call.indexOf('\n    });'))).toMatch(/\bearn:\s*funded\s*\?\s*earn\s*:\s*null/);

    // ... and the backend really stores it, with points that match the grant.
    const backend = createMemoryBackend();
    const member = await backend.findOrCreateByPhone('+962790000111', 'T10b');
    const earn = computeEarn({ total: 11.6, bonusDayActivated: false, at: MON }, RULES);
    const { order } = await backend.checkout(member.id, {
      order: { branchId: 'b1', type: 'pickup', paymentMethod: 'cash', subtotal: 10, tax: 1.6, total: 11.6 },
      walletDebitFils: 0, pointsEarned: earn.points,
      pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
      earn, spendJod: 11.6, corporateUse: null,
      secondVisit: { basketHasDrink: false, arm: assignHoldout(member.id, holdoutSpecFromConfig('secondVisitVoucher')) },
      at: MON,
    });
    expect(order.earn).toEqual(earn);
    expect(order.pointsEarned).toBe(earn.points);
    // The standalone method still stores it for a caller that has an order id.
    const other = await backend.createOrder({
      memberId: member.id, branchId: 'b1', type: 'pickup', paymentMethod: 'cash',
      subtotal: 10, tax: 1.6, total: 11.6, pointsEarned: 0,
    });
    await backend.recordEarnBreakdown(other.id, earn);
    // The memory backend stores the record by reference, so the object
    // createOrder handed back IS the stored row.
    expect(other.earn).toEqual(earn);
    expect(other.pointsEarned).toBe(earn.points);
  });
});

// ---------------------------------------------------------------------------
// Held behind a product decision — written, named, and not run.
// ---------------------------------------------------------------------------

/** §4 D6 prize values, in JOD, at repo menu prices. Checked in so the EV in
 *  the patch document and the EV the test computes can never drift apart. */
const PRIZE_VALUES_JOD: Record<string, number> = {
  'credit-1': 1.0, cookie: 1.9, americano: 2.5, 'any-drink': 4.5,
  'omelette-croissant': 2.9, pasta: 4.5, pizza: 7.5, 'credit-5': 5.0,
  cake: 4.5, 'credit-10': 10.0, 'no-win': 0,
};
/** The ceiling §8.4 must choose. Today the wheel pays 2.583 JOD/spin at a 100%
 *  win probability; there is no agreed ceiling, so the test cannot run. */
const SPIN_EV_CEILING_JOD: number | null = null;

describe('held behind §8', () => {
  it.todo(
    'T9 spin: the wheel has a losing slot and a bounded EV (D6, §8.4)'
    + ` — needs SPIN_EV_CEILING_JOD (currently ${SPIN_EV_CEILING_JOD})`
    + ` over ${Object.keys(PRIZE_VALUES_JOD).length} prize values;`
    + ' assert computeOdds(defaultSpinPrizes)["no-win"] > 0 and'
    + ' computeSpinEV(defaultSpinPrizes, PRIZE_VALUES_JOD) <= SPIN_EV_CEILING_JOD.'
    + ' NOTE: spinDefaults.ts resolves through the app\'s `@/` alias, so when'
    + ' §8.4 lands this test runs from almond-app/test/, or computeSpinEV moves'
    + ' to @almond/shared.',
  );
});
