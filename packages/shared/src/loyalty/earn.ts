import { config } from '../config';
import { corporateEarnsPoints } from './corporate';
import { tiers } from './constants';
import { ammanWeekday } from '../lib/ammanWeekday';

/** One rung of the ladder, as the earn calculation needs it. */
export interface TierRung {
  id: string;
  /** Qualifying spend in JOD over config.TIER_WINDOW_DAYS. */
  threshold: number;
  /** Ramp against pointsPerJod. 1.0 / 2.0 / 3.0 on a base of 2 → 2 / 4 / 6. */
  multiplier: number;
}

/** Every dial the earn calculation reads. Injectable so tests are deterministic
 *  and so an admin/server-pushed ruleset can replace the compiled defaults. */
export interface EarnRules {
  pointsPerJod: number;
  /**
   * Points per JOD when points are SPENT — config.POINTS_PER_JOD_REDEEM (100,
   * i.e. 1 point = 1 qirsh exactly, measured on 10,621 live redemptions at a
   * median of 100.0000 points/JOD).
   *
   * It lives in the EARN rules because the earn calculation is now the thing
   * that has to divide by it: points are money off the bill (owner,
   * 2026-09-08), so the bill has to be reduced by the points the member spent
   * before anything is earned on it. Passing the caller a JOD figure instead
   * would put this division at every call site, which is exactly the shape T7
   * exists to prevent. The one conversion is jodFromPoints() below.
   */
  pointsPerJodRedeem: number;
  /** THE LADDER. It used to be read straight from loyalty/constants.ts, which
   *  meant it was the one dial the tests could not pin — so editing the ramp
   *  silently moved every "pinned" expectation in bff/test/earn.test.ts. It is
   *  the earn RATE now (2/4/6 is the ramp, not a cosmetic tier ladder), so it
   *  belongs here with the others. Must be ascending by threshold. */
  tierRamp: readonly TierRung[];
  walletMultiplier: number;
  maxEarnMultiplier: number;
  comboBonusPoints: number;
  /** Pairs paid per invoice, however many the basket holds. Owner: the combo is
   *  for one person, not an office run. */
  comboMaxPairsPerInvoice: number;
  /** Whether the flat combo bonus pays on an invoice settled ENTIRELY with
   *  points. false — the shipped default — applies the owner's principle («لا
   *  يكسب نقاط على الجزء المدفوع بالنقاط») to the one grant that does not obey
   *  it arithmetically. The cost of the other side is in the config comment. */
  comboBonusOnPointsPaidInvoice: boolean;
  /** 🔴 Points are earned on `min(invoice, this)`. A safety valve against a
   *  mis-key at the till, not an offer dial — see the config comment. */
  maxEarningInvoiceJod: number;
  /** Additive fraction of the scaled base, by weekday (0=Sun..6=Sat). */
  weekdayBonus: readonly { weekday: number; rate: number }[];
  bonusDay: { enabled: boolean; multiplier: number; weekdays: readonly number[] };
}

/** The rung a qualifying spend earns at. Pure function of the ramp handed in. */
export function rungFromSpend(spend: number, ramp: readonly TierRung[]): TierRung {
  let current = ramp[0];
  for (const rung of ramp) {
    if (spend >= rung.threshold) current = rung;
  }
  return current;
}

/**
 * The better of two rungs, compared on the number the member is actually PAID
 * on. Defined once, here, because both sides of the ladder need it and they
 * must not disagree: loyalty/window.ts's `holdRung` uses it to keep a stored
 * floor from ever falling, and computeEarn below uses it to combine that floor
 * with the live window. Ties keep `a`, so a caller's existing rung is never
 * swapped for an equivalent one.
 *
 * Multiplier, not threshold: the threshold is how a rung is REACHED, the
 * multiplier is what it is WORTH, and only the second is a promise to a member.
 */
export function higherRung(a: TierRung, b: TierRung): TierRung {
  return b.multiplier > a.multiplier ? b : a;
}

