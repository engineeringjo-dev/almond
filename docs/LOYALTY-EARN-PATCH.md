# LOYALTY-EARN-PATCH — the exact patch for the repo's earn path

**Status:** Phase‑0 deliverable. English (code document). Apply without re‑deriving.
**Anchor commit:** `6a88ca3` (2026‑08‑18). Every `file:line` below was read at that commit;
re‑check the anchor line before applying if HEAD has moved.
**Scope:** the earn path only — the eight established defects D1–D8 (see
`IMPL-BRIEF.md` §"Established defects"), plus three additional defects found while
reading the same files (D9–D11, clearly marked as *new*, not part of the established set).

This document contains **no edits** — it is the English specification of the edits.
It is deliberately exact: identifiers, line numbers, before/after blocks, test names
and assertions. Nothing here depends on which loyalty redesign is adopted; these are
bugs under **any** design, except where explicitly parked in §8 "needs a product decision".

---

## 1. Reference numbers used in this document

| Quantity | Value | Source |
|---|---|---|
| Point value | 100 points = 1 JOD (1 point = 1 qirsh) | `config.POINTS_PER_JOD_REDEEM = 100`, BRIEF §1 |
| ⇒ conversion rule | **N points per JOD = N% of the invoice, exactly** | derived from the line above |
| Reference invoice | **7.20 JOD** (measured range 7.16–7.24) | BRIEF §1 |
| Base earn | 5 pts/JOD = **5.0%** of invoice = 0.360 JOD | `config.POINTS_PER_JOD = 5` |
| Net sales | 8.47M JOD/yr | BRIEF §1 |
| Member coverage (assumption) | 35% | PROPOSAL assumption, BRIEF §2 — **not measured** |

Every annualised JOD figure below is marked **(assumption)** and depends on member
coverage and on weekday/pair mix that **only the measurement kit can supply**. The
per‑invoice percentages are arithmetic from the code and are not assumptions.

Menu prices quoted below were read from `packages/shared/src/menu/menu.generated.ts`
(the Talabat export, 267 items) — they are repo facts, not estimates.

---

## 2. Defect table

Severity: **C** = critical (money leaves or a promise breaks today), **H** = high,
**M** = medium.

