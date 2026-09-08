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
| `TAX_RATE` | **0.16** | `packages/shared/src/config/index.ts:42` |

### 1.1 The tax basis — stated once, applied everywhere

**Every `total` in this document is the tax‑INCLUSIVE invoice value**, because that is
what the earn path is actually fed:

```
packages/shared/src/cart/totals.ts:50-52
  const taxable = Math.max(0, subtotal - discount);
  const tax     = taxable * config.TAX_RATE;   // 0.16
  const total   = taxable + tax;

bff/src/routes/checkout.ts:56  →  computeEarn({ total: totals.total, … })
```

Two consequences, both load‑bearing:

1. **A cart of menu prices is not an earn base.** Any worked example below that starts
   from menu prices states the *subtotal*, then the *invoice* it becomes through
   `computeTotals`, and only then the points. A 17.50 JOD sum of menu prices is a
   **20.30 JOD invoice**. Sizing a defect against the menu‑price sum understates the
   base by 16% and does not reproduce against a real checkout.
2. **The reference invoice is assumed tax‑inclusive.** BRIEF §1 derives 7.16–7.24 from
   a figure it labels *net sales*, so this is an assumption, not a measurement, and
   BRIEF §5 lists 8% vs 16% as unresolved. **Sensitivity:** to restate any percentage
   in this document on a *net‑of‑tax* basis, multiply by 1.16 (or by 1.08 if the 8%
   rate is the right one); to restate any annualised JOD figure, the same multiplier
   applies. This matters most in D8, where a giveback measured on the ticket is
   compared against a gross margin measured on net revenue — see §2, D8.

Every annualised JOD figure below is marked **(assumption)** and depends on member
coverage and on weekday/pair mix that **only the measurement kit can supply**. The
per‑invoice percentages are arithmetic from the code and are not assumptions.

Menu prices quoted below were read from `packages/shared/src/menu/menu.generated.ts`
(the Talabat export, 267 items) — they are repo facts, not estimates. Menu prices are
quoted as menu prices and then converted; where a figure is what a customer pays it is
labelled "at the till".

---

## 2. Defect table

Severity: **C** = critical (money leaves or a promise breaks today), **H** = high,
**M** = medium.