export function earnRulesFromConfig(): EarnRules {
  return {
    pointsPerJod: config.POINTS_PER_JOD,
    pointsPerJodRedeem: config.POINTS_PER_JOD_REDEEM,
    tierRamp: tiers.map((t) => ({ id: t.id, threshold: t.threshold, multiplier: t.multiplier })),
    walletMultiplier: config.WALLET_EARN_MULTIPLIER,
    maxEarnMultiplier: config.MAX_EARN_MULTIPLIER,
    comboBonusPoints: config.COMBO_BONUS_POINTS,
    comboMaxPairsPerInvoice: config.COMBO_MAX_PAIRS_PER_INVOICE,
    comboBonusOnPointsPaidInvoice: config.COMBO_BONUS_ON_POINTS_PAID_INVOICE,
    maxEarningInvoiceJod: config.MAX_EARNING_INVOICE_JOD,
    weekdayBonus: config.WEEKDAY_EARN_BONUS,
    // Cast mirrors almond-app/lib/bonusDay.ts:12 — `as const` on the config object
    // narrows `weekdays` to a literal tuple, which `.includes(number)` rejects.
    bonusDay: {
      enabled: config.BONUS_BEAN_DAY.enabled,
      multiplier: config.BONUS_BEAN_DAY.multiplier,
      weekdays: config.BONUS_BEAN_DAY.weekdays as readonly number[],
    },
  };
}

/**
 * What N points are worth in JOD. THE ONLY points→JOD conversion in the repo.
 *
 * Points are money (owner, 2026-09-08: «رح اعامل النقاط كنقود يستطيع استخدامها
 * او الخصم من فاتورته بعمل redeem لنقاطه. فهي تقلل الفاتورة او تعملها مجانية»),
 * so this rate is now load-bearing in two directions at once: it is what the
 * member is handed at the till AND what is taken off the invoice before the
 * earn. Two copies of it would be D2 in a new place — the member would be given
 * one number and charged against another — so POST /v1/loyalty/redeem calls
 * this rather than dividing by the constant itself.
 */
export function jodFromPoints(
  points: number,
  rules: EarnRules = earnRulesFromConfig(),
): number {
  assertRedeemRate(rules);
  return Math.max(0, Math.floor(points || 0)) / rules.pointsPerJodRedeem;
}

/**
 * How many points buy N JOD off the bill. The inverse of jodFromPoints, and the
 * ONLY JOD→points conversion in the repo.
 *
 * It exists because the redeem screen is denominated in DINARS — the member is
 * taking money off a bill, not shopping a board — while every rail underneath
 * (the balance, the lots, POST /v1/loyalty/redeem, EarnContext.pointsRedeemed)
 * is denominated in points. Something has to convert, once.
 *
 * `ceil`, deliberately, and this is the only asymmetry with jodFromPoints: at a
 * rate that is not a whole number of points per JOD, rounding DOWN would spend
 * fewer points than the discount is worth and mint the difference on every
 * redemption. The house rounds toward the house. At the shipped rate (100
 * points = 1 JOD) every preset is exact and this never bites.
 */
export function pointsFromJod(
  jod: number,
  rules: EarnRules = earnRulesFromConfig(),
): number {
  assertRedeemRate(rules);
  return Math.ceil(Math.max(0, jod || 0) * rules.pointsPerJodRedeem);
}

/** Shared by jodFromPoints and computeEarn — a rate of 0 makes every redemption
 *  worth Infinity JOD, which silently zeroes the earn instead of failing. */
function assertRedeemRate(rules: EarnRules): void {
  if (!Number.isFinite(rules.pointsPerJodRedeem) || rules.pointsPerJodRedeem <= 0) {
    throw new Error(
      'EarnRules.pointsPerJodRedeem must be a positive finite number of points '
      + `per JOD; got ${String(rules.pointsPerJodRedeem)}. It is the redemption `
      + 'rate — see packages/shared/src/config/index.ts.',
    );
  }
}