| ID | File:line | What is wrong | Cost, in % of a 7.20 JOD invoice | Sev |
|---|---|---|---|---|
| **D1** | `packages/shared/src/config/index.ts:21`; guard consumed at `bff/src/earn.ts:20-21` and `almond-app/services/loyalty.service.mock.ts:230-231` | `MAX_EARN_MULTIPLIER: 5` is dead code on the server. The maximum reachable server stack is wallet 1.5 × (1 + (tier 2.0 − 1) + Friday 0.5) = **3.75× base = 18.75%**, against a cap of 5× base = **25%**. The only margin guard in the system never fires. | 0% today; **6.25 pp of unguarded headroom** the guard silently permits. On the client the same constant *does* bind (37.5% → 25%), so the dead cap is also a second divergence axis. | H |
| **D2** | `almond-app/services/loyalty.service.mock.ts:223-224` vs `bff/src/earn.ts:7-21` | Client multiplies the base by `bonusMult` (`config.BONUS_BEAN_DAY`, Tuesday ×2). The server function has **no such parameter and no such input**. On Tuesdays the app grants double and the server would pay single. | Bean, no wallet, Tuesday: client 10.0% vs server 5.0% → **gap 5.0 pp (0.360 JOD)**. Black + wallet, Tuesday, not Friday: client 25.0% (capped) vs server 15.0% → **gap 10.0 pp (0.720 JOD)**. Honouring it costs ≈ **21K JOD/yr (assumption:** 1/7 of invoices are Tuesday, 35% member coverage, all Bean**)**. | **C** |
| **D3** | `bff/src/earn.ts:18-19` and `almond-app/services/loyalty.service.mock.ts:226-227` | Friday `+50%` is hardcoded (`new Date().getDay() === 5`, `× 0.5`) in **both** client and server and appears in **no config key**. Admin cannot turn it off, change the day, or change the rate without a code deploy on two codebases. | Friday, Bean, no wallet: **+2.5 pp (0.180 JOD)**. Friday, Black + wallet: **+3.75 pp (0.270 JOD)**. ≈ **11K JOD/yr (assumption:** 1/7 Friday, 35% coverage, Bean**)**; Fri–Sat is the Jordanian weekend so the true Friday share of invoices is likely **above** 1/7 and must be measured. | H |
| **D4** | `bff/src/earn.ts:21` (`Math.round(Math.min(...)) + opts.comboBonus`) and `almond-app/services/loyalty.service.mock.ts:264-275` | `comboBonus` is added **after** `Math.min(..., cap)`, so the combo bonus is outside the ceiling entirely. It is also **flat per pair and unbounded by basket value**. | 50 pts = 0.500 JOD = **6.9%** of a 7.20 invoice, per pair, uncapped. Measured worst case from the repo menu: 10 × (Mineral Water 0.750 + Cake Pop 1.000) = a **17.50 JOD cart earning 588 points = 5.880 JOD = 33.6%**, of which **500 pts (28.6 pp) escapes the cap by construction**. Upper bound ≈ **205K JOD/yr (assumption:** one pair on every member invoice, 35% coverage — the real pairs‑per‑invoice is unmeasured**)**. | **C** |
| **D5** | `almond-app/services/loyalty.service.mock.ts:137-141` (`beansExpireAt`) and `:146-149` (enforcement in `buildBalance`) | Expiry is inverted: `if (tierId === 'gold' \|\| tierId === 'black') return null` — the **largest** balances never expire; Bean/Silver expire in 12 months. Breakage, the standard liability offset, is set to zero exactly where liability is largest. | Not a per‑invoice cost — a **balance‑sheet** cost: 100% of top‑tier point liability is permanent. Size is unknown until the liability query in the measurement kit runs. | H |
| **D6** | `almond-app/services/spinDefaults.ts:9-20` (prize table) and `:22-31` (`visitsPerSpin: 5`) | No losing slot. Enabled weights sum to 100.0 and **zero** of that weight is a non‑prize ⇒ **P(win) = 100.0%** per spin. | EV recomputed from the repo weights × repo menu prices = **2.583 JOD/spin** (table in §4, D6). At 1 spin / 5 visits = 0.517 JOD/visit = **7.2%** of a 7.20 invoice (IMPL‑BRIEF's established figure: 7.4%; both land in 7.2–7.4%). | **C** |
| **D7** | `packages/shared/src/config/index.ts:51-58`; enforced at `bff/src/backend/memory.ts:88-93` and mirrored at `almond-app/services/loyalty.service.mock.ts:50-60` | The binding cap is **daily** (`drinksPerDay: 2`, `periodDays: 30`) ⇒ up to **60 drinks for 18 JOD**. Pret's unlimited model failed at a 5/day cap. | At the cheapest espresso‑bar drink measured in the repo menu (Hot Americano 2.50): the member breaks even at **7.2 drinks/month** and may take 60 ⇒ **150 JOD of retail for 18 JOD = 88% discount** at the cap. IMPL‑BRIEF's cost‑basis breakeven: ≈21 drinks/month. | **C** |
| **D8** | system‑wide (sum of the above) | Total giveback, lowest tier, weekday, no wallet: points 5% + spin 7.4% + cup 6.0% + combo 6.9% ≈ **25%**; top tier on its best day ≈ **42%**. No single place in the code sums the mechanisms, so no guard can see the total. | ≈25% / ≈42% of invoice against a 65–75% gross margin before rent and labour. | **C** |

### Additional defects found while reading the same files (NOT part of D1–D8)

| ID | File:line | What is wrong | Cost | Sev |
|---|---|---|---|---|
| **D9** *(new)* | `almond-app/services/loyalty.service.mock.ts:162-176` (`computeEligibility`) vs `:284-291` (`spin`) | `computeEligibility` **adds** +1 for a free‑spin day and +1 for an active campaign, but `spin()` only decrements `u.spinsAvailable` (`if (u.spinsAvailable > 0) u.spinsAvailable -= 1;`). On a free‑spin day `canSpin` is therefore **permanently true** ⇒ **unlimited spins**. Latent only because `freeSpinDays: []` and `campaigns: []` today — an admin toggle (§13 admin panel) arms it. | Unbounded: 2.583 JOD **per spin**, uncapped, for every member, all day. | **C** (latent) |
| **D10** *(new)* | `almond-app/services/loyalty.service.mock.ts:135` | `BEAN_EXPIRY_MONTHS * 30 * 86400000` = 360 days, not 12 months. Points expire ~5 days early against what the UI says. | ~1.4% early expiry; a customer‑trust bug, not a margin bug. | M |
| **D11** *(new)* | `almond-app/services/loyalty.service.mock.ts:146-149` | `buildBalance` — reached from `getBalance` — **mutates** state (`u.points = 0`). A read zeroes a balance. Expiry must be an explicit job, not a side effect of a GET. | None directly; makes the expiry rule untestable and order‑dependent. | M |

---

## 3. The structural fix: ONE shared earn function

D2 exists because the earn arithmetic is written **twice**. Fixing the arithmetic in
both places fixes today's divergence and guarantees nothing about tomorrow's. The
structural fix is therefore the centre of this patch, and everything in §4 is
expressed as a consequence of it.

### 3.1 Where it lives

**New file:** `packages/shared/src/loyalty/earn.ts`

Chosen because `@almond/shared` is already the contract between app, website and BFF
(`packages/shared/src/index.ts:1-19`), and all three already import
`@almond/shared/config` and `@almond/shared/loyalty`.

It takes `comboPairs: number` — **not** a `CartItem[]` and not `comboBonusPoints()` —
so that `earn.ts` never imports `lib/combo.ts` → `lib/categoryKind.ts` → `menu/seed`.
The BFF earn path must not pull the 267‑item menu into scope, and the function must
stay pure and trivially testable. Callers already have the cart and call
`comboPairs(items)` themselves.

### 3.2 Signature

```ts
// packages/shared/src/loyalty/earn.ts
import { config } from '../config';
import { tierFromSpend } from './constants';

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
  /** Invoice total in JOD, after discounts, as charged. */
  total: number;
  /** Rolling-12-month qualifying spend in JOD → tier. Guests/web: omit (= 0). */
  windowSpend?: number;
  paidFromBalance?: boolean;
  /** Drink+food pairs, from comboPairs(items) in @almond/shared/lib/combo. */
  comboPairs?: number;
  /** True only when the member ACTIVATED today's bonus day (server-verified). */
  bonusDayActivated?: boolean;
  /** Decision clock. Defaults to now; pass it in tests and in estimates. */
  at?: Date;
}

export interface EarnBreakdown {
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
}

export function computeEarn(ctx: EarnContext, rules?: EarnRules): EarnBreakdown;
export function earnedPoints(ctx: EarnContext, rules?: EarnRules): number;
```

### 3.3 Body — the one place the arithmetic exists

```ts
export function computeEarn(
  ctx: EarnContext,
  rules: EarnRules = earnRulesFromConfig(),
): EarnBreakdown {
  const total = Math.max(0, ctx.total || 0);
  const weekday = (ctx.at ?? new Date()).getDay();

  const base = total * rules.pointsPerJod;

  // Stack factors — multiplicative on the base, exactly as bff/src/earn.ts:15-16
  // and loyalty.service.mock.ts:222-224 do today. Changing this to an additive
  // stack changes the customer offer; see LOYALTY-EARN-PATCH §8.
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

  // Additive bonuses — every one of them, including the combo.
  const tier = tierFromSpend(Math.max(0, ctx.windowSpend ?? 0));
  const tierBonus = scaled * (tier.multiplier - 1);
  const rate = rules.weekdayBonus.find((w) => w.weekday === weekday)?.rate ?? 0;
  const weekdayBonus = scaled * rate;
  const comboBonus =
    Math.max(0, Math.floor(ctx.comboPairs ?? 0)) * rules.comboBonusPoints;

  // THE CEILING — applied last, over everything, combo included (D1 + D4).
  const subtotal = scaled + tierBonus + weekdayBonus + comboBonus;
  const cap = base * rules.maxEarnMultiplier;
  const capApplied = subtotal > cap;
  const points = Math.round(Math.min(subtotal, cap));

  return {
    base, walletBonus, bonusDayBonus, tierBonus, weekdayBonus, comboBonus,
    subtotal, cap, capApplied, points,
    effectiveMultiplier: base > 0 ? points / base : 0,
    tierId: tier.id,
  };
}

export function earnedPoints(ctx: EarnContext, rules?: EarnRules): number {
  return computeEarn(ctx, rules).points;
}
```

**Behavioural delta of this function vs. today's server** (`bff/src/earn.ts`), holding
`BONUS_BEAN_DAY.enabled = false` (see §8.1): the *only* difference is that
`comboBonus` is now inside the ceiling. Every other output is bit‑identical. That is
the property that makes §4's D1/D3/D4 patches shippable without a product decision.

### 3.4 Wiring

`packages/shared/src/loyalty/index.ts` — 1 line, currently:

```ts
export * from './constants';
```
becomes
```ts
export * from './constants';
export * from './earn';
```

`packages/shared/package.json` `exports` — add one subpath next to `"./loyalty"`
(line 17 in the current manifest) so the BFF can import the module directly:

```json
    "./loyalty": "./src/loyalty/index.ts",
    "./loyalty/earn": "./src/loyalty/earn.ts",
```

### 3.5 What each caller becomes

There are **five** call sites that compute or display an earn today. After the patch
exactly one of them contains arithmetic.

| # | Caller | Today | After |
|---|---|---|---|
| 1 | `bff/src/earn.ts` (whole file, 22 lines) | owns the server formula | a 2‑line **re‑export** of the shared function (import path in `routes/checkout.ts` unchanged) |
| 2 | `bff/src/routes/checkout.ts:34,56-58` | `const { items, totals, comboBonus } = reprice(...)`; `computeEarn({ total, windowSpend, paidFromBalance, comboBonus })` | destructures `comboPairs`; calls `computeEarn({ ..., comboPairs })` and grants `earn.points` |
| 3 | `bff/src/pricing.ts:10-14,37` | returns `comboBonus: comboBonusPoints(items)` | returns `comboPairs: comboPairs(items)` (points are `computeEarn`'s job, not pricing's) |
| 4 | `almond-app/services/loyalty.service.mock.ts:215-275` | owns the client formula + adds combo after the cap | calls `computeEarn` once, uses `breakdown.points`, logs the breakdown |
| 5 | `almond-app/lib/earnEstimate.ts` (whole file, 24 lines) | a third, *deliberately different* formula (drops bonus day and Friday "so we never over‑promise") | calls `computeEarn` with the same context ⇒ the checkout estimate **equals** the grant by construction |
| 6 | `almond-web/src/data/order.ts:20-23` + `CheckoutView.tsx:54` + `OrderSuccessView.tsx:43` | `estimatedBeans(total)` = base only, `+ comboBonusPoints(items)` bolted on outside | `estimatedBeans` deleted; both views call `earnedPoints({ total, comboPairs: comboPairs(items) })` |

`almond-app/app/(tabs)/pay.tsx:48` (`config.POINTS_PER_JOD * multiplier`) displays a
*rate*, not an earn. Leave the arithmetic, but it must be added to the divergence
test's allowlist with a comment saying it is a display rate — see §7, test T7.

---

## 4. Per‑defect minimal change

Ordered so the patch applies cleanly top to bottom. Blocks marked **BEFORE** are the
real current file contents at commit `6a88ca3`.

### D1 — the dead cap

The cap is not fixed by changing the number; it is fixed by making it **cover
everything** (D4) and by **testing that it can bind** (§7, T5/T6). Choosing a
different ceiling *value* changes the customer offer → §8.2.

`packages/shared/src/config/index.ts:18-21`

**BEFORE**
```ts
  // Hard ceiling on the total earn multiplier so stacking (wallet × bonus-day ×
  // tier × Friday) can never blow up the margin. E.g. 5 = at most 5× the base
  // (POINTS_PER_JOD × invoice). Admin-configurable.
  MAX_EARN_MULTIPLIER: 5,
```

**AFTER**
```ts
  // Hard ceiling on the TOTAL earn, including the combo bonus (see
  // loyalty/earn.ts — the cap is applied last, over the sum). 5 = at most
  // 5 × POINTS_PER_JOD × invoice = 25% of the invoice in points.
  // NOTE: the maximum stack reachable WITHOUT the combo is
  //   wallet 1.5 × (1 + (tier 2.0 - 1) + weekday 0.5) = 3.75×,
  // so this ceiling only binds on combo-heavy baskets. Lowering it below 3.75
  // changes the customer offer — do not do it as a bug fix. Admin-configurable.
  MAX_EARN_MULTIPLIER: 5,
```

The value is unchanged **on purpose**: the guard becomes live because §3.3 moved
combo inside it, not because the number moved.

### D2 — client/server divergence

Deleted by construction: both sides call `computeEarn`. What remains is the input.
The server has **no record of a bonus‑day activation** — `usePromoStore`
(`almond-app/stores/promoStore.ts:14,30`) is client‑only device state. So:

`bff/src/routes/checkout.ts` — the server passes `bonusDayActivated: false` and says why.

**BEFORE** (lines 56-58)
```ts
      const pointsEarned = computeEarn({
        total: totals.total, windowSpend: member.windowSpend, paidFromBalance, comboBonus,
      });
```

**AFTER**
```ts
      // Bonus-day activation is not yet server-side state (promoStore is on the
      // device). Until POST /v1/promo/bonus-day/activate exists, the server never
      // pays the bonus day — and config.BONUS_BEAN_DAY.enabled is false so the
      // app never promises it either. See docs/LOYALTY-EARN-PATCH.md §8.1.
      const earn = computeEarn({
        total: totals.total,
        windowSpend: member.windowSpend,
        paidFromBalance,
        comboPairs,
        bonusDayActivated: false,
      });
      const pointsEarned = earn.points;
```

and line 34:

**BEFORE**
```ts
    const { items, totals, comboBonus } = reprice(input.lines);
```
**AFTER**
```ts
    const { items, totals, comboPairs } = reprice(input.lines);
```

`bff/src/pricing.ts` — return pairs, not points.

**BEFORE** (lines 3, 10-14, 37)
```ts
import { comboBonusPoints } from '@almond/shared/lib/combo';
...
export function reprice(lines: CheckoutLine[]): {
  items: CartItem[];
  totals: CartTotals;
  comboBonus: number;
};
...
  return { items, totals: computeTotals(items, 0), comboBonus: comboBonusPoints(items) };
```
**AFTER**
```ts
import { comboPairs } from '@almond/shared/lib/combo';
...
export function reprice(lines: CheckoutLine[]): {
  items: CartItem[];
  totals: CartTotals;
  /** Drink+food pairs. Pricing counts pairs; loyalty/earn.ts prices them. */
  comboPairs: number;
};
...
  return { items, totals: computeTotals(items, 0), comboPairs: comboPairs(items) };
```

`bff/src/earn.ts` — the whole 22‑line file becomes:

**AFTER (entire file)**
```ts
/** The server earn is THE shared earn. No arithmetic lives here any more —
 *  it lives in packages/shared/src/loyalty/earn.ts, which the app and the
 *  website import too. Re-exported so import paths do not churn.
 *  See docs/LOYALTY-EARN-PATCH.md §3. */
export {
  computeEarn, earnedPoints, earnRulesFromConfig,
  type EarnContext, type EarnBreakdown, type EarnRules,
} from '@almond/shared/loyalty/earn';
```

`almond-app/services/loyalty.service.mock.ts:215-275` — the client's copy of the
formula is deleted.

**BEFORE** (lines 215-231)
```ts
  earn: ({ userId, invoiceAmount, paidFromBalance, isFriday, bonusMultiplier, comboBonusPoints }: EarnInput) => {
    const u = ensureUser(userId);
    // Tier multiplier uses the rolling-12-month spend (§A).
    const tier = tierFromSpend(rolling12mSpend(u));
    // Pay-from-wallet ×1.5 and an activated bonus-day multiplier both apply to
    // ALL beans BEFORE the tier multiplier; the tier then stacks on top
    // (Wallet spec §1.2). E.g. Gold + wallet + double-day = ×1.5 × ×2 × ×1.5.
    const walletMult = paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1;
    const bonusMult = bonusMultiplier && bonusMultiplier > 1 ? bonusMultiplier : 1;
    const basePoints = invoiceAmount * config.POINTS_PER_JOD * walletMult * bonusMult;
    const tierBonus = basePoints * (tier.multiplier - 1);
    const friday = isFriday ?? new Date().getDay() === 5;
    const fridayBonus = friday ? basePoints * 0.5 : 0;
    // Cap the stacked multiplier so wallet × bonus-day × tier × Friday can never
    // exceed MAX_EARN_MULTIPLIER × the base earn (margin protection).
    const earnCap = invoiceAmount * config.POINTS_PER_JOD * config.MAX_EARN_MULTIPLIER;
    const pointsEarned = Math.round(Math.min(basePoints + tierBonus + fridayBonus, earnCap));
    u.lastEarnAt = Date.now();
```

**AFTER**
```ts
  earn: ({ userId, invoiceAmount, paidFromBalance, at, bonusDayActivated, comboPairs }: EarnInput) => {
    const u = ensureUser(userId);
    // ONE earn calculation, shared with the BFF (packages/shared/src/loyalty/earn.ts).
    // The mock must never re-implement it — see docs/LOYALTY-EARN-PATCH.md §3.
    const earn = computeEarn({
      total: invoiceAmount,
      windowSpend: rolling12mSpend(u),
      paidFromBalance,
      comboPairs,
      bonusDayActivated,
      at,
    });
    const pointsEarned = earn.points;
    u.lastEarnAt = Date.now();
```
with the import at line 15-17 gaining `import { computeEarn } from '@almond/shared/loyalty/earn';`
(`tierFromSpend` stays — it is still used by `buildBalance` at line 145).

`almond-app/services/loyalty.service.ts:18-27` — the input type follows:

**BEFORE**
```ts
export interface EarnInput {
  userId: string;
  invoiceAmount: number;
  paidFromBalance: boolean;
  isFriday?: boolean;
  /** Extra multiplier from an activated bonus-bean day (e.g. 2 = double). */
  bonusMultiplier?: number;
  /** Flat bonus points for drink+food combos in the order (see lib/combo.ts). */
  comboBonusPoints?: number;
}
```
**AFTER**
```ts
export interface EarnInput {
  userId: string;
  invoiceAmount: number;
  paidFromBalance: boolean;
  /** Drink+food pairs from comboPairs(items). The POINTS per pair are the
   *  shared earn function's business, never the caller's. */
  comboPairs?: number;
  /** True only when the member activated today's bonus day. */
  bonusDayActivated?: boolean;
  /** Decision clock (tests / deterministic estimates). */
  at?: Date;
}
```

`almond-app/app/(tabs)/cart.tsx:163-171` — the call site:

**BEFORE**
```ts
      const bonusDay = activeBonusDay();
      const bonusActive = !!bonusDay && usePromoStore.getState().isActivatedToday();
      await loyaltyService.earn({
        userId,
        invoiceAmount: totals.total,
        paidFromBalance: paymentMethod === 'wallet',
        bonusMultiplier: bonusActive ? bonusDay!.multiplier : 1,
        comboBonusPoints: comboBonusPoints(items),
      });
```
**AFTER**
```ts
      await loyaltyService.earn({
        userId,
        invoiceAmount: totals.total,
        paidFromBalance: paymentMethod === 'wallet',
        bonusDayActivated: usePromoStore.getState().isActivatedToday(),
        comboPairs: comboPairs(items),
      });
```
(`activeBonusDay` is still used by `BonusDayBanner.tsx:18-24` for display; the
multiplier is no longer passed through the caller — the shared function reads it.)

### D3 — the hardcoded Friday

Step 1, config: insert a new key **after** the `BONUS_BEAN_DAY` block that ends at
`packages/shared/src/config/index.ts:37`, before `BEAN_EXPIRY_MONTHS` (line 38-41).
The shape deliberately mirrors `WALLET_RELOAD_BONUS` (lines 24-27).

**AFTER (inserted)**
```ts
  // Weekday earn bonus — an ADDITIVE fraction of the (wallet/bonus-day scaled)
  // base, keyed by weekday (0=Sun..6=Sat). This replaces the `getDay() === 5`
  // literal that used to be hardcoded in BOTH bff/src/earn.ts and
  // loyalty.service.mock.ts. Jordan's weekend is Fri-Sat. Empty array = off.
  // Admin-configurable; changing it is a PRODUCT decision, not a deploy.
  WEEKDAY_EARN_BONUS: [
    { weekday: 5, rate: 0.5 }, // Friday +50% — the value that was hardcoded
  ] as { weekday: number; rate: number }[],
```

Value chosen to make the change **behaviour‑neutral**: Friday still pays +50%. Turning
it off is now a config edit and belongs to §8.

Step 2: the two hardcoded sites disappear with the two formulas (see D2's blocks —
`bff/src/earn.ts:18-19` and `loyalty.service.mock.ts:226-227` are inside the deleted
regions). After the patch, `grep -rn "getDay() === 5"` over the repo must return
**zero** hits — that is test T8.

### D4 — the combo escaping the cap

`bff/src/earn.ts:20-21`

**BEFORE**
```ts
  const cap = opts.total * config.POINTS_PER_JOD * config.MAX_EARN_MULTIPLIER;
  return Math.round(Math.min(base + tierBonus + fridayBonus, cap)) + opts.comboBonus;
```
**AFTER** — the whole file is replaced by the re‑export in D2; the ceiling now lives at
`packages/shared/src/loyalty/earn.ts` in the three lines:
```ts
  const subtotal = scaled + tierBonus + weekdayBonus + comboBonus;
  const cap = base * rules.maxEarnMultiplier;
  const points = Math.round(Math.min(subtotal, cap));
```

`almond-app/services/loyalty.service.mock.ts:263-275` — the client's post‑cap addition:

**BEFORE**
```ts
    // Drink + food combo bonus — flat points (not a price discount).
    const combo = comboBonusPoints && comboBonusPoints > 0 ? Math.round(comboBonusPoints) : 0;
    if (combo > 0) {
      u.points += combo;
      u.history.unshift({
        id: genId('log'), deltaPoints: combo,
        reasonAr: 'مكافأة كومبو (مشروب + طعام)',
        reasonEn: 'Combo bonus (drink + food)',
        createdAt: new Date().toISOString(),
      });
    }

    return delay({ pointsEarned: pointsEarned + combo, cup: { ...u.cup }, freeDrinkIssued });
```
**AFTER**
```ts
    // The combo bonus is already INSIDE pointsEarned (it is part of the capped
    // sum in computeEarn). Log it for transparency; never add it again.
    if (earn.comboBonus > 0) {
      u.history.unshift({
        id: genId('log'), deltaPoints: 0,
        reasonAr: `تتضمن مكافأة كومبو (${earn.comboBonus} نقطة)`,
        reasonEn: `Includes combo bonus (${earn.comboBonus} points)`,
        createdAt: new Date().toISOString(),
      });
    }

    return delay({ pointsEarned, cup: { ...u.cup }, freeDrinkIssued });
```
Note `u.points += pointsEarned` at line 234 is unchanged and is now the **only**
place points are credited for an order.

Worked example (the measured worst case from §2, D4): cart = 10 × (Mineral Water
0.750 + Cake Pop 1.000) = 17.50 JOD, Bean, no wallet, Monday, `comboPairs = 10`.
*Before:* `Math.round(Math.min(87.5, 437.5)) + 500` = **588 pts (5.880 JOD, 33.6%)**.
*After:* `Math.round(Math.min(87.5 + 500, 437.5))` = **438 pts (4.380 JOD, 25.0%)** with
`capApplied === true`. The residual 25% is the ceiling doing its job at its current
value — lowering it is §8.2.

### D5 — inverted expiry (**offer‑changing; see §8.3**)

`almond-app/services/loyalty.service.mock.ts:137-141`

**BEFORE**
```ts
/** Top tiers (Gold/Black) never expire; lower tiers expire after inactivity. */
function beansExpireAt(u: LoyaltyUser, tierId: string): string | null {
  if (tierId === 'gold' || tierId === 'black') return null;
  return new Date(u.lastEarnAt + EXPIRY_MS).toISOString();
}
```
**AFTER**
```ts
/** One expiry rule for every tier: points expire EXPIRY_MS after the last
 *  earning activity. The old rule exempted Gold/Black — i.e. it made the
 *  largest balances a permanent liability. See LOYALTY-EARN-PATCH §2 D5. */
function beansExpireAt(u: LoyaltyUser): string | null {
  return new Date(u.lastEarnAt + EXPIRY_MS).toISOString();
}
```
and the enforcement at lines 146-149 (which also fixes **D11**):

**BEFORE**
```ts
  // Enforce gentle expiry: lower tiers lose beans after a long inactivity gap.
  if (tier.id !== 'gold' && tier.id !== 'black' && Date.now() > u.lastEarnAt + EXPIRY_MS) {
    u.points = 0;
  }
```
**AFTER**
```ts
  // NOTE: expiry is an explicit job (expirePoints), never a side effect of a
  // read. buildBalance is called from getBalance — a GET must not mutate.
```
with a new exported `expirePoints(u, now)` the mock's own scheduler/test calls, and,
on the server, the same rule as an Odoo‑side job. Also fix **D10** at line 135:

**BEFORE**
```ts
const EXPIRY_MS = config.BEAN_EXPIRY_MONTHS * 30 * 86400000;
```
**AFTER**
```ts
/** 12 calendar months, not 12 × 30 days (that was 360 days — ~5 days early). */
function expiryAt(from: number): number {
  const d = new Date(from);
  d.setMonth(d.getMonth() + config.BEAN_EXPIRY_MONTHS);
  return d.getTime();
}
```

### D6 — the spin wheel with no losing slot (**offer‑changing; see §8.4**)

EV recomputed from the repo's own weights (`spinDefaults.ts:9-20`, enabled weights
sum to exactly 100) × repo menu prices, valuing each open‑ended prize at the item a
rational customer picks:

| Prize (`id`) | Weight | Value (JOD) | Source of the value | Contribution |
|---|---|---|---|---|
| `credit-1` | 30 | 1.00 | face value | 0.300 |
| `cookie` | 20 | 1.90 | "Cookies" | 0.380 |
| `americano` | 18 | 2.50 | "Hot Americano" | 0.450 |
| `any-drink` | 12 | 4.50 | dearest drink‑kind item ("Cold Brew Concentrate Bottle") | 0.540 |
| `omelette-croissant` | 8 | 2.90 | "Omelette With Croissant" | 0.232 |
| `pasta` | 5 | 4.50 | "Chicken Pasta Salad" | 0.225 |
| `pizza` | 4 | 7.50 | "Burrata Pizza" | 0.300 |
| `credit-5` | 2 | 5.00 | face value | 0.100 |
| `cake` | 0.8 | 4.50 | dearest cake piece ("Gianduja Chocolate Cake Piece") | 0.036 |
| `credit-10` | 0.2 | 10.00 | face value | 0.020 |
| **losing slot** | **0** | — | — | **0** |
| | **100** | | **EV** | **2.583 JOD/spin** |

Minimal change — add the missing slot and let the admin own the odds:

`almond-app/services/spinDefaults.ts:9-20`, **AFTER (inserted as the first entry)**
```ts
  // A wheel with no losing slot has EV = 2.58 JOD/spin (see LOYALTY-EARN-PATCH
  // §4 D6). The weight below is a PLACEHOLDER: the product decision in §8.4
  // sets it, and computeSpinEV() must be re-run and recorded when it changes.
  { id: 'no-win', nameAr: 'حظ أوفر', nameEn: 'Better luck next time', type: 'none', weight: 0, enabled: true, expiryDays: 0, color: colors.warmGray },
```
plus a new exported helper in the same file so the number can never drift from the table:
```ts
/** EV of one spin, in JOD, at the supplied prize values. The admin panel shows
 *  this next to the live odds; the test in §7 T9 asserts a ceiling on it. */
export function computeSpinEV(prizes: SpinPrize[], valueOf: (p: SpinPrize) => number): number {
  const enabled = prizes.filter((p) => p.enabled);
  const total = enabled.reduce((s, p) => s + p.weight, 0) || 1;
  return enabled.reduce((s, p) => s + (p.weight / total) * valueOf(p), 0);
}
```