| ID | File:line | What is wrong | Cost, in % of a 7.20 JOD invoice | Sev |
|---|---|---|---|---|
| **D1** | `packages/shared/src/config/index.ts:21`; guard consumed at `bff/src/earn.ts:20-21` and `almond-app/services/loyalty.service.mock.ts:230-231` | `MAX_EARN_MULTIPLIER: 5` is dead code on the server. The maximum reachable server stack is wallet 1.5 × (1 + (tier 2.0 − 1) + Friday 0.5) = **3.75× base = 18.75%**, against a cap of 5× base = **25%**. The only margin guard in the system never fires. (With `BONUS_BEAN_DAY` *enabled* the reachable stack is 7.5× — see §8.2.) | 0% today; **6.25 pp of unguarded headroom** the guard silently permits. On the client the same constant *does* bind (37.5% → 25%), so the dead cap is also a second divergence axis. | H |
| **D2** | `almond-app/services/loyalty.service.mock.ts:223-224` vs `bff/src/earn.ts:7-21` | Client multiplies the base by `bonusMult` (`config.BONUS_BEAN_DAY`, Tuesday ×2). The server function has **no such parameter and no such input**. On Tuesdays the app grants double and the server would pay single. | Bean, no wallet, Tuesday: client 10.0% vs server 5.0% → **gap 5.0 pp (0.360 JOD)**. Black + wallet, Tuesday, not Friday: client 25.0% (capped) vs server 15.0% → **gap 10.0 pp (0.720 JOD)**. Honouring it costs **21K–42K JOD/yr (assumption:** Tuesdays = 1/7 of invoices, 35% member coverage; the low end is the all‑Bean gap of 5.0 pp, the high end the top‑tier + wallet gap of 10.0 pp. **The tier mix that resolves the band is a measurement‑kit output — see §8.1.)** | **C** |
| **D3** | `bff/src/earn.ts:18-19` and `almond-app/services/loyalty.service.mock.ts:226-227` | Friday `+50%` is hardcoded (`new Date().getDay() === 5`, `× 0.5`) in **both** client and server and appears in **no config key**. Admin cannot turn it off, change the day, or change the rate without a code deploy on two codebases. | Friday, Bean, no wallet: **+2.5 pp (0.180 JOD)**. Friday, Black + wallet: **+3.75 pp (0.270 JOD)**. ≈ **11K JOD/yr (assumption:** 1/7 Friday, 35% coverage, Bean**)**; Fri–Sat is the Jordanian weekend so the true Friday share of invoices is likely **above** 1/7 and must be measured. | H |
| **D4** | `bff/src/earn.ts:21` (`Math.round(Math.min(...)) + opts.comboBonus`) and `almond-app/services/loyalty.service.mock.ts:264-275` | `comboBonus` is added **after** `Math.min(..., cap)`, so the combo bonus is outside the ceiling entirely. It is also **flat per pair and unbounded by basket value** — a *second, structural* defect that moving it inside the ceiling does **not** fix (§8.8). | 50 pts = 0.500 JOD = **6.9%** of a 7.20 invoice, per pair, uncapped. **Worst case from the repo menu, priced through `computeTotals`:** 10 × (Mineral Water 0.750 + a **zero‑priced** Mother's Day Coffee Cake 0.000) ⇒ subtotal 7.500, tax 1.200, **invoice 8.700 JOD earning 544 points = 5.440 JOD = 62.5% of the invoice** (§4, D4). — **Exposure vs recovery, kept apart:** the ≈**205K JOD/yr** figure (assumption: one pair on every member invoice, 35% coverage) is the exposure of the *flat‑per‑pair design*, **not** what this patch recovers. On the modal member invoice the new ceiling does not bind and **recovery is 0.00 JOD**; the patch recovers only the cap overflow, whose size needs the pairs‑per‑invoice distribution from the measurement kit. | **C** |
| **D5** | `almond-app/services/loyalty.service.mock.ts:137-141` (`beansExpireAt`), `:146-149` (enforcement in `buildBalance`) and `:157` (the only call site) | Expiry is inverted: `if (tierId === 'gold' \|\| tierId === 'black') return null` — the **largest** balances never expire; Bean/Silver expire in 12 months. Breakage, the standard liability offset, is set to zero exactly where liability is largest. | Not a per‑invoice cost — a **balance‑sheet** cost: 100% of top‑tier point liability is permanent. Size is unknown until the liability query in the measurement kit runs. | H |
| **D6** | `almond-app/services/spinDefaults.ts:9-20` (prize table) and `:22-31` (`visitsPerSpin: 5`) | No losing slot. Enabled weights sum to 100.0 and **zero** of that weight is a non‑prize ⇒ **P(win) = 100.0%** per spin. | EV recomputed from the repo weights × repo menu prices = **2.583 JOD/spin** (table in §4, D6). At 1 spin / 5 visits = 0.517 JOD/visit = **7.2%** of a 7.20 invoice (IMPL‑BRIEF's established figure: 7.4%; both land in 7.2–7.4%). | **C** |
| **D7** | `packages/shared/src/config/index.ts:51-58`; enforced at `bff/src/backend/memory.ts:88-93` and mirrored at `almond-app/services/loyalty.service.mock.ts:50-60` | The binding cap is **daily** (`drinksPerDay: 2`, `periodDays: 30`) ⇒ up to **60 drinks for 18 JOD**. Pret's unlimited model failed at a 5/day cap. | At the cheapest espresso‑bar drink measured in the repo menu (Hot Americano, menu **2.50 ⇒ 2.90 at the till**): the member breaks even at **6.2 drinks/month** and may take 60 ⇒ **174 JOD of retail for 18 JOD = 90% discount** at the cap. IMPL‑BRIEF's cost‑basis breakeven: ≈21 drinks/month. | **C** |
| **D8** | system‑wide (sum of the above) | Total giveback, lowest tier, weekday, no wallet: points 5% + spin 7.4% + cup 6.0% + combo 6.9% ≈ **25%**; top tier on its best day ≈ **42%**. No single place in the code sums the mechanisms, so no guard can see the total. | ≈25% / ≈42% **of the tax‑inclusive invoice**. The 65–75% gross margin it is usually set against is measured on **net** revenue, so the two are not like for like: restated on the net basis at `TAX_RATE = 0.16` the giveback is ≈**29% / ≈49%** of net revenue (§1.1). If the 8% rate is the right one, ≈27% / ≈45%. | **C** |

### Additional defects found while reading the same files (NOT part of D1–D8)

| ID | File:line | What is wrong | Cost | Sev |
|---|---|---|---|---|
| **D9** *(new)* | `almond-app/services/loyalty.service.mock.ts:162-176` (`computeEligibility`) vs `:284-291` (`spin`) | `computeEligibility` **adds** +1 for a free‑spin day and +1 for an active campaign, but `spin()` only decrements `u.spinsAvailable` (`if (u.spinsAvailable > 0) u.spinsAvailable -= 1;`). On a free‑spin day `canSpin` is therefore **permanently true** ⇒ **unlimited spins**. Latent only because `freeSpinDays: []` and `campaigns: []` today — an admin toggle (§13 admin panel) arms it. | Unbounded: 2.583 JOD **per spin**, uncapped, for every member, all day. | **C** (latent) |
| **D10** *(new)* | `almond-app/services/loyalty.service.mock.ts:135` | `BEAN_EXPIRY_MONTHS * 30 * 86400000` = 360 days, not 12 months. Points expire ~5 days early against what the UI says. | ~1.4% early expiry; a customer‑trust bug, not a margin bug. | M |
| **D11** *(new)* | `almond-app/services/loyalty.service.mock.ts:146-149` | `buildBalance` — reached from `getBalance` — **mutates** state (`u.points = 0`). A read zeroes a balance. Expiry must be an explicit job, not a side effect of a GET. **`:148` is the only place in the whole repo where points ever expire** (verified by grep across the mock and `bff/src/backend/memory.ts`), so removing it without replacing it silently switches expiry off. | None directly, *provided the enforcement moves rather than disappearing*; makes the expiry rule untestable and order‑dependent. | M |

### 2.1 A menu defect this work uncovered — not a loyalty defect, but it sets the worst case

30 of the 267 items in `packages/shared/src/menu/menu.generated.ts` have a maximum size
price of **0.00 JOD** (the seven Mother's Day cakes, three gluten‑free ma'moul, the
pizzas, and others). All 30 classify as `itemKind === 'food'`
(`packages/shared/src/lib/categoryKind.ts:49`), and none of them carries an `inStock`
field — `bff/src/pricing.ts:19` rejects only `item.inStock === false`, so **all 30
reprice successfully on the server**.

This is what makes the D4 worst case what it is: a zero‑priced food item manufactures a
combo pair at zero marginal revenue. It is also, independently of loyalty, a **free‑order
vector** — a cart of nothing but these items totals 0.00 JOD and passes checkout.

Two actions, neither of them part of this patch:
- Raise the 30 rows with whoever owns the Talabat export (they are almost certainly
  "price on request" items that lost their price in the export).
- Add a `price > 0` guard to `reprice()` alongside the `inStock` check.

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

Two more small shared modules land with it, for reasons given where they are used:

- `packages/shared/src/lib/ammanWeekday.ts` — **one** definition of "which day is it"
  (§3.6). Without it the shared earn function reads the weekday from whichever machine
  calls it, which reopens D2 on exactly the dial D3 makes admin‑controllable.
- `packages/shared/src/loyalty/expiry.ts` — the pure expiry arithmetic (§4, D10), so
  the rule has a test that does not depend on the Expo app's module resolution.

### 3.2 Signature

```ts
// packages/shared/src/loyalty/earn.ts
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
  /** True only when the member ACTIVATED today's bonus day (server-verified). */
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
  // NOT Date#getDay(): that is host-local, and the BFF, the phone and the till
  // are not on the same clock. One business day, defined once — see §3.6.
  const weekday = ammanWeekday(ctx.at ?? new Date());

  const base = total * rules.pointsPerJod;

  // Stack factors — multiplicative on the base, exactly as bff/src/earn.ts:15-16
  // and loyalty.service.mock.ts:222-224 do today. Changing this to an additive
  // stack changes the customer offer; see LOYALTY-EARN-PATCH §8.6.
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
    total,
    base, walletBonus, bonusDayBonus, tierBonus, weekdayBonus, comboBonus,
    subtotal, cap, capApplied, points,
    effectiveMultiplier: base > 0 ? points / base : 0,
    tierId: tier.id,
    weekday,
  };
}

export function earnedPoints(ctx: EarnContext, rules?: EarnRules): number {
  return computeEarn(ctx, rules).points;
}
```

**Behavioural delta of this function vs. today's server** (`bff/src/earn.ts`), holding
`BONUS_BEAN_DAY.enabled = false` (see §8.1): two differences, and both of them **change
granted points for real members**, so neither is a pure refactor.

1. `comboBonus` is now **inside** the ceiling (D4). On combo baskets below a
   tier‑dependent invoice threshold this **reduces** the grant. It is not true that the
   ceiling "only trims baskets that were already over it" — pre‑patch **no** basket was
   ever over it (that is D1). Worked numbers, who loses, and the gate this needs are in
   §8.7. **D4 is therefore NOT in the safe‑now set.**
2. The weekday is read from an Amman‑anchored clock, not the host clock (§3.6). Around
   the Thursday/Friday boundary this changes the grant for some invoices — in the
   direction of *matching what the app displayed*, which is the point.

Every other output is bit‑identical to today's server.

### 3.4 Wiring

`packages/shared/src/loyalty/index.ts` — 1 line, currently:

```ts
export * from './constants';
```
becomes
```ts
export * from './constants';
export * from './earn';
export * from './expiry';
```

`packages/shared/package.json` `exports` — add the subpaths next to `"./loyalty"`
(line 17 in the current manifest) so the BFF can import the modules directly:

```json
    "./loyalty": "./src/loyalty/index.ts",
    "./loyalty/earn": "./src/loyalty/earn.ts",
    "./loyalty/expiry": "./src/loyalty/expiry.ts",
    "./lib/ammanWeekday": "./src/lib/ammanWeekday.ts",
```

### 3.5 What each caller becomes

There are **six** call sites that compute or display an earn today. After the patch
exactly one of them contains arithmetic.

| # | Caller | Today | After |
|---|---|---|---|
| 1 | `bff/src/earn.ts` (whole file, 22 lines) | owns the server formula | a 2‑line **re‑export** of the shared function (import path in `routes/checkout.ts` unchanged) |
| 2 | `bff/src/routes/checkout.ts:34,56-58` | `const { items, totals, comboBonus } = reprice(...)`; `computeEarn({ total, windowSpend, paidFromBalance, comboBonus })` | destructures `comboPairs`; calls `computeEarn({ ..., comboPairs })`, grants `earn.points`, and **persists the breakdown on the order record** (§5b) |
| 3 | `bff/src/pricing.ts:10-14,37` | returns `comboBonus: comboBonusPoints(items)` | returns `comboPairs: comboPairs(items)` (points are `computeEarn`'s job, not pricing's) |
| 4 | `almond-app/services/loyalty.service.mock.ts:215-275` | owns the client formula + adds combo after the cap | calls `computeEarn` once, uses `breakdown.points`, logs the breakdown |
| 5 | `almond-app/lib/earnEstimate.ts` (whole file, 24 lines) | a third, *deliberately different* formula (drops bonus day and Friday "so we never over‑promise") | calls `computeEarn` with the same context ⇒ the checkout estimate **equals** the grant by construction |
| 6 | `almond-web/src/data/order.ts:20-23` + `CheckoutView.tsx:54` + `OrderSuccessView.tsx:43` | `estimatedBeans(total)` = base only, `+ comboBonusPoints(items)` bolted on outside | `estimatedBeans` deleted; both views call `earnedPoints({ total, comboPairs: comboPairs(items) })` |

**Row 5 is not behaviour‑neutral and must not be shipped as if it were.**
`almond-app/lib/earnEstimate.ts:5-11` today *deliberately* omits the Friday bonus, with
the comment "intentionally excluded so we never over‑promise". Routing it through
`computeEarn` with the real context adds Friday back: on a Bean 7.20 JOD Friday basket
the number shown at the moment of payment moves **36 → 54 points (+50%)**. That is a
change to the promise the app makes at checkout — a marketing decision, not a bug fix.
It is parked in **§8.9**; the estimate may alternatively be shipped with an explicit
`weekdayBonus: []` rules override until §8.9 is decided, which keeps today's displayed
number *and* keeps the arithmetic in one place.

`comboBonusPoints` in `packages/shared/src/lib/combo.ts:26-28` has **no callers left**
after this patch (`cart.tsx:170`, `earnEstimate.ts:23`, `CheckoutView.tsx:54` and
`OrderSuccessView.tsx:43` are all rewired) and is **deleted**. Only `comboPairs` stays.
`almond-app/lib/combo.ts` is a one‑line re‑export and needs no change.

`almond-app/app/(tabs)/pay.tsx:48` (`config.POINTS_PER_JOD * (balance?.multiplier ?? 1)`)
displays a **rate**, not an earn — there is no invoice in it. The arithmetic stays, but
the line gets an inline exemption marker that T7 reads:

```ts
// earn-arith-exempt: display rate only — no invoice, no grant. §3.5 / §7 T7.
const earnRate = config.POINTS_PER_JOD * (balance?.multiplier ?? 1);
```

The same marker goes on `almond-web/src/components/cart/ComboBanner.tsx:23`
(`config.COMBO_BONUS_POINTS` shown as an upsell label). See §7, T7, for why the
exemption is per‑line and not per‑file.

### 3.6 One business day: `ammanWeekday`

The repo currently holds **three** incompatible answers to "what day is it":

- `bff/src/earn.ts:18` and `loyalty.service.mock.ts:227` — `new Date().getDay()`, host‑local.
- `almond-app/services/loyalty.service.mock.ts:49` — `new Date().toISOString().slice(0,10)`, UTC.
- `bff/src/backend/memory.ts:88` — the same UTC key, for the subscription cap.

Amman is UTC+3. A BFF running in UTC rolls over to Friday at **03:00 Amman**; a
traveller's phone rolls over somewhere else again. If `computeEarn` reads the caller's
clock, then between 21:00 and 03:00 the app promises a Friday +50% the server does not
pay, or the reverse — **the D2 failure mode, reintroduced on the one dial D3 is about
to expose to admins.**

**New file:** `packages/shared/src/lib/ammanWeekday.ts`

```ts
/** THE definition of "which business day is this" for the whole system.
 *  Asia/Amman, not the host clock. Every weekday-sensitive rule — the earn
 *  weekday bonus, the bonus day, the daily subscription cap, the free-spin day
 *  — must go through this module or its ammanDayKey() sibling.
 *  See docs/LOYALTY-EARN-PATCH.md §3.6. */
const AMMAN = 'Asia/Amman';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ammanWeekday(at: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: AMMAN, weekday: 'short',
  }).format(at);
  return WD.indexOf(short);
}

/** 'YYYY-MM-DD' in Amman — replaces the UTC todayKey() at mock:49 and memory.ts:88. */
export function ammanDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AMMAN, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}
```

`Intl` with a named time zone is available in Node 20+ (the BFF runs on Node 22 per
`@types/node ^22`) and in Hermes with `jsc-intl`/`hermes-intl`, which Expo SDK 51+
ships by default. If the Expo build in use turns Intl off, the fallback is a fixed
`UTC+3` offset — Jordan abolished DST in 2022, so a fixed offset is correct today and
the helper is the single place to revisit if that changes.

Also replaced by `ammanDayKey`: `loyalty.service.mock.ts:49` (`todayKey`) and
`bff/src/backend/memory.ts:88`. Test T14 asserts client and server agree across the
Thursday/Friday boundary.

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
  // NOTE: the maximum stack reachable WITHOUT the combo DEPENDS ON BONUS_BEAN_DAY:
  //   BONUS_BEAN_DAY.enabled = false → wallet 1.5 × (1 + (tier 2.0 - 1) + weekday 0.5)
  //                                  = 3.75×, so this ceiling binds only on
  //                                    combo-heavy baskets;
  //   BONUS_BEAN_DAY.enabled = true  → × bonus-day 2 = 7.5×, so this ceiling binds
  //                                    on an ORDINARY top-tier basket on a bonus day.
  // Lowering it below the reachable stack changes the customer offer — do not do
  // it as a bug fix. See LOYALTY-EARN-PATCH §8.2. Admin-configurable.
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
        total: totals.total,          // tax-inclusive, per §1.1
        windowSpend: member.windowSpend,
        paidFromBalance,
        comboPairs,
        bonusDayActivated: false,
      });
      const pointsEarned = earn.points;
      // The whole breakdown is persisted on the order (§5b) so a grant can be
      // re-derived and the shadow delta reconstructed after the fact.
      await backend.recordEarnBreakdown(order.id, earn);
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
    // Expiry runs BEFORE the grant, explicitly — never as a side effect of a
    // read (D11). See the D10/D11 block below.
    expirePoints(u, Date.now());
    // ONE earn calculation, shared with the BFF (packages/shared/src/loyalty/earn.ts).
    // The mock must never re-implement it — see docs/LOYALTY-EARN-PATCH.md §3.
    const earn = computeEarn({
      total: invoiceAmount,   // tax-inclusive, per §1.1
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
  /** Tax-INCLUSIVE invoice total, i.e. computeTotals(...).total. See §1.1. */
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
multiplier is no longer passed through the caller — the shared function reads it.
The import at `cart.tsx:39` changes from `comboBonusPoints` to `comboPairs`.)

### D3 — the hardcoded Friday

Step 1, config: insert a new key **after** the `BONUS_BEAN_DAY` block that ends at
`packages/shared/src/config/index.ts:37`, before `BEAN_EXPIRY_MONTHS` (line 38-41).
The shape deliberately mirrors `WALLET_RELOAD_BONUS` (lines 24-27).

**AFTER (inserted)**
```ts
  // Weekday earn bonus — an ADDITIVE fraction of the (wallet/bonus-day scaled)
  // base, keyed by weekday (0=Sun..6=Sat) IN AMMAN (see lib/ammanWeekday.ts,
  // LOYALTY-EARN-PATCH §3.6 — never the host clock). This replaces the
  // `getDay() === 5` literal that used to be hardcoded in BOTH bff/src/earn.ts
  // and loyalty.service.mock.ts. Jordan's weekend is Fri-Sat. Empty array = off.
  // Admin-configurable; changing it is a PRODUCT decision, not a deploy.
  WEEKDAY_EARN_BONUS: [
    { weekday: 5, rate: 0.5 }, // Friday +50% — the value that was hardcoded
  ] as { weekday: number; rate: number }[],
```

Value chosen to make the **server grant** behaviour‑neutral: Friday still pays +50%.
Turning it off is now a config edit and belongs to §8. (The *displayed estimate* is a
different matter — see §3.5 row 5 and §8.9.)

Step 2: the two hardcoded sites disappear with the two formulas (see D2's blocks —
`bff/src/earn.ts:18-19` and `loyalty.service.mock.ts:226-227` are inside the deleted
regions). After the patch, `grep -rn "getDay() === 5"` over the repo must return
**zero** hits — that is test T8.

### D4 — the combo escaping the cap (**offer‑changing; see §8.7**)

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

#### Worked examples — every figure routed through `computeTotals`

<!-- RESOLUTION (two findings met here): the worst case must be (a) priced through
     computeTotals rather than read off the menu-price sum, and (b) built from the
     zero-priced food rows that §2.1 documents. Both are applied: the primary
     example is the zero-priced pair, the secondary is the original priced pair,
     and both state subtotal → invoice → points. -->

**Primary — the true worst case** (zero‑priced food, §2.1). Cart = 10 × Mineral Water
0.750 + 10 × Mother's Day Coffee Cake 0.000, Bean, no wallet, Monday.
`computeTotals`: subtotal **7.500**, discount 0, tax **1.200**, **invoice 8.700**.
`base = 43.5`, `cap = 217.5`, `comboPairs = 10 ⇒ comboBonus = 500`.
*Before:* `Math.round(Math.min(43.5, 217.5)) + 500` = **544 pts (5.440 JOD, 62.5% of the
invoice)**.
*After:* `Math.round(Math.min(543.5, 217.5))` = **217 pts (2.170 JOD, 25.0%)** with
`capApplied === true`. (217, not 218: `8.7 * 25` is `217.49999999999997` in IEEE‑754 —
which is why T5b asserts against `r.cap` and not a hand‑computed literal.)

**Secondary — priced pair.** Cart = 10 × (Mineral Water 0.750 + Cake Pop 1.000), Bean,
no wallet, Monday. `computeTotals`: subtotal **17.500**, tax **2.800**, **invoice 20.300**.
`base = 101.5`, `cap = 507.5`, `comboBonus = 500`.
*Before:* `Math.round(Math.min(101.5, 507.5)) + 500` = **602 pts (6.020 JOD, 29.7%)**, of
which the 500 combo points — **5.000 JOD = 24.6 pp of the invoice** — escaped the cap by
construction.
*After:* `Math.round(Math.min(601.5, 507.5))` = **508 pts (5.080 JOD, 25.0%)** with
`capApplied === true`.

The residual 25% is the ceiling doing its job at its current value — lowering it is
§8.2. **Who else this ceiling now trims, and the gate it needs, is §8.7.**

### D5 — inverted expiry (**offer‑changing; see §8.3**)

<!-- RESOLUTION (two findings met here): D5 as originally written both (a) shipped
     the offer-changing part inside the safe set and (b) deleted the only expiry
     enforcement in the repo while leaving EXPIRY_MS referenced at two sites the
     safe set did not touch. The block is therefore split in two. The SAFE-NOW part
     (D10 + D11, below) retires EXPIRY_MS at all three sites in one commit AND keeps
     today's rule enforced, including the Gold/Black exemption. The OFFER-CHANGING
     part — removing that exemption — is this block, and only this block, is gated. -->

**This block is the §8.3‑gated part only: dropping the Gold/Black exemption.** It
applies *on top of* the safe‑now D10/D11 block below, which must land first.

`almond-app/services/loyalty.service.mock.ts:137-141`, `:157`, and `expirePoints`.

**BEFORE** (after the D10/D11 block has landed)
```ts
/** Top tiers (Gold/Black) never expire; lower tiers expire after inactivity. */
function beansExpireAt(u: LoyaltyUser, tierId: string): string | null {
  if (tierId === 'gold' || tierId === 'black') return null;
  return new Date(expiryAt(u.lastEarnAt)).toISOString();
}
```
**AFTER**
```ts
/** One expiry rule for every tier: points expire EXPIRY after the last
 *  earning activity. The old rule exempted Gold/Black — i.e. it made the
 *  largest balances a permanent liability. See LOYALTY-EARN-PATCH §2 D5. */
function beansExpireAt(u: LoyaltyUser): string | null {
  return new Date(expiryAt(u.lastEarnAt)).toISOString();
}
```

The arity changes, so **the only call site changes with it** — line 157, inside
`buildBalance`'s return object (without this the commit fails `tsc` with
TS2554: Expected 1 arguments, but got 2):

