import { config } from '../config';
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
  /** THE LADDER. It used to be read straight from loyalty/constants.ts, which
   *  meant it was the one dial the tests could not pin — so editing the ramp
   *  silently moved every "pinned" expectation in bff/test/earn.test.ts. It is
   *  the earn RATE now (2/4/6 is the ramp, not a cosmetic tier ladder), so it
   *  belongs here with the others. Must be ascending by threshold. */
  tierRamp: readonly TierRung[];
  walletMultiplier: number;
  maxEarnMultiplier: number;
  comboBonusPoints: number;
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

export function earnRulesFromConfig(): EarnRules {
  return {
    pointsPerJod: config.POINTS_PER_JOD,
    tierRamp: tiers.map((t) => ({ id: t.id, threshold: t.threshold, multiplier: t.multiplier })),
    walletMultiplier: config.WALLET_EARN_MULTIPLIER,
    maxEarnMultiplier: config.MAX_EARN_MULTIPLIER,
    comboBonusPoints: config.COMBO_BONUS_POINTS,
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

export interface EarnContext {
  /** Invoice total in JOD, after discounts, INCLUDING TAX — i.e. exactly
   *  `computeTotals(...).total` (cart/totals.ts:52). See §1.1. */
  total: number;
  /** Rolling-12-month qualifying spend in JOD → tier. Guests/web: omit (= 0). */
  windowSpend?: number;
  paidFromBalance?: boolean;
  /** Drink+food pairs, from comboPairs(items) in @almond/shared/lib/combo. */
  comboPairs?: number;
  /** True only when the member ACTIVATED today's bonus day (server-verified).
   *  Defaults to false: no caller may grant the bonus day by asserting it from
   *  the device — that was D2. See docs/LOYALTY-EARN-PATCH.md §3.2 / §8.1. */
  bonusDayActivated?: boolean;
  /** Decision clock. Defaults to now; pass it in tests and in estimates. */
  at?: Date;
}

export interface EarnBreakdown {
  /** The invoice this breakdown was computed on — carried so the record can be
   *  persisted and the grant re-derived after the fact (§5b). */
  total: number;
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
  // NOT Date#getDay(): that is host-local, and the BFF, the phone and the till
  // are not on the same clock. One business day, defined once — see §3.6.
  const weekday = ammanWeekday(ctx.at ?? new Date());

  const base = total * rules.pointsPerJod;

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
  const tier = rungFromSpend(Math.max(0, ctx.windowSpend ?? 0), rules.tierRamp);
  const tierBonus = scaled * (tier.multiplier - 1);
  const rate = rules.weekdayBonus.find((w) => w.weekday === weekday)?.rate ?? 0;
  const weekdayBonus = scaled * rate;
  const comboBonus =
    Math.max(0, Math.floor(ctx.comboPairs ?? 0)) * rules.comboBonusPoints;

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
  const points = Math.round(Math.min(cappable, cap)) + comboBonus;

  return {
    total,
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