### D9 *(new)* — unlimited spins on a free‑spin day

`almond-app/services/loyalty.service.mock.ts:284-291`

**BEFORE**
```ts
  spin: (userId) => {
    const u = ensureUser(userId);
    const elig = computeEligibility(u);
    if (!elig.canSpin) return Promise.reject(new Error('No spins available'));

    const { prize, index } = pickWeightedPrize(spinConfig.prizes);
    // Consume a banked spin if any (free-spin-day/campaign grants aren't banked).
    if (u.spinsAvailable > 0) u.spinsAvailable -= 1;
```
**AFTER**
```ts
  spin: (userId) => {
    const u = ensureUser(userId);
    // Grants from a free-spin day / campaign must be CLAIMED into the banked
    // counter exactly once per day, then consumed like any other spin. Without
    // this, canSpin stays true all day and the wheel is unlimited.
    claimDailyGrants(u);
    if (u.spinsAvailable <= 0) return Promise.reject(new Error('No spins available'));

    const { prize, index } = pickWeightedPrize(spinConfig.prizes);
    u.spinsAvailable -= 1;
```
with a new `claimDailyGrants(u)` that credits at most one free‑spin‑day grant and one
campaign grant per `todayKey()`, recorded on the user (`u.grantDay`, `u.grantDayCount`)
— the same day‑key pattern already used at line 49/52.
`computeEligibility` (lines 162-176) then reports `u.spinsAvailable` **after** the same
claim, so eligibility and consumption can never disagree.