**BEFORE**
```ts
    beansExpireAt: beansExpireAt(u, tier.id),
```
**AFTER**
```ts
    beansExpireAt: beansExpireAt(u),
```

and the same exemption comes out of `expirePoints`:

**BEFORE**
```ts
  const tier = tierFromSpend(rolling12mSpend(u));
  // TODAY'S RULE, unchanged: Gold/Black are exempt. Removing this exemption is
  // the offer change held behind LOYALTY-EARN-PATCH §8.3.
  if (tier.id === 'gold' || tier.id === 'black') return 0;
```
**AFTER**
```ts
  // One clock for every tier (§8.3 decision, shipped with notice + countdown).
```

### D10 + D11 *(new)* — 360 days ≠ 12 months, and a GET that zeroes a balance

**These two ship together, and they ship together with the enforcement move**, because
`EXPIRY_MS` is referenced at three sites and no subset of them compiles alone:
`:135` (declaration), `:140` (`beansExpireAt`) and `:147` (`buildBalance`). This block
retires all three and **keeps today's expiry rule enforced, unchanged** — only *when*
it is evaluated moves.

Step 1 — the pure arithmetic goes to shared so it has a runner‑independent test (§7):

**New file** `packages/shared/src/loyalty/expiry.ts`
```ts
import { config } from '../config';

/** 12 CALENDAR months from `from`, not 12 × 30 days (that was 360 days — ~5
 *  days early against what the UI promises). See LOYALTY-EARN-PATCH §2 D10. */
export function expiryAt(from: number, months = config.BEAN_EXPIRY_MONTHS): number {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function isExpired(lastEarnAt: number, now: number, months?: number): boolean {
  return now > expiryAt(lastEarnAt, months);
}
```

