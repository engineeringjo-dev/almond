import { config } from '../config';
import { tierFromSpend } from './constants';
import { ammanWeekday } from '../lib/ammanWeekday';

/** Every dial the earn calculation reads. Injectable so tests are deterministic
 *  and so an admin/server-pushed ruleset can replace the compiled defaults. */
export interface EarnRules {
  pointsPerJod: number;
  walletMultiplier: number;
  maxEarnMultiplier: number;
  comboBonusPoints: number;
  /** Additive fraction of the scaled base, by weekday (0=Sun..6=Sat). */
  weekdayBonus: readonly { weekday: number; rate: number }[];
  bonusDay: { enabled: boolean; multiplier: number; weekdays: readonly number[] };
}

export function earnRulesFromConfig(): EarnRules {
  return {
    pointsPerJod: config.POINTS_PER_JOD,
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
  subtotal: number;        // everything, before the ceiling
  cap: number;             // base × maxEarnMultiplier
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

  // Additive bonuses, as fractions of the scaled base.
  const tier = tierFromSpend(Math.max(0, ctx.windowSpend ?? 0));
  const tierBonus = scaled * (tier.multiplier - 1);
  const rate = rules.weekdayBonus.find((w) => w.weekday === weekday)?.rate ?? 0;
  const weekdayBonus = scaled * rate;
  const comboBonus =
    Math.max(0, Math.floor(ctx.comboPairs ?? 0)) * rules.comboBonusPoints;

  // THE CEILING (D1). It is live: with BONUS_BEAN_DAY enabled an activated
  // bonus day reaches wallet 1.5 × bonus-day 2 × (1 + (tier 2.0 - 1) + Friday
  // 0.5) = 7.5× base, so `cap` at 5× binds and trims the grant.
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