export interface EarnContext {
  /** Invoice total in JOD, after discounts, INCLUDING TAX — i.e. exactly
   *  `computeTotals(...).total` (cart/totals.ts:52). See §1.1. */
  total: number;
  /** Qualifying spend in JOD over config.TIER_WINDOW_DAYS (90) → rung. Compute
   *  it with qualifyingSpend() in loyalty/window.ts; guests/web omit it (= 0). */
  windowSpend?: number;
  /**
   * The rung the member HOLDS — a FLOOR, never an override. There is no
   * demotion (config/index.ts:186-191), so a member whose 90-day window has
   * rolled back below the threshold they once crossed keeps the rate they
   * reached; `windowSpend` alone cannot express that.
   *
   * Resolved against `rules.tierRamp`, so an id that is not in the injected
   * ramp is ignored rather than throwing — an old tier id on a stale record
   * must not fail a checkout. Every existing call site omits this field, which
   * is why the shipped/pinned matrices in bff/test/earn.test.ts are unaffected
   * by its existence.
   *
   * It lives HERE rather than being folded into windowSpend by the caller
   * (`windowSpend: max(spend, rung.threshold)`) because that would make the
   * caller lie about a measured quantity in order to steer a rung — and the
   * lie would then be persisted in the §5b EarnBreakdown on the order.
   */
  heldRungId?: string;
  /**
   * WHOLE POINTS the member spent against THIS invoice — the redeem that made
   * the bill cheaper or free. Absent means zero, exactly as `heldRungId` does,
   * so every existing call site keeps its current answer.
   *
   * 🔴 POINTS, NOT JOD. The caller says how many points were taken off; the
   * conversion to dinars happens once, here, against `rules.pointsPerJodRedeem`
   * (jodFromPoints). A caller that converted first would be the second copy of
   * the redemption rate, and the member would then be charged points against
   * one rate and earn against another.
   *
   * WHY IT EXISTS. Owner, 2026-09-08: «لا يكسب نقاط على الجزء المدفوع
   * بالنقاط» — no points on the part of the bill paid with points. Without it a
   * 5 JOD bill settled with 3 JOD of points earns on 5, so points mint points:
   * small at 2%, but it never stops, and 65.1% of live redemption days carried
   * no cash transaction at all. Starbucks awards no stars on a redemption
   * either.
   */
  pointsRedeemed?: number;
  paidFromBalance?: boolean;
  /** Drink+food pairs, from comboPairs(items) in @almond/shared/lib/combo. */
  comboPairs?: number;
  /** True only when the member ACTIVATED today's bonus day (server-verified).
   *  Defaults to false: no caller may grant the bonus day by asserting it from
   *  the device — that was D2. See docs/LOYALTY-EARN-PATCH.md §3.2 / §8.1. */
  bonusDayActivated?: boolean;
  /**
   * 🔴 THE MEMBER HOLDS A STANDING CORPORATE DISCOUNT — AN ALMOND EMPLOYEE AT
   * 50%, A SAVE THE CHILDREN CARD AT 20%. When true, this invoice grants ZERO
   * points, and so does every other invoice they ever present.
   *
   * Owner, 2026-09-08, asked whether a discounted bill still earns cashback:
   * «من يستحق خصم دائم لا يأخذ نقاط ابدا». The discount IS the reward. An
   * employee at 50% who also earned the top rung's 9% would walk out with 55%
   * of the menu price, and the two mechanisms would compound every time anyone
   * tuned either.
   *
   * IT IS ENFORCED HERE, IN THE ENGINE, AND NOT AT THE CALL SITES. There are
   * four ways a grant is produced today — /v1/checkout, the app's mock service,
   * the checkout estimate, and the till's earn path — and a rule applied at
   * three of them is a rule that pays out at the fourth. Every one of those
   * routes through computeEarn, so this is the one place it cannot be missed.
   *
   * The server decides it from the roster; a client may not asserted it — but
   * note the asymmetry that makes that safe: a client CLAIMING corporate status
   * only ever reduces its own grant to zero, so the field is unforgeable in the
   * direction that would cost money. It is still resolved server-side, because
   * the DISCOUNT it accompanies is very much forgeable in the other direction.
   */
  corporate?: boolean;
  /** Decision clock. Defaults to now; pass it in tests and in estimates. */
  at?: Date;
}