Step 2 — `almond-app/services/loyalty.service.mock.ts:135`

**BEFORE**
```ts
const EXPIRY_MS = config.BEAN_EXPIRY_MONTHS * 30 * 86400000;
```
**AFTER**
```ts
import { expiryAt, isExpired } from '@almond/shared/loyalty/expiry';

/** Expiry is an EXPLICIT operation, never a side effect of a read (D11).
 *  Returns the points destroyed, so a caller/test can assert it happened.
 *  The RULE is unchanged here — Gold/Black are still exempt; removing that
 *  exemption is the offer change in §8.3. */
export function expirePoints(u: LoyaltyUser, now = Date.now()): number {
  const tier = tierFromSpend(rolling12mSpend(u));
  // TODAY'S RULE, unchanged: Gold/Black are exempt. Removing this exemption is
  // the offer change held behind LOYALTY-EARN-PATCH §8.3.
  if (tier.id === 'gold' || tier.id === 'black') return 0;
  if (!isExpired(u.lastEarnAt, now)) return 0;
  const lost = u.points;
  u.points = 0;
  return lost;
}
```

Step 3 — `:140`, inside `beansExpireAt`, loses the last `EXPIRY_MS` reference:

**BEFORE**
```ts
  return new Date(u.lastEarnAt + EXPIRY_MS).toISOString();
```
**AFTER**
```ts
  return new Date(expiryAt(u.lastEarnAt)).toISOString();
```

Step 4 — `:146-149`, the mutation inside `buildBalance`, is deleted:

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

Step 5 — **and expiry is then actually run**, at the two points that previously relied
on the side effect, plus the scheduler:

```ts
  getBalance: (userId) => {
    const u = ensureUser(userId);
    expirePoints(u, Date.now());   // explicit, before the response is built
    return delay(buildBalance(userId, u));
  },
```
and in `earn` (shown in the D2 block above). On the server the same rule becomes an
Odoo‑side scheduled job; that job is out of scope here and is named in §5b as a
prerequisite for the Odoo cutover, not for this patch.

**Why the enforcement move is not free:** `:148` was the only place in the entire repo
where points ever expire (verified by grep across the mock and
`bff/src/backend/memory.ts`). Deleting it and deferring to "a scheduler someone will
write" would make every Bean/Silver balance as permanent as the Gold/Black balances D5
rates an H‑severity balance‑sheet liability. Test **T15** asserts a stale Bean balance
actually reaches 0 — T13 alone does not detect that expiry stopped happening.

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

