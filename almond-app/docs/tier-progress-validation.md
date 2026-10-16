# Tier progress and points worth — 2026-10-16

The member sees remaining spend and, only where the programme really supports
it, a paid-visit-day alternative. Points worth states money without examples
of drinks that balance could buy. The real redemption workflow remains.

Precedent: Starbucks exposes progress to the next level alongside a member's
current rewards, rather than making the member derive it from a balance:
[official programme launch](https://about.starbucks.com/press/2026/reimagined-starbucks-rewards-loyalty-program-launches-with-new-member-benefits/).
Almond's qualification and retention rules remain its own shared rules.

## Actual programme boundaries

`packages/shared/src/loyalty/window.ts` owns the rolling window, qualification
and held-tier floor. `loyalty/constants.ts` owns the ramp. Both the live
`GET /v1/me/balance` and mock balance derive their fields from `standing()`.

| Current/next tier | Real route | What this UI displays |
| --- | --- | --- |
| 2% → 4% | 20 JOD qualifying spend **or** 4 distinct paid Amman days in the rolling 90-day window | The balance's exact remaining JOD, plus its guaranteed remaining paid-day count |
| 4% → 6% | 65 JOD qualifying spend in the rolling window | Remaining JOD only; the basket-based visits projection is never shown as a target |
| 6% | Highest tier | Top-tier message; no invented next target |
| Missing standing below 6% | No authoritative next-tier metadata | Progress unavailable and Retry; never claim the member is at the top |

Several purchases on one Amman day count as one qualifying day. A purchase
must have positive qualifying spend. The count is a current-window snapshot,
not a prediction that old purchases will remain in the window indefinitely.
The tier page states the 90-day/paid-day rule beside the progress.

There is **no tier demotion**: `holdRung()` only raises a stored floor, and
`standing().held` is the higher of that floor and current qualification. The
quarterly evaluation is only a requalification stamp; it is not a rate gate
and currently issues no coupon. The balance wire has no retention target or
review date. Consequently this change explains that an earned tier stays,
offers a next-order action, and sends no tier-drop warning, dated reminder,
Home urgency, push or SMS.

The existing Home spend sentence remains. Its legacy spend-only fallback
does not gain a visit count: without a real guarantee the new alternative is
absent. On the tier page, missing metadata explicitly asks to refresh.

## Verification

- `almond-app/test/tierProgress.test.ts` renders the actual tier/points-worth
  decisions in both languages, fed by the shared standing: zero activity,
  separate days versus same-day invoices, the low-spend four-day shortcut,
  unguaranteed/missing/fractional/zero counts, rolled-off held tiers, top tier,
  and missing standing. The reached marks follow the held rung, not spend.
- Existing copy and visual tests continue to guard money formatting, one
  multiplication sentence and the separate Rewards/history/redemption UI.
- `e2e/app/tier-progress.spec.ts` adds bilingual runtime journeys using the
  real mock balance: 8 JOD OR two paid days, the exact window, retained tier,
  320px layout, keyboard action to Order without creating a cart, and axe.
  A second journey redeems 100 points, checks the updated money-only worth,
  and opens history. No production testing hook or fabricated tier is added.
- The existing Rewards hub fit check remains. The expanded tier screen
  allows vertical scrolling and requires every benefit to remain reachable.
- Six deliberate guard mutations failed as expected on 2026-10-16 between
  18:13:19Z and 18:13:29Z: missing guarantee, zero count, fractional count,
  spend-only reached marks, missing-standing fallback, and false top state.
  Each file was restored byte-for-byte. Evidence is in
  `/tmp/almond-review/tier-guard-*.log` for the current review session.

Runtime execution and screenshots belong to the central export/E2E gate.
The focused Node render tests do not prove native hardware or Safari layout.

The frozen delta passed 60 focused app tests (tier progress, existing copy,
visual safeguards and plurals), 40 BFF copy/locale tests, scoped ESLint and
E2E TypeScript. App-wide TypeScript initially reported only concurrent
QR-owner mock/redeem-test contract errors; the central gate must rerun it
after that owner freezes. No build, export, server or browser runtime was
started by this task.