export interface EarnBreakdown {
  /** The invoice this breakdown was computed on — carried so the record can be
   *  persisted and the grant re-derived after the fact (§5b). */
  total: number;
  /** Whole points the member spent against this invoice (ctx.pointsRedeemed,
   *  floored at 0). Persisted so §5b can re-derive the grant: `total` alone no
   *  longer determines it. */
  pointsRedeemed: number;
  /** What those points took off the bill: `pointsRedeemed / pointsPerJodRedeem`. */
  redeemedJod: number;
  /** The CASH portion of the invoice — `max(0, total - redeemedJod)`, before
   *  the invoice ceiling. This is the number the whole grant is built on, and
   *  it is 0 on a bill the member paid for entirely with points. */
  cashTotal: number;
  /** The part of `cashTotal` points were actually earned on: `min(cashTotal,
   *  maxEarningInvoiceJod)`. Equal to `total` on every real unredeemed invoice. */
  earningTotal: number;
  /** True when the invoice ceiling bound — i.e. the CASH portion was more than
   *  `maxEarningInvoiceJod`. On a 8.31 JOD average invoice this should be
   *  vanishingly rare, so a rising count is a signal worth an alert, not noise. */
  invoiceCapApplied: boolean;
  /** Pairs actually PAID, after `comboMaxPairsPerInvoice` and after the
   *  points-paid rule below — 0 when the bonus was withheld. */
  comboPairsPaid: number;
  /** True when a combo bonus the basket had earned was withheld because the
   *  invoice was settled entirely with points and
   *  `comboBonusOnPointsPaidInvoice` is off. Recorded rather than inferred: a
   *  `comboBonus` of 0 beside a basket that held a pair is otherwise
   *  indistinguishable from a basket that held none. */
  comboSuppressedByRedemption: boolean;
  base: number;            // total × pointsPerJod
  walletBonus: number;
  bonusDayBonus: number;
  tierBonus: number;
  weekdayBonus: number;
  comboBonus: number;
  /** Everything before the ceiling, `comboBonus` INCLUDED — but the ceiling
   *  does not cover the combo while D4 is held (§8.7), so `subtotal > cap` with
   *  `capApplied === false` is a normal, expected record. The grant is
   *  `Math.round(Math.min(subtotal - comboBonus, cap)) + comboBonus`. */
  subtotal: number;
  cap: number;             // base × maxEarnMultiplier
  /** Whether the ceiling actually trimmed the grant — i.e. whether it bound on
   *  the CAPPABLE component (`subtotal - comboBonus`), which is the only part
   *  it covers today. Not `subtotal > cap`. See the ceiling block below. */
  capApplied: boolean;
  points: number;          // the ONLY number that may be granted
  effectiveMultiplier: number; // points / base — for the giveback ceiling test
  tierId: string;
  /** Amman-local weekday the decision was made on (0=Sun..6=Sat), §3.6. */
  weekday: number;
}