(Values are **menu prices** — the cost to the business of handing over the item, not a
tax‑inclusive till price. That is the right basis for an EV, and it is a different
basis from the invoice percentages in §1.1; the two are not added anywhere.)

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
campaign grant per `ammanDayKey()` (§3.6), recorded on the user (`u.grantDay`,
`u.grantDayCount`) — the same day‑key pattern already used at line 49/52.
`computeEligibility` (lines 162-176) then reports `u.spinsAvailable` **after** the same
claim, so eligibility and consumption can never disagree. The free‑spin‑day check at
`:166` moves from `today.getDay()` to `ammanWeekday(today)` for the same reason as D3.

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
    // 18 JOD ÷ 2.90 (Hot Americano, the cheapest espresso-bar drink on the live
    // menu: 2.50 menu price + 16% tax) = 6.2 drinks to break even AT RETAIL.
    // See LOYALTY-EARN-PATCH §8.5 for the number the business must choose.
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
      const today = ammanDayKey();   // §3.6 — one business day, not UTC
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
   now a bounded, asserted number (§7, T6) — and the whole `EarnBreakdown` is
   **persisted on the order record** (§5b), which is what actually makes the total
   observable after the fact. A return value nothing writes down observes nothing.
2. The other three mechanisms (spin, cup, subscription) are **not** inside that
   ceiling and must never be assumed to be. Add this comment to
   `packages/shared/src/config/index.ts` above `MAX_EARN_MULTIPLIER`:
```ts
  // WARNING: this ceiling bounds POINTS ONLY. The spin wheel (spinDefaults.ts),
  // the cup (CUP_TARGET) and the subscription are separate givebacks with their
  // own costs. Total giveback ≈ 25% of an average TAX-INCLUSIVE invoice at the
  // lowest tier and ≈ 42% at the top — ≈ 29% / ≈ 49% restated on net revenue,
  // which is the basis the 65-75% gross margin is measured on. See
  // docs/LOYALTY-EARN-PATCH.md §2 D8 and §1.1. Nothing in the code sums them;
  // the design decision in §8 must.
```

---

## 5. Apply order

**Step 0 (prerequisite, no behaviour change).** `almond-app` has no test runner
(`"lint": "tsc --noEmit"` is its only check), so four of the tests below have nowhere
to run. Add `vitest` to `almond-app/devDependencies`, an `almond-app/vitest.config.ts`
resolving the `@/` alias to the app root (the alias Metro resolves and that
`loyalty.service.mock.ts:11,14,15,18` depends on), and `"test": "vitest run"` to its
scripts. Export `beansExpireAt` and `expirePoints` from the mock. **T11, T13 and T15
live in `almond-app/test/`; everything else lives in `bff/test/`.** See §7.

1. `packages/shared/src/lib/ammanWeekday.ts` — new file (§3.6); repoint
   `loyalty.service.mock.ts:49` and `bff/src/backend/memory.ts:88` at `ammanDayKey`.
2. `packages/shared/src/config/index.ts` — add `WEEKDAY_EARN_BONUS`, comments on
   `MAX_EARN_MULTIPLIER`, `SUBSCRIPTION.drinksPerMonth`.
3. `packages/shared/src/loyalty/earn.ts` — new file (§3.3).
4. `packages/shared/src/loyalty/expiry.ts` — new file (§4, D10/D11).
5. `packages/shared/src/loyalty/index.ts`, `packages/shared/package.json` — wiring (§3.4).
6. `bff/src/earn.ts` → re‑export; `bff/src/pricing.ts` → pairs;
   `bff/src/routes/checkout.ts` → new call + persist the breakdown;
   `bff/src/backend/*` → `recordEarnBreakdown`, `subPeriodCount`.
7. `almond-app/services/loyalty.service.ts` (`EarnInput`), `…/loyalty.service.mock.ts`
   (earn body, `comboBonusPoints` → `comboPairs`), `almond-app/lib/earnEstimate.ts`,
   `almond-app/app/(tabs)/cart.tsx`; the `earn-arith-exempt` marker on `pay.tsx:48`.
8. **D10 + D11 as one unit** (§4): `expiryAt`/`isExpired` in shared, `expirePoints`
   exported from the mock, `:140` rewritten, the `:146-149` mutation deleted,
   `expirePoints` called from `getBalance` and from `earn`. This is the step that
   retires `EXPIRY_MS` at all three sites; nothing here changes the expiry *rule*.
9. `almond-web/src/data/order.ts` (delete `estimatedBeans`), `CheckoutView.tsx:54`,
   `OrderSuccessView.tsx:43`; delete `comboBonusPoints` from
   `packages/shared/src/lib/combo.ts`; the `earn-arith-exempt` marker on
   `ComboBanner.tsx:23`.
10. Tests (§7). `npm run typecheck` in `packages/shared`, `almond-web`, `bff`;
    `npm test --workspace @almond/bff`; `npm test --workspace almond-app`.

Steps 0–10 are the **"safe now" set** provided `BONUS_BEAN_DAY.enabled` is set to
`false` in the same commit (§8.1) and provided the D4 ceiling change is either held
back or shipped under §8.7's gate — **D4 is not a free bug fix and is not in the safe
set**. Steps for D5, D6 and D7 are held behind §8.

## 5b. How this is rolled out, and how it is undone

The safe set still changes granted points (D4, if included), the number the app shows
at checkout (§3.5 row 5 / §8.9), and — if §8.1(a) is taken — withdraws a live
advertised promotion. None of that may ship without a way back.

**Shadow first.** Add `config.EARN_SHADOW_MODE: true`. While it is on,
`bff/src/routes/checkout.ts` computes **both** formulas — the pre‑patch one (kept as
`bff/src/earn.legacy.ts`, deleted when shadow ends) and `computeEarn` — **grants the
legacy number**, and writes both plus the full `EarnBreakdown` to the order record.
Run for one full billing cycle.

**What to watch, in numbers.** From the shadow records, daily:
- share of member invoices where `new < legacy` (the D4 population, §8.7);
- the 95th percentile and the maximum of `legacy − new`, in points, per member;
- share of invoices where `capApplied === true`;
- distribution of `comboPairs` per invoice — this is also the missing input for §8.7
  and §8.8, and it is cheaper to collect here than to model.

**Abort triggers, decided before the flag flips** (fill the two numbers from the first
week of shadow data, do not guess them here):
- revert if more than **X%** of member invoices show a negative delta, or
- revert if any single member loses more than **Y** points on one invoice, or
- revert on any mismatch between the app's displayed estimate and the granted number
  (that is the D2 class of bug; T10 and T14 should have caught it pre‑merge).

**The revert.** Flipping `EARN_SHADOW_MODE` back to `true` restores the legacy grant
without a deploy of the shared package. The full revert is the single commit that
introduced §5 steps 1–10; name it in the release notes and name the on‑call engineer
who may call it. `EARN_SHADOW_MODE` is deleted, and `earn.legacy.ts` with it, only
after a full cycle at `false` with the triggers clear.

**Persisting the breakdown is not optional.** Without
`backend.recordEarnBreakdown(order.id, earn)` there is no way to reconstruct a grant,
no way to compute the delta after the fact, and D8's "make the total observable" goal
is not met.

---

## 6. What this patch does NOT do

- It does not touch the live Odoo program. Nothing here writes to production; the
  live configuration is still unverified (see `IMPL-BRIEF.md` §"Why this exists").
- It does not decide the redeem rate, the tier ramp, or whether cash redemption exists.
- It does not annualise any cost without labelling the assumption.
- It does not change `TAX_RATE`. The 8%/16% question (BRIEF §5) stays open **in the
  code** — but the cost model in this document cannot be neutral on it, so §1.1 states
  the basis it uses and the multiplier that converts between the two.
- It does not fix the 30 zero‑priced menu rows (§2.1) or the free‑order vector they open.

---

## 7. Verification — the tests to add

**Two locations, because the code under test lives in two workspaces:**

- **`bff/test/earn.test.ts`** (new) — everything that exercises `@almond/shared`.
  `bff` resolves `@almond/shared` through the npm workspace link, so a test here
  exercises the shared function the app imports too. `bff/test/checkout.test.ts` is
  the style to copy. **T1–T10, T12, T14** live here.
- **`almond-app/test/loyalty.mock.test.ts`** (new) — everything that exercises the
  mock's own internals (`spin`, `getSpinEligibility`, `beansExpireAt`, `expirePoints`,
  `getBalance`). These **cannot** run from `bff`: `bff/package.json` does not depend on
  `almond-app`, `bff/tsconfig.json` has no `paths`, and the mock imports `@/types`,
  `@/constants/config`, `./seed` and `@/lib/walletBonus` through an alias only Metro
  and the app's own tsconfig resolve. **T11, T13, T15** live here, and they are the
  reason for §5 step 0 (add `vitest` + the `@/` alias to `almond-app`, and export
  `beansExpireAt` / `expirePoints`, which today are unexported `function` declarations).