### D7 — the daily subscription cap (**offer‑changing; see §8.5**)

`packages/shared/src/config/index.ts:51-58`

**BEFORE**
```ts
  SUBSCRIPTION: {
    enabled: true,
    priceJod: 18,
    drinksPerDay: 2, // hard cap per day
    periodDays: 30,
    labelAr: 'نادي ألموند',
    labelEn: 'Almond Club',
  },
```
**AFTER**
```ts
  SUBSCRIPTION: {
    enabled: true,
    priceJod: 18,
    // The BINDING cap is the monthly one. drinksPerDay only smooths abuse
    // within a day; drinksPerMonth is what bounds the cost of the offer.
    // 18 JOD ÷ 2.50 (cheapest espresso-bar drink on the live menu) = 7.2
    // drinks to break even at RETAIL. See LOYALTY-EARN-PATCH §8.5 for the
    // number the business must choose.
    drinksPerDay: 2,
    drinksPerMonth: 0, // 0 = unlimited ⇒ MUST be set before launch
    periodDays: 30,
    labelAr: 'نادي ألموند',
    labelEn: 'Almond Club',
  },
```

`bff/src/backend/memory.ts:85-95` — the period counter:

**BEFORE**
```ts
      const today = todayKey();
      if (m.subDay !== today) { m.subDay = today; m.subDayCount = 0; }
      if (m.subDayCount >= loyalty.SUBSCRIPTION.drinksPerDay) {
        throw conflict('daily_cap', 'Daily free-drink limit reached');
      }
      m.subDayCount += 1;
```
**AFTER**
```ts
      const today = todayKey();
      if (m.subDay !== today) { m.subDay = today; m.subDayCount = 0; }
      if (m.subDayCount >= loyalty.SUBSCRIPTION.drinksPerDay) {
        throw conflict('daily_cap', 'Daily free-drink limit reached');
      }
      // The cap that actually bounds the offer: per subscription PERIOD.
      const monthly = loyalty.SUBSCRIPTION.drinksPerMonth;
      if (monthly > 0 && m.subPeriodCount >= monthly) {
        throw conflict('monthly_cap', 'Monthly free-drink limit reached');
      }
      m.subDayCount += 1;
      m.subPeriodCount += 1;
```
`m.subPeriodCount` is a new `Member` field reset in `activateSubscription` (i.e. at
renewal), and `SubscriptionState` (`bff/src/backend/types.ts`) gains
`redeemedThisPeriod` / `remainingThisPeriod` so the app can show the real remaining
count. `almond-app/services/loyalty.service.mock.ts:50-60` (`subStateOf`) mirrors it.