export function computeEarn(
  ctx: EarnContext,
  rules: EarnRules = earnRulesFromConfig(),
): EarnBreakdown {
  const total = Math.max(0, ctx.total || 0);

  // 🔴 THE INVOICE CEILING. Its dials are checked here, before anything reads
  // them; the ceiling itself is applied a few lines down, to the CASH portion
  // of the invoice — the redeemed part comes off first (see the block below).
  //
  // The live programme had none, and one mis-keyed amount of 7,085,718.64 JOD
  // granted 28,342,875 points — 86.2% of every point outstanding in the member
  // table, from a single row nobody reviewed for over a year. A fat finger at
  // the till must cost a bounded amount. At 100 JOD against an 8.31 JOD average
  // invoice this never binds on a real sale.
  //
  // It THROWS on a missing or nonsensical dial rather than defaulting. Both
  // defaults are wrong: falling open (no cap) restores the defect this exists
  // to prevent — the same "unset means disabled" shape that left /v1/pos/scan
  // world-callable — and falling closed pays nobody. And a silent
  // `Math.min(total, undefined)` is NaN, which propagates all the way to the
  // grant and is caught by nothing. Every real caller goes through
  // earnRulesFromConfig(), and EarnRules is a required field, so this can only
  // fire on a hand-built ruleset — where failing at the first grant with a
  // named reason is exactly what should happen.
  if (!Number.isFinite(rules.maxEarningInvoiceJod) || rules.maxEarningInvoiceJod <= 0) {
    throw new Error(
      'EarnRules.maxEarningInvoiceJod must be a positive finite number of JOD; '
      + `got ${String(rules.maxEarningInvoiceJod)}. It is the invoice ceiling — `
      + 'see packages/shared/src/config/index.ts.',
    );
  }
  if (!Number.isFinite(rules.comboMaxPairsPerInvoice) || rules.comboMaxPairsPerInvoice < 0) {
    throw new Error(
      'EarnRules.comboMaxPairsPerInvoice must be a non-negative finite number; '
      + `got ${String(rules.comboMaxPairsPerInvoice)}.`,
    );
  }
  assertRedeemRate(rules);

  // 🔴 THE REDEEMED PORTION COMES OFF FIRST — BEFORE THE CEILING AND BEFORE
  // THE RATE. Owner, 2026-09-08: points ARE money, spent against the bill to
  // make it cheaper or free, and «لا يكسب نقاط على الجزء المدفوع بالنقاط».
  //
  // ORDER MATTERS AND IT IS NOT A MATTER OF TASTE. Ceiling-then-redemption on a
  // 150 JOD invoice with 60 JOD of points would earn on min(150,100) − 60 = 40;
  // redemption-then-ceiling earns on min(150 − 60, 100) = 90. The ceiling is a
  // guard against a mis-key at the till (7,085,718.64 JOD, 2025-06-23), not an
  // allowance to be consumed by a redemption, so it must clamp the CASH the
  // member actually handed over — which is what it does below.
  //
  // Floored to whole points, because a point is the indivisible unit the member
  // spends, and clamped at 0: a caller may over-redeem (paying the bill to
  // exactly free needs ceil(total × pointsPerJodRedeem) points, which usually
  // overshoots by a fraction of a fil) and that must never make the base
  // negative and pay the member for a bill they did not have.
  const pointsRedeemed = Math.max(0, Math.floor(ctx.pointsRedeemed ?? 0));
  const redeemedJod = pointsRedeemed / rules.pointsPerJodRedeem;
  const cashTotal = Math.max(0, total - redeemedJod);

  const earningTotal = Math.min(cashTotal, rules.maxEarningInvoiceJod);
  const invoiceCapApplied = cashTotal > rules.maxEarningInvoiceJod;
  // NOT Date#getDay(): that is host-local, and the BFF, the phone and the till
  // are not on the same clock. One business day, defined once — see §3.6.
  const weekday = ammanWeekday(ctx.at ?? new Date());

  // The rate is applied to the cash portion only, because `earningTotal` is
  // already `min(cashTotal, ceiling)`. A bill paid for entirely with points has
  // a base of 0 and earns nothing on the rate — no rule needed for that case,
  // it is what "a percentage of the cash" means.
  const base = earningTotal * rules.pointsPerJod;

  // Stack factors — multiplicative on the base, exactly as bff/src/earn.ts:15-16
  // and loyalty.service.mock.ts:222-224 did before this patch. Changing this to
  // an additive stack changes the customer offer; see LOYALTY-EARN-PATCH §8.6.
  const walletMult = ctx.paidFromBalance ? rules.walletMultiplier : 1;
  const bonusDayOn =
    !!ctx.bonusDayActivated &&
    rules.bonusDay.enabled &&
    rules.bonusDay.weekdays.includes(weekday) &&
    rules.bonusDay.multiplier > 1;
  const bonusMult = bonusDayOn ? rules.bonusDay.multiplier : 1;

  const scaled = base * walletMult * bonusMult;
  const walletBonus = base * (walletMult - 1);
  const bonusDayBonus = scaled - base - walletBonus;

  // Additive bonuses, as fractions of the scaled base. The tier ramp IS the
  // earn rate: a base of 2 with a 3.0 rung is 6 pts/JOD, i.e. 6% back.
  // The rung is the better of what the live 90-day window qualifies for and
  // the floor the member already holds. A floor, not an override: a member who
  // has crossed 20 JOD is paid the new rate on their NEXT invoice — not held at
  // the old one until a quarterly boundary (the ladder's only mechanic is a
  // promise about the next visit, at a 28-day median return gap) — and a member
  // whose window has rolled off keeps the rate they reached. The invoice that
  // does the crossing is itself paid at the old rung, because callers read the
  // standing before recording the sale (bff/src/routes/checkout.ts).
  const fromSpend = rungFromSpend(Math.max(0, ctx.windowSpend ?? 0), rules.tierRamp);
  const held = rules.tierRamp.find((r) => r.id === ctx.heldRungId);
  const tier = held ? higherRung(fromSpend, held) : fromSpend;
  const tierBonus = scaled * (tier.multiplier - 1);
  const rate = rules.weekdayBonus.find((w) => w.weekday === weekday)?.rate ?? 0;
  const weekdayBonus = scaled * rate;
  // The combo pays once per invoice: `comboPairs()` counts min(drinks, foods)
  // and is uncapped on purpose, and this is where that count is bounded. A
  // basket of 15 drinks and 15 foods used to mint 750 points on one invoice.
  const comboPairsCounted = Math.min(
    Math.max(0, Math.floor(ctx.comboPairs ?? 0)),
    Math.max(0, Math.floor(rules.comboMaxPairsPerInvoice)),
  );
  // ... and this is where the flat bonus is made to obey the same principle as
  // the rate. The rate needs no rule — it is a percentage of a cash portion
  // that is zero — but 50 flat points sit outside every ceiling, so a pair paid
  // for entirely out of a points balance would collect them. Not a mint (the
  // balance falls to 11.4% of itself each cycle) but it inflates what an
  // existing balance eventually grants by ≈12.9%; the dial and its arithmetic
  // are in config/index.ts, and flipping it is this one boolean.
  //
  // The test is `redeemedJod > 0 && cashTotal === 0`, NOT `cashTotal === 0`: a
  // genuinely free invoice (total 0 — a comped basket, a staff order) has no
  // redemption behind it and its behaviour is deliberately unchanged.
  const comboSuppressedByRedemption =
    !rules.comboBonusOnPointsPaidInvoice
    && comboPairsCounted > 0
    && redeemedJod > 0
    && cashTotal === 0;
  const comboPairsPaid = comboSuppressedByRedemption ? 0 : comboPairsCounted;
  const comboBonus = comboPairsPaid * rules.comboBonusPoints;

  // THE CEILING (D1). Since 2026-09-06 it is a SAFETY VALVE, not an offer dial.
  // The wallet multiplier, the bonus day and the weekday bonus are all retired,
  // so the only thing that stacks is the ramp itself and the reachable maximum
  // is exactly the top rung — 3.0× base. The cap sits above it at 3.5× and does
  // not bind on any reachable input.
  //
  // 🔴 Lowering maxEarnMultiplier below the top rung's multiplier silently trims
  // the top rung back toward the one below it: the member is shown 6% and paid
  // less, with no error raised anywhere. That is what T6 exists to catch.
  //
  // The combo bonus sits OUTSIDE the ceiling, which is what the pre-patch
  // server did (bff/src/earn.ts:21 — `Math.round(Math.min(...)) + comboBonus`)
  // and what the pre-patch app did (loyalty.service.mock.ts:264-275). Moving it
  // inside is D4: it is an OFFER CHANGE, not a refactor — it takes points off
  // ordinary members (LOYALTY-EARN-PATCH §8.7 has the numbers and the gate), so
  // it is deliberately NOT shipped here. When §8.7 is decided, D4 is exactly
  // these two lines:
  //     const capped = Math.min(scaled + tierBonus + weekdayBonus + comboBonus, cap);
  //     const points = Math.round(capped);
  const cappable = scaled + tierBonus + weekdayBonus;
  const cap = base * rules.maxEarnMultiplier;
  const capApplied = cappable > cap;
  // 🔴 THE CORPORATE ZERO, APPLIED LAST AND OVER EVERYTHING — including the
  // combo bonus, which deliberately escapes the ceiling above (§8.7) and would
  // otherwise be the one grant a standing-discount holder still collected.
  // `corporateEarnsPoints()` carries the reason; see loyalty/corporate.ts.
  const points = ctx.corporate && !corporateEarnsPoints()
    ? 0
    : Math.round(Math.min(cappable, cap)) + comboBonus;

  return {
    total,
    pointsRedeemed, redeemedJod, cashTotal,
    earningTotal, invoiceCapApplied, comboPairsPaid, comboSuppressedByRedemption,
    base, walletBonus, bonusDayBonus, tierBonus, weekdayBonus, comboBonus,
    subtotal: cappable + comboBonus, cap, capApplied, points,
    effectiveMultiplier: base > 0 ? points / base : 0,
    tierId: tier.id,
    weekday,
  };
}

export function earnedPoints(ctx: EarnContext, rules?: EarnRules): number {
  return computeEarn(ctx, rules).points;
}