The pure expiry arithmetic was deliberately moved to
`packages/shared/src/loyalty/expiry.ts` (§4, D10/D11) so the **rule** also has a test
that does not depend on the Expo app resolving at all.

All tests pass an explicit `at:` and an explicit `rules:` where the assertion depends
on a config value, so a later config edit cannot silently change a test's meaning.

```ts
const MON = new Date('2026-09-07T10:00:00Z'); // Monday in Amman
const FRI = new Date('2026-09-11T10:00:00Z'); // Friday in Amman
const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday (BONUS_BEAN_DAY weekday)
```

| # | Test name | Exact assertion |
|---|---|---|
| **T1** | `earn: base rate is 5 points per JOD (1 point = 1 qirsh)` | `expect(computeEarn({ total: 10, at: MON }).points).toBe(50)` |
| **T2** | `earn: paying from the wallet adds +50% of base` | `expect(computeEarn({ total: 10, paidFromBalance: true, at: MON }).points).toBe(75)` |
| **T3** | `earn: the tier multiplier comes from rolling-window spend` | `expect(computeEarn({ total: 10, windowSpend: 750, at: MON }).tierId).toBe('black')` and `.points).toBe(100)`; and `expect(computeEarn({ total: 10, windowSpend: 99, at: MON }).tierId).toBe('bean')` |
| **T4** | `earn: the weekday bonus is read from config, not from getDay()` | With `rules = { ...base, weekdayBonus: [] }`: `expect(computeEarn({ total: 10, at: FRI }, rules).points).toBe(50)`. With `weekdayBonus: [{ weekday: 5, rate: 0.5 }]`: `expect(computeEarn({ total: 10, at: FRI }, rules).points).toBe(75)` and `expect(computeEarn({ total: 10, at: MON }, rules).points).toBe(50)`. **This is the test that would have made D3 impossible.** |
| **T5** | `earn: the combo bonus is INSIDE the cap (D4)` | The §4 D4 *secondary* example, priced through `computeTotals`: a 17.50 subtotal is a **20.30 invoice**, so `const r = computeEarn({ total: 20.3, comboPairs: 10, at: MON })`; `expect(r.comboBonus).toBe(500)`; `expect(r.subtotal).toBeCloseTo(601.5, 6)`; `expect(r.cap).toBeCloseTo(507.5, 6)`; `expect(r.capApplied).toBe(true)`; `expect(r.points).toBe(508)`. Regression comment: *the pre-patch code returned 602 for this invoice.* Assert the input too, so the tax basis cannot drift: `expect(computeTotals(cart, 0).total).toBeCloseTo(20.3, 6)` on the 10×(mineral-water + cake-pop) cart. |
| **T5b** | `earn: a zero-priced food item cannot mint uncapped combo points (§2.1)` | The §4 D4 *primary* example: 10 × mineral-water + 10 × a zero-priced Mother's Day cake ⇒ subtotal 7.50, **invoice 8.70**. `const r = computeEarn({ total: 8.7, comboPairs: 10, at: MON })`; `expect(r.comboBonus).toBe(500)`; `expect(r.capApplied).toBe(true)`; `expect(r.points).toBe(Math.round(r.cap))`. **Assert against `r.cap`, not a literal** — `8.7 * 25` is `217.49999999999997` in IEEE-754, so the value is 217. Regression comment: *the pre-patch code returned 544 = 62.5% of the invoice.* |
| **T6** | `earn: total giveback ceiling — no input can exceed MAX_EARN_MULTIPLIER × base` | Exhaustive grid: `total ∈ {0, 0.75, 1.75, 7.2, 8.7, 20.3, 50}` × `windowSpend ∈ {0, 100, 300, 750}` × `paidFromBalance ∈ {false, true}` × `bonusDayActivated ∈ {false, true}` × `comboPairs ∈ {0, 1, 5, 25}` × weekday 0..6. For every combination: `expect(r.points).toBeLessThanOrEqual(Math.round(r.cap))` — `r.cap` is `base × maxEarnMultiplier` by construction, so this is the ceiling itself and needs no re-derivation — and `expect(r.effectiveMultiplier).toBeLessThanOrEqual(rules.maxEarnMultiplier + 1e-9)` (skip the `total === 0` row for the ratio). **This is the giveback-ceiling test.** Note the assertion deliberately does *not* read `r.total × pointsPerJod × maxEarnMultiplier`: `r.cap` already is that product, computed once in the function under test. |
| **T7** | `earn: no module outside @almond/shared/loyalty/earn computes points` | **Scope:** walk `almond-app/`, `almond-web/`, `bff/` and `packages/` **wholesale** for `*.ts`/`*.tsx`, excluding `node_modules`, `.expo`, `.next`, `dist`, `build` and the test directories. **Match bare identifiers, not operators:** `/\bPOINTS_PER_JOD\b(?!_REDEEM)/`, `/\bMAX_EARN_MULTIPLIER\b/`, `/\bWALLET_EARN_MULTIPLIER\b/`, `/\bCOMBO_BONUS_POINTS\b/`, `/\bcomboBonusPoints\s*\(/`, and `/\btierFromSpend\b/` outside `packages/shared`. **Exemption is per LINE, not per file:** a matching line passes only if it, or the line above it, carries `// earn-arith-exempt: <reason>`. Files exempt wholesale: `packages/shared/src/config/index.ts` (the declarations) and `packages/shared/src/loyalty/earn.ts` (the one implementation). `expect(offenders).toEqual([])` with the failure message: *"earn arithmetic must live in packages/shared/src/loyalty/earn.ts — see docs/LOYALTY-EARN-PATCH.md §3. Offending lines: …"*. **This is the test that fails if client and server ever diverge again.** |
| **T8** | `earn: the Friday literal is gone from every codebase` | Same walk as T7: `expect(files.filter(f => /getDay\(\)\s*===\s*5/.test(src))).toEqual([])`. Extend to `/\bnew Date\([^)]*\)\.getDay\(\)/` outside `packages/shared/src/lib/ammanWeekday.ts` — the host clock is not a business day (§3.6). |
| **T9** | `spin: the wheel has a losing slot and a bounded EV` | `const odds = computeOdds(defaultSpinPrizes)`; `expect(odds['no-win']).toBeGreaterThan(0)`; and `expect(computeSpinEV(defaultSpinPrizes, PRIZE_VALUES_JOD)).toBeLessThanOrEqual(SPIN_EV_CEILING_JOD)` where `PRIZE_VALUES_JOD` is the §4 D6 table checked into the test and `SPIN_EV_CEILING_JOD` is the number chosen in §8.4. Until §8.4 is decided the test is written and skipped with `it.todo`, carrying the ceiling as a named constant. |
| **T10** | `checkout: the points the route grants equal computeEarn on the same inputs` | Integration, in `bff/test/checkout.test.ts` style: POST `/v1/checkout` with a known single line and an `Idempotency-Key`; then `const expected = computeEarn({ total: body.total, windowSpend: <member window spend from GET /v1/me>, paidFromBalance: true, comboPairs: 0, at: new Date() }).points`; `expect(body.pointsEarned).toBe(expected)`. Note `body.total` is the tax-inclusive total (§1.1) — asserting against `body.subtotal` is the bug this test exists to catch. Catches the route drifting away from the shared function even though it imports it. |
| **T11** *(almond-app)* | `spin: a free-spin day grants exactly one spin per day (D9)` | With `__setMockSpinConfig({ ...defaultSpinConfig, eligibility: { ...e, freeSpinDays: [ammanWeekday(new Date())] } })`: first `spin()` resolves; second `spin()` **rejects** with `No spins available`; `expect((await getSpinEligibility(u)).spinsAvailable).toBe(0)`. Pre-patch this loops forever. |
| **T12** | `subscription: the monthly cap binds before the daily cap runs out` | With `drinksPerMonth: 20`, redeem 20 drinks across 10 days (2/day), then the 21st `POST /v1/subscription/redeem` returns `409` with `error === 'monthly_cap'`. Skipped (`it.todo`) until §8.5 sets the number. |
| **T13** *(almond-app)* | `expiry: every tier expires on the same clock (D5)` | `expect(beansExpireAt({ lastEarnAt: T })).toBe(new Date(expiryAt(T)).toISOString())` for a Bean user **and** a Black user — same value. **Held behind §8.3** (it asserts the offer change, not the safe set). |
| **T14** | `earn: client and server agree across the Thursday/Friday boundary (§3.6)` | For each instant in `{ '2026-09-10T19:30:00Z', '2026-09-10T21:30:00Z', '2026-09-10T23:30:00Z', '2026-09-11T00:30:00Z' }` (22:30 → 03:30 Amman): `expect(ammanWeekday(at)).toBe(<expected Amman weekday>)`, and `expect(computeEarn({ total: 7.2, at }).points).toBe(computeEarn({ total: 7.2, at }, earnRulesFromConfig()).points)` computed with `process.env.TZ` set to `UTC` and to `Asia/Amman` in turn — the two runs must agree. **This is the test that stops D2 coming back through the clock.** |
| **T15** *(almond-app)* | `expiry: a stale balance actually reaches zero, and a GET never mutates (D10/D11)` | Build a Bean user with `points: 500` and `lastEarnAt` 400 days ago. `expect(expirePoints(u, Date.now())).toBe(500)` and `expect(u.points).toBe(0)` — **this is the assertion that detects expiry having silently stopped running.** Then, separately, with a fresh stale user: `const a = await getBalance(id); const b = await getBalance(id); expect(b.points).toBe(a.points)` (idempotent read), and assert the same via `earn()` — expiry must run on write paths too. Not held behind §8.3: the safe set keeps today's rule, it only moves where it runs. |