### D8 — the total giveback

There is no single edit. What the patch **can** do is make the total observable and
give one mechanism a real ceiling:

1. `computeEarn` returns `effectiveMultiplier` — the points component of giveback is
   now a bounded, asserted number (§7, T6).
2. The other three mechanisms (spin, cup, subscription) are **not** inside that
   ceiling and must never be assumed to be. Add this comment to
   `packages/shared/src/config/index.ts` above `MAX_EARN_MULTIPLIER`:
```ts
  // WARNING: this ceiling bounds POINTS ONLY. The spin wheel (spinDefaults.ts),
  // the cup (CUP_TARGET) and the subscription are separate givebacks with their
  // own costs. Total giveback ≈ 25% of an average invoice at the lowest tier and
  // ≈ 42% at the top — see docs/LOYALTY-EARN-PATCH.md §2 D8. Nothing in the code
  // sums them; the design decision in §8 must.
```

---

## 5. Apply order

1. `packages/shared/src/config/index.ts` — add `WEEKDAY_EARN_BONUS`, comments on `MAX_EARN_MULTIPLIER`, `SUBSCRIPTION.drinksPerMonth`.
2. `packages/shared/src/loyalty/earn.ts` — new file (§3.3).
3. `packages/shared/src/loyalty/index.ts`, `packages/shared/package.json` — wiring (§3.4).
4. `bff/src/earn.ts` → re‑export; `bff/src/pricing.ts` → pairs; `bff/src/routes/checkout.ts` → new call.
5. `almond-app/services/loyalty.service.ts` (`EarnInput`), `…/loyalty.service.mock.ts`, `almond-app/lib/earnEstimate.ts`, `almond-app/app/(tabs)/cart.tsx`.
6. `almond-web/src/data/order.ts` (delete `estimatedBeans`), `CheckoutView.tsx:54`, `OrderSuccessView.tsx:43`.
7. Tests (§7). `npm run typecheck` in `packages/shared`, `almond-web`, `bff`; `npm test --workspace @almond/bff`.