**Coverage of the defect list by test:** D1 → T5/T5b/T6 · D2 → T7/T10/T14 · D3 → T4/T8 ·
D4 → T5/T5b · D5 → T13 (held) · D6 → T9 · D7 → T12 · D8 → T6 (points component only)
· D9 → T11 · D10 → T15 + the shared `expiry.ts` unit tests · D11 → T15.

---

## 8. Safe now / needs a product decision

### 8.0 Safe now — pure bug fixes, shippable immediately

These change **no customer‑facing number** except where a row says otherwise, and they
are correct under every candidate design. **Read the exceptions: two of the items that
were previously in this table are not in it any more** — D4 (§8.7) and the checkout
estimate's new Friday bonus (§8.9) both change what a member gets or is shown.

| Fix | Why it is safe |
|---|---|
| **The shared `computeEarn`** (§3) and all six call sites rewired (§3.5) | Output is bit‑identical to today's server for every input, given §8.1, §8.7 and §8.9. Divergence becomes structurally impossible; T7 keeps it that way. |
| **D1 — the dead cap made live** | The number stays at 5. Only its coverage changes — and that coverage change *is* D4, which is gated in §8.7. Plus T5/T5b/T6 so the guard can never quietly die again. |
| **D3 — Friday moved into `WEEKDAY_EARN_BONUS`** | Inserted with `rate: 0.5` on weekday 5 = today's exact **grant**. It becomes admin‑controllable instead of deploy‑controllable. (The *displayed estimate* is §8.9.) |
| **§3.6 — one Amman business day** | Fixes a divergence rather than creating one: it makes the app's promise and the server's grant agree at the Thursday/Friday boundary, where today they can disagree by 50%. Some individual invoices near midnight change; the direction is always "matches what the customer was shown". |
| **D9 — unlimited spins on a free‑spin day** | Latent bug, no live cost today, no offer change: one grant per day is plainly what the code intends ("free spin every Friday"). |
| **D10 + D11 — 360 days ≠ 12 months, and a GET that zeroes a balance** | Ship as one unit (§4). The expiry **rule** is unchanged, Gold/Black exemption included; only *when* it is evaluated moves, from "inside a read" to "explicitly, on read and write paths". The date fix is strictly ~5 days more generous and matches what the UI already tells the customer. T15 asserts expiry still actually happens — without it this pair silently switches expiry off, which would be a balance‑sheet change, not a bug fix. |

### 8.1 The one coupled decision inside the safe set: `BONUS_BEAN_DAY.enabled`

D2's divergence can be closed in exactly two directions, and the code cannot pick:

- **(a) P&L‑neutral, recommended for this patch.** Set
  `config.BONUS_BEAN_DAY.enabled = false` (`packages/shared/src/config/index.ts:32`)
  in the same commit. The server behaves exactly as today; the app stops promising
  double points. **P&L cost: 0** — it is the cost of a bonus the server never paid.
  **Member‑facing cost: the removal of a live, advertised ×2 promotion.** The flag is
  `true` today, `almond-app/lib/bonusDay.ts:12` gates `activeBonusDay()` on it,
  `almond-app/components/loyalty/BonusDayBanner.tsx:20-40` renders the ×2 label and an
  **Activate** control, and `almond-app/app/(tabs)/rewards.tsx:190` mounts that banner
  on the rewards tab. Flipping the flag makes the banner **vanish**. That is a visible
  devaluation of an advertised offer and it gets the **same treatment §8.3 demands**:
  a stated notice period, in‑app copy explaining it, and a named revert (§5b) — not a
  silent flag flip. Dunkin' 2022 and Starbucks 2026 (BRIEF §4) are the precedent for
  exactly this failure mode, and neither was about the money.
- **(b) Honour it.** Requires server‑side activation state that does not exist:
  `POST /v1/promo/bonus-day/activate` + a per‑member per‑day record + passing
  `bonusDayActivated` from the token, not the client body (a client‑supplied flag is a
  self‑crediting vector — see BRIEF §2, review point 5). **Cost 21K–42K JOD/yr
  (assumption:** Tuesdays = 1/7 of invoices, 35% member coverage; 21K is the all‑Bean
  gap of 5.0 pp, 42K the top‑tier + wallet gap of 10.0 pp — see §2, D2**)**. The band is
  two‑to‑one wide, and only the **tier mix** closes it: that is a measurement‑kit
  output, and it is the reason the kit must run before this is chosen.

Recommended: ship (a) with this patch, with the notice and copy above; (b) is a design
decision that waits on the tier mix.

### 8.2 Needs a product decision — the ceiling *value*

`MAX_EARN_MULTIPLIER` currently permits 25% of the invoice in points. The maximum
reachable stack **without** the combo depends on `BONUS_BEAN_DAY`:

- with it **disabled** (§8.1(a)): wallet 1.5 × (1 + (tier 2.0 − 1) + weekday 0.5) =
  **3.75× (18.75%)** — the ceiling binds only on combo‑heavy baskets;
- with it **enabled** (§8.1(b)): × bonus‑day 2 = **7.5×** — the ceiling binds on an
  **ordinary top‑tier basket on a bonus day**, which is exactly the "client 25.0%
  (capped)" figure in §2, D2.

So the ceiling value must be decided **against the §8.1 answer, not before it**. Any
value below the reachable stack starts taking points away from real customers — that
is an offer change, not a bug fix. The design must state the number and the giveback
it implies, together with the D8 stack.

### 8.3 Needs a product decision — expiry (D5)

Inverting the rule *takes points away from Gold and Black members*, which is
precisely the change that produced the Starbucks 2019 and Dunkin' 2022 backlashes
(BRIEF §4). Ship it only with: the chosen window, a notice period, an in‑app
expiry countdown, and the tier‑distribution and liability numbers from the
measurement kit. The code change is one line; the rollout is not.

Note that the *mechanics* — `expiryAt`, `expirePoints`, an explicit job instead of a
read side effect — land in the safe set (§4, D10/D11) with **today's rule intact**. What
§8.3 gates is only the removal of the Gold/Black exemption.

### 8.4 Needs a product decision — the spin wheel (D6)