Steps 1–7 are the "safe now" set **provided** `BONUS_BEAN_DAY.enabled` is set to
`false` in the same commit (§8.1). Steps for D5/D6/D7 are held behind §8.

---

## 6. What this patch does NOT do

- It does not touch the live Odoo program. Nothing here writes to production; the
  live configuration is still unverified (see `IMPL-BRIEF.md` §"Why this exists").
- It does not decide the redeem rate, the tier ramp, or whether cash redemption exists.
- It does not annualise any cost without labelling the assumption.
- It does not change `TAX_RATE` — the 8%/16% question (BRIEF §5) is untouched.

---

## 7. Verification — the tests to add

**Location:** `bff/test/earn.test.ts` (new). `bff` is the only workspace with a test
runner configured (`vitest`, `bff/package.json` `"test": "vitest run"`), and it
resolves `@almond/shared` through the npm workspace link, so a test placed here
exercises the shared function that the app imports too. `bff/test/checkout.test.ts`
is the style to copy.

All tests pass an explicit `at:` and an explicit `rules:` where the assertion depends
on a config value, so a later config edit cannot silently change a test's meaning.

```ts
const MON = new Date('2026-09-07T10:00:00Z'); // Monday
const FRI = new Date('2026-09-11T10:00:00Z'); // Friday
const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday (BONUS_BEAN_DAY weekday)
```

| # | Test name | Exact assertion |
|---|---|---|
| **T1** | `earn: base rate is 5 points per JOD (1 point = 1 qirsh)` | `expect(computeEarn({ total: 10, at: MON }).points).toBe(50)` |
| **T2** | `earn: paying from the wallet adds +50% of base` | `expect(computeEarn({ total: 10, paidFromBalance: true, at: MON }).points).toBe(75)` |
| **T3** | `earn: the tier multiplier comes from rolling-window spend` | `expect(computeEarn({ total: 10, windowSpend: 750, at: MON }).tierId).toBe('black')` and `.points).toBe(100)`; and `expect(computeEarn({ total: 10, windowSpend: 99, at: MON }).tierId).toBe('bean')` |
| **T4** | `earn: the weekday bonus is read from config, not from getDay()` | With `rules = { ...base, weekdayBonus: [] }`: `expect(computeEarn({ total: 10, at: FRI }, rules).points).toBe(50)`. With `weekdayBonus: [{ weekday: 5, rate: 0.5 }]`: `expect(computeEarn({ total: 10, at: FRI }, rules).points).toBe(75)` and `expect(computeEarn({ total: 10, at: MON }, rules).points).toBe(50)`. **This is the test that would have made D3 impossible.** |
| **T5** | `earn: the combo bonus is INSIDE the cap (D4)` | The measured worst case: `const r = computeEarn({ total: 17.5, comboPairs: 10, at: MON })`; `expect(r.comboBonus).toBe(500)`; `expect(r.subtotal).toBeCloseTo(587.5, 6)`; `expect(r.cap).toBeCloseTo(437.5, 6)`; `expect(r.capApplied).toBe(true)`; `expect(r.points).toBe(438)`. Add the regression comment: *the pre-patch code returned 588.* |
| **T6** | `earn: total giveback ceiling — no input can exceed MAX_EARN_MULTIPLIER × base` | Exhaustive grid: `total ∈ {0, 0.75, 1.75, 7.2, 17.5, 50}` × `windowSpend ∈ {0, 100, 300, 750}` × `paidFromBalance ∈ {false, true}` × `bonusDayActivated ∈ {false, true}` × `comboPairs ∈ {0, 1, 5, 25}` × weekday 0..6. For every combination: `expect(r.points).toBeLessThanOrEqual(Math.round(r.total * rules.pointsPerJod * rules.maxEarnMultiplier))` and `expect(r.effectiveMultiplier).toBeLessThanOrEqual(rules.maxEarnMultiplier + 1e-9)` (skip the `total === 0` row for the ratio). **This is the giveback-ceiling test.** |
| **T7** | `earn: no module outside @almond/shared/loyalty/earn computes points` | Walk `bff/src`, `almond-app/services`, `almond-app/lib`, `almond-web/src`, `packages/shared/src` for `*.ts`/`*.tsx`; for each file whose source matches `/POINTS_PER_JOD\s*\*/` or `/MAX_EARN_MULTIPLIER/` or `/WALLET_EARN_MULTIPLIER/` or `/COMBO_BONUS_POINTS\s*\*/`, assert its path is in `ALLOWLIST = ['packages/shared/src/config/index.ts', 'packages/shared/src/loyalty/earn.ts', 'packages/shared/src/lib/combo.ts', 'almond-app/app/(tabs)/pay.tsx' /* display rate only */]`. `expect(offenders).toEqual([])` with the failure message: *"earn arithmetic must live in packages/shared/src/loyalty/earn.ts — see docs/LOYALTY-EARN-PATCH.md §3. Offending files: …"*. **This is the test that fails if client and server ever diverge again.** |
| **T8** | `earn: the Friday literal is gone from every codebase` | Same walk as T7: `expect(files.filter(f => /getDay\(\)\s*===\s*5/.test(src))).toEqual([])`. |
| **T9** | `spin: the wheel has a losing slot and a bounded EV` | `const odds = computeOdds(defaultSpinPrizes)`; `expect(odds['no-win']).toBeGreaterThan(0)`; and `expect(computeSpinEV(defaultSpinPrizes, PRIZE_VALUES_JOD)).toBeLessThanOrEqual(SPIN_EV_CEILING_JOD)` where `PRIZE_VALUES_JOD` is the §4 D6 table checked into the test and `SPIN_EV_CEILING_JOD` is the number chosen in §8.4. Until §8.4 is decided the test is written and skipped with `it.todo`, carrying the ceiling as a named constant. |
| **T10** | `checkout: the points the route grants equal computeEarn on the same inputs` | Integration, in `bff/test/checkout.test.ts` style: POST `/v1/checkout` with a known single line and an `Idempotency-Key`; then `const expected = computeEarn({ total: body.total, windowSpend: <member window spend from GET /v1/me>, paidFromBalance: true, comboPairs: 0, at: new Date() }).points`; `expect(body.pointsEarned).toBe(expected)`. Catches the route drifting away from the shared function even though it imports it. |
| **T11** | `spin: a free-spin day grants exactly one spin per day (D9)` | With `__setMockSpinConfig({ ...defaultSpinConfig, eligibility: { ...e, freeSpinDays: [new Date().getDay()] } })`: first `spin()` resolves; second `spin()` **rejects** with `No spins available`; `expect((await getSpinEligibility(u)).spinsAvailable).toBe(0)`. Pre-patch this loops forever. |
| **T12** | `subscription: the monthly cap binds before the daily cap runs out` | With `drinksPerMonth: 20`, redeem 20 drinks across 10 days (2/day), then the 21st `POST /v1/subscription/redeem` returns `409` with `error === 'monthly_cap'`. Skipped (`it.todo`) until §8.5 sets the number. |
| **T13** | `expiry: every tier expires on the same clock (D5)` | `expect(beansExpireAt({ lastEarnAt: T })).toBe(new Date(expiryAt(T)).toISOString())` for a Bean user **and** a Black user — same value. Plus `expect(getBalance(id))` twice in a row returns the same `points` (no read-mutation, D11). Held behind §8.3. |