Adding a losing slot changes the felt offer. The decision needs: the `no-win` weight
(and therefore the EV ceiling `SPIN_EV_CEILING_JOD` that T9 asserts), whether the
10 JOD credit and the 7.50 pizza stay on the wheel at all, and `visitsPerSpin`.
Until then the wheel pays **2.583 JOD per spin at 100% win probability**.

### 8.5 Needs a product decision — the subscription cap (D7)

Two numbers: `drinksPerMonth` and whether `priceJod: 18` survives it. At the till,
18 JOD buys **6.2 Americanos** (2.50 menu + 16% tax = 2.90); the current cap allows 60,
i.e. **174 JOD of retail for 18 JOD — a 90% discount**. Pret's failure is the cited
precedent. The field is added in §4 D7 with `0` (unlimited, i.e. today's behaviour) so
the code change ships without deciding — but launching on `0` reproduces exactly the
failure mode.

### 8.6 Needs a product decision — the additive‑vs‑multiplicative stack

`computeEarn` keeps today's multiplicative composition (wallet ×1.5 × bonus‑day ×2,
then tier and weekday as fractions of that). An additive stack
(1 + 0.5 + 1.0 + …) is the more common industry shape and is materially cheaper at the
top: Black + wallet non‑Friday is 3.0× multiplicative vs 2.5× additive. Changing it is
a one‑line change in §3.3 and a real change to the offer. Not part of this patch.

### 8.7 Needs a product decision — moving the combo inside the ceiling (D4)

**This was previously listed as a safe bug fix. It is not one.** The justification
offered — "it reduces payout only on baskets that were already over the ceiling" — is
false of *every* basket: pre‑patch no basket was ever over the ceiling, because
`MAX_EARN_MULTIPLIER` was dead code (that is D1). Putting the combo inside the ceiling
therefore **creates a new binding constraint** and takes points away from ordinary
members.

**When the ceiling binds after the patch.** The cap binds when
`50 × pairs > base × (maxMult − wallet × (1 + (tier − 1) + weekdayRate))`:

| Segment | Cap binds when |
|---|---|
| Bean, weekday, no wallet | invoice **< 2.50 × pairs** |
| Black + wallet + Friday | invoice **< 8.00 × pairs** |

The measured average ticket is 7.20 JOD, so **the top‑tier wallet segment on a Friday
is inside the binding region at one pair.** Worked on the reference invoice
(7.20 JOD, tax‑inclusive per §1.1):

| Case | Before | After | Δ |
|---|---|---|---|
| Black + wallet + Friday, 1 pair | 185 pts | 180 pts | **−5** |
| Black + wallet + Friday, 2 pairs | 235 pts | 180 pts | **−55 (−23.4%)** |
| Bean, weekday, no wallet, 3 pairs | 186 pts | 180 pts | **−6** |
| Bean, weekday, no wallet, 1 pair (the modal member invoice) | 86 pts | 86 pts | 0 |

A drink + pastry + cookie order at the measured average ticket is two pairs. These are
not pathological carts, and the hardest‑hit segment — Gold/Black wallet payers on
Fridays — is precisely the group §8.3 says must never be devalued without a notice
period and an in‑app countdown.

**What has to happen before D4 ships:**
1. Get pairs‑per‑invoice and the tier mix from the measurement kit (the shadow run in
   §5b produces both), and state the **share of member invoices whose grant falls** and
   the 95th‑percentile loss.
2. Then either **grandfather** — grant `Math.max(legacyPoints, computeEarn().points)`
   for a stated notice period — or ship D4 under the same gates §8.3 sets: notice,
   in‑app countdown, comms.

Note what D4 recovers, honestly: on the modal member invoice, **nothing** (the row
above). The ≈205K JOD/yr in the §2 D4 row is the *exposure* of the flat‑per‑pair
design, not this fix's recovery. The ceiling recovers only the overflow.

### 8.8 Needs a product decision — the combo structure itself

The §2 D4 row names the real driver and the ceiling does not address it: the combo is
**flat, 50 points per pair, unbounded by basket value**
(`packages/shared/src/config/index.ts:47`, `packages/shared/src/lib/combo.ts:26`). A
0.75 JOD water paired with a 0.00 JOD cake earns the same 50 points as a pair worth
15 JOD. Putting it under a ceiling caps the damage per invoice; it does not make the
mechanism proportionate.

Three candidate shapes, and the measurement each needs:

| Shape | What it fixes | What it needs measured |
|---|---|---|
| Keep flat 50/pair (today) | nothing | pairs‑per‑invoice distribution |
| **A percentage of the pair's value** (e.g. 5% of the cheaper item) | the zero/low‑price exploit and the proportionality | pair value distribution; the incremental attach rate the flat bonus actually buys |
| **A per‑invoice pair cap** (e.g. max 2 pairs counted) | the 10‑pair basket, cheaply | pairs‑per‑invoice distribution only |

This is the largest single line in the defect table and it leaves Phase 0 **undecided**
unless it is put here explicitly. It is.

### 8.9 Needs a product decision — the checkout estimate starts promising Friday

`almond-app/lib/earnEstimate.ts:5-11` deliberately omits the Friday bonus today, "so we
never over‑promise". Routing it through `computeEarn` (§3.5, row 5) adds it back: on a
Bean 7.20 JOD Friday basket the number shown at the moment of payment moves
**36 → 54 points (+50%)**. The grant does not change — the app simply stops
under‑promising.

That is a marketing decision. Two ways to ship §3.5 row 5 without making it:
- pass `{ ...earnRulesFromConfig(), weekdayBonus: [] }` to the estimate, keeping
  today's displayed number while the arithmetic still lives in one place; or
- ship the honest estimate and say so in the release copy.

Either is defensible. Shipping it silently inside a set labelled "changes no
customer‑facing number" is not.

---

## 9. Reviewer checklist

**Scope note:** items 1 and 2 must be the *same walk and the same patterns* as test T7,
or the checklist and the test disagree about what the rule is. T7 is the authority;
these greps are the human‑readable shadow of it.

- [ ] `grep -rnE '\bPOINTS_PER_JOD\b|\bMAX_EARN_MULTIPLIER\b|\bWALLET_EARN_MULTIPLIER\b|\bCOMBO_BONUS_POINTS\b|\bcomboBonusPoints\s*\(' --include=*.ts --include=*.tsx almond-app almond-web bff packages | grep -v POINTS_PER_JOD_REDEEM` returns only: `packages/shared/src/config/index.ts`, `packages/shared/src/loyalty/earn.ts`, and lines carrying an `// earn-arith-exempt:` marker (today: `almond-app/app/(tabs)/pay.tsx:48`, `almond-web/src/components/cart/ComboBanner.tsx:23`).
- [ ] `grep -rn "getDay()" --include=*.ts --include=*.tsx almond-app almond-web bff packages` returns only `packages/shared/src/lib/ammanWeekday.ts` (§3.6).
- [ ] `bff/src/earn.ts` contains no arithmetic.
- [ ] `reprice()` returns `comboPairs`; no caller multiplies pairs by points; `comboBonusPoints` is deleted from `packages/shared/src/lib/combo.ts`.
- [ ] `config.BONUS_BEAN_DAY.enabled === false` **and** the §8.1(a) notice + in‑app copy are scheduled (or §8.1(b) is fully implemented server‑side).
- [ ] `EXPIRY_MS` appears nowhere; `expirePoints` is called from `getBalance` **and** from `earn`; T15 passes.
- [ ] T5, T5b, T6, T7, T8, T14 and T15 are present and passing; T9, T12, T13 exist as `it.todo` with their constants named.
- [ ] `almond-app` has a test runner and `npm test --workspace almond-app` runs T11/T13/T15 (§5 step 0).
- [ ] **D4 is either excluded from this commit or shipped under §8.7's gate** (measurement + grandfather or notice). If it is in, the §8.7 table's numbers are restated from the shadow data, not from this document.
- [ ] **§5b is in place before the flag flips:** `EARN_SHADOW_MODE`, `recordEarnBreakdown` persisting the full `EarnBreakdown` on the order, the two abort‑trigger numbers filled in, and the revert commit and on‑call owner named in the release notes.
- [ ] No production Odoo write is introduced anywhere in the patch.