**Coverage of the defect list by test:** D1 → T5/T6 · D2 → T7/T10 · D3 → T4/T8 ·
D4 → T5 · D5 → T13 · D6 → T9 · D7 → T12 · D8 → T6 (points component only) ·
D9 → T11 · D10/D11 → T13.

---

## 8. Safe now / needs a product decision

### 8.0 Safe now — pure bug fixes, shippable immediately

These change **no customer‑facing number** (with the one stated exception in §8.1)
and are correct under every candidate design:

| Fix | Why it is safe |
|---|---|
| **The shared `computeEarn`** (§3) and all six call sites rewired (§3.5) | Output is bit‑identical to today's server for every input, given §8.1. Divergence becomes structurally impossible; T7 keeps it that way. |
| **D4 — combo moved inside the cap** | The combo bonus was never *intended* to escape the ceiling: `MAX_EARN_MULTIPLIER`'s own comment says "so stacking … can never blow up the margin". This restores the documented intent. It reduces payout only on baskets that were already over the ceiling. |
| **D1 — the dead cap made live** | The number stays at 5. Only its coverage changes (D4). Plus T5/T6 so it can never quietly die again. |
| **D3 — Friday moved into `WEEKDAY_EARN_BONUS`** | Inserted with `rate: 0.5` on weekday 5 = today's exact behaviour. It becomes admin‑controllable instead of deploy‑controllable. |
| **D9 — unlimited spins on a free‑spin day** | Latent bug, no live cost today, no offer change: one grant per day is plainly what the code intends ("free spin every Friday"). |
| **D10 — 360 days ≠ 12 months** | Fixing it is strictly *more generous* by ~5 days and matches what the UI already tells the customer. |
| **D11 — a GET that zeroes a balance** | Moving expiry to an explicit job changes no rule, only when it is evaluated. |

### 8.1 The one coupled decision inside the safe set: `BONUS_BEAN_DAY.enabled`

D2's divergence can be closed in exactly two directions, and the code cannot pick:

- **(a) Cost‑neutral, recommended for this patch.** Set
  `config.BONUS_BEAN_DAY.enabled = false` (`packages/shared/src/config/index.ts:32`)
  in the same commit. The server behaves exactly as today; the app stops promising
  double points. **Cost: 0.** The mechanism stays in the code, fully wired, one flag away.
- **(b) Honour it.** Requires server‑side activation state that does not exist:
  `POST /v1/promo/bonus-day/activate` + a per‑member per‑day record + passing
  `bonusDayActivated` from the token, not the client body (a client‑supplied flag is a
  self‑crediting vector — see BRIEF §2, review point 5). **Cost ≈ 21K JOD/yr
  (assumption:** Tuesdays = 1/7 of invoices, 35% member coverage, all Bean**)**.

Ship (a) with this patch; (b) is a design decision.

### 8.2 Needs a product decision — the ceiling *value*

`MAX_EARN_MULTIPLIER` currently permits 25% of the invoice in points. The maximum
reachable stack without combo is 3.75× (18.75%). Any value below **3.75** starts
taking points away from real customers on Fridays and at Black tier — that is an
offer change, not a bug fix. The design must state the number and the giveback it
implies, together with the D8 stack.

### 8.3 Needs a product decision — expiry (D5)

Inverting the rule *takes points away from Gold and Black members*, which is
precisely the change that produced the Starbucks 2019 and Dunkin' 2022 backlashes
(BRIEF §4). Ship it only with: the chosen window, a notice period, an in‑app
expiry countdown, and the tier‑distribution and liability numbers from the
measurement kit. The code change is one line; the rollout is not.

### 8.4 Needs a product decision — the spin wheel (D6)

Adding a losing slot changes the felt offer. The decision needs: the `no-win` weight
(and therefore the EV ceiling `SPIN_EV_CEILING_JOD` that T9 asserts), whether the
10 JOD credit and the 7.50 pizza stay on the wheel at all, and `visitsPerSpin`.
Until then the wheel pays **2.583 JOD per spin at 100% win probability**.

### 8.5 Needs a product decision — the subscription cap (D7)

Two numbers: `drinksPerMonth` and whether `priceJod: 18` survives it. At retail, 18 JOD
buys 7.2 Americanos; the current cap allows 60. Pret's failure is the cited precedent.
The field is added in §4 D7 with `0` (unlimited, i.e. today's behaviour) so the code
change ships without deciding — but launching on `0` reproduces exactly the failure mode.

### 8.6 Needs a product decision — the additive‑vs‑multiplicative stack

`computeEarn` keeps today's multiplicative composition (wallet ×1.5 × bonus‑day ×2,
then tier and weekday as fractions of that). An additive stack
(1 + 0.5 + 1.0 + …) is the more common industry shape and is materially cheaper at the
top: Black + wallet non‑Friday is 3.0× multiplicative vs 2.5× additive. Changing it is
a one‑line change in §3.3 and a real change to the offer. Not part of this patch.

---

## 9. Reviewer checklist

- [ ] `grep -rn "POINTS_PER_JOD \*" --include=*.ts --include=*.tsx .` returns only `packages/shared/src/loyalty/earn.ts` (+ the `pay.tsx` display rate).
- [ ] `grep -rn "getDay() === 5"` returns nothing.
- [ ] `bff/src/earn.ts` contains no arithmetic.
- [ ] `reprice()` returns `comboPairs`; no caller multiplies pairs by points.
- [ ] `config.BONUS_BEAN_DAY.enabled === false` (or §8.1(b) is fully implemented server‑side).
- [ ] T5, T6, T7 and T8 are present and passing; T9, T12, T13 exist as `it.todo` with their constants named.
- [ ] No production Odoo write is introduced anywhere in the patch.
