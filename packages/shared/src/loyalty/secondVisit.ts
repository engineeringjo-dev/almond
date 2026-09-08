/**
 * THE SECOND-VISIT VOUCHER — «تانية علينا» / "The second one's on us".
 *
 * `config.SECOND_VISIT_VOUCHER` has been declared since 2026-09-06 and nothing
 * read it: `grep -rn SECOND_VISIT` returned exactly one file, the config that
 * declares it. This module is the decision; the BFF's Backend is the storage.
 *
 * WHY THIS MECHANIC AND NOT A BIGGER EARN RATE. The measured hazard at the 1→2
 * visit step is 45.8%; every later step is 68-93%. That step is the single
 * largest loss in the business and NO earn rate can act there — a first-time
 * member accrues 12 qirsh and a tier is computed over a history they do not
 * have. A named item on visit 2 can. The 30-day window is read off the data
 * rather than chosen: the median return gap is 28 days and 30 days captures
 * 51.1% of all eventual returners.
 *
 * WHY IT IS PAID IN KIND AND NEVER IN POINTS. A 1.90 JOD pastry at 79% margin
 * costs 0.399 JOD of material and reads to the member as 1.90 — 4.8× leverage,
 * 12.5× for a 92%-margin sweet, against cashback's 1.0×. Redemption therefore
 * moves no points and no wallet balance (see the route), and the view below
 * deliberately carries no `value`: a JOD figure on the card invites exactly the
 * cashback framing the config rejects.
 *
 * ── THE DECISION LADDER, AND WHY IT IS IN THIS ORDER ────────────────────────
 *
 *   1. !enabled                                     → no row
 *   2. alreadyEvaluated                             → no row (the row IS the record)
 *   3. priorTransactions/UNEXPLAINED points/windowSpend > 0 → row: 'ineligible'
 *   4. requiresDrink && !basketHasDrink             → row: 'declined'
 *   5. !receivesTreatment(arm)                      → row: 'suppressed'
 *   6. otherwise                                    → row: 'issued'
 *
 * 🔴 STEP 3 IS THE MOST IMPORTANT LINE IN THIS FILE. All 47,720 live members
 * (bff/test/security.test.ts:18) have ZERO orders in the BFF's own log — their
 * history is in Wafii/Odoo. Ungated, the next drink each of them buys is a
 * "first identified transaction" and issues a voucher: 47,720 × 0.399 JOD of
 * material = 19,040 JOD against a programme costed at 921-1,600 JOD/yr, a
 * 12-20× overrun with nothing anywhere raising an error (90,668 JOD at the menu
 * value the member sees). The authoritative guard is the ROW — cutover must
 * backfill an 'ineligible' row for every pre-existing member, which is a hard
 * prerequisite of enabling this in production and is a documented probe here
 * because *.odoo.com is unreachable. The balance guard is defence in depth: it
 * is a heuristic, but a strictly conservative one, because it can only ever
 * WITHHOLD a voucher, never over-issue one.
 *
 * ⚠ "Conservative" is not "free". The balance half of it must count only the
 * points the BFF CANNOT account for (see `unexplainedPoints`): reading the raw
 * balance disqualified every member who used the wallet top-up the home screen
 * advertises, permanently and silently. A guard that can only withhold still
 * has to withhold from the right people, or the control arm stops being the
 * only reason a member did not get the voucher.
 *
 * 🔴 STEP 5 IS LAST, AND THAT CONTRADICTS docs/LOYALTY-ODOO-MODULE.md:362
 * ("if holdout: return 0 # FIRST. Both evaluators.") DELIBERATELY. That rule is
 * right for the earn formula, where every member is eligible by construction so
 * eligibility and arm are the same test. Here they are not: arm-first would
 * record a holdout member whose first basket held no drink as 'suppressed' —
 * a control-arm observation for a treatment that was never available to them.
 * The control arm would then contain people the treatment arm cannot contain
 * and the two stop being comparable, which defeats the reason the holdout
 * exists. The suppression set must be exactly "would have been issued, was
 * not". The arm is nonetheless STORED on every row, including declined and
 * ineligible ones, so an analyst can check arm balance across the whole
 * evaluated population: store always, branch last.
 *
 * ── ONE EVALUATION, EVER ────────────────────────────────────────────────────
 *
 * A drinkless first basket writes a permanent 'declined' row rather than
 * deferring to the next transaction. Re-evaluating until a basket qualifies
 * would spend the same in-kind cost at visit 5, where the member returns anyway
 * 9 times in 10 (68-93%) — which is precisely the honest objection the config
 * records at index.ts:225-231. It also keeps "one per member, ever" a one-row
 * question. The `basketHadDrink` field on a declined row measures the
 * first-basket drink-attach rate for free, a neighbour of the 35% combo-pair
 * assumption the config calls the highest-return unanswered question.
 *
 * ── THIS MODULE HAS NO MENU DEPENDENCY, ON PURPOSE ──────────────────────────
 *
 * `basketHasDrink` arrives as a plain boolean and is computed in
 * `lib/combo.ts`, which already carries `itemKind`. `itemKind` pulls
 * `menu/seed` → `menu.generated.ts`, 543,502 bytes; this module is re-exported
 * from `loyalty/index.ts`, which almond-app's `services/seed.ts` imports, and
 * Metro does not tree-shake it. Keeping the classifier out of here keeps half a
 * megabyte of menu data out of the Expo bundle for anyone who wants
 * `tierFromSpend`.
 */
import { config } from '../config';
import { ammanDayKey } from '../lib/ammanWeekday';
import { receivesTreatment, type HoldoutStamp } from './holdout';
import type { Voucher, VoucherType } from '../types';

/**
 * The programme this row belongs to, versioned.
 *
 * NOT the holdout experiment key — that is `HOLDOUT_EXPERIMENTS
 * .secondVisitVoucher` in holdout.ts and travels on the stamp itself. This one
 * names the STORAGE programme, so that when a second voucher programme lands
 * the rows already written say which rule produced them.
 */
export const SECOND_VISIT_PROGRAMME = 'second-visit-voucher-v1';

/** Milliseconds in a day. Asia/Amman has been UTC+3 YEAR-ROUND since Jordan
 *  abolished DST in 2022 (verified: 00:00Z → 03:00 in both January and July
 *  2026), so `windowDays × this` is exactly `windowDays` Amman calendar days
 *  and the comparison needs no timezone at all. This is why loyalty/expiry.ts's
 *  setMonth care (D10 — 12 calendar MONTHS, not 360 days) does not apply here
 *  and `expiryAt()` is not reused: months have no fixed length, days in a
 *  fixed-offset zone do. */
const MS_PER_DAY = 86_400_000;

export interface SecondVisitRules {
  enabled: boolean;
  /** How long an issued voucher lives, in days. */
  windowDays: number;
  requiresDrink: boolean;
  labelAr: string;
  labelEn: string;
}

/** Production reads the config; tests pass literals — the same injectable shape
 *  as `computeEarn(ctx, rules = earnRulesFromConfig())` (earn.ts:103). */
export function secondVisitRulesFromConfig(): SecondVisitRules {
  const c = config.SECOND_VISIT_VOUCHER;
  return {
    enabled: c.enabled,
    windowDays: c.windowDays,
    requiresDrink: c.requiresDrink,
    labelAr: c.labelAr,
    labelEn: c.labelEn,
  };
}

export type SecondVisitOutcome = 'issued' | 'suppressed' | 'declined' | 'ineligible';

/** Why NO row was written. A row is the record of an evaluation, so the only
 *  two ways to write none are "the programme is off" and "we already did". */
export type SecondVisitSkip = 'disabled' | 'already-evaluated';

/**
 * The persisted row. ONE PER MEMBER, EVER — keyed by memberId, which is what
 * makes the brief's two questions unambiguous and unable to disagree:
 *
 *   already evaluated? → a row exists                (one key, one row)
 *   already issued?    → row exists && outcome === 'issued'
 *   already redeemed?  → redeemedAt !== null         (the ONLY writer is redeem)
 *   expired?           → DERIVED, see secondVisitStatus
 */
export interface SecondVisitVoucher {
  id: string;
  memberId: string;
  programme: string;
  outcome: SecondVisitOutcome;
  /**
   * The experiment arm SNAPSHOTTED at evaluation time, as the whole stamp and
   * not a boolean. §4.11: reading group membership at ANALYSIS time is the
   * classic way to invalidate a holdout, because a single basis-point edit to
   * the share silently re-labels every historical row in the affected band
   * (checked-in vector m_10 sits at 21.2050% — treatment at 2000 bp, holdout at
   * 2500). The stamp carries its own bucket and threshold, so the row can
   * verify its own arm without the salt (`stampIsSelfConsistent`) and
   * `replayStamp` can say WHY it stopped reproducing rather than only that it
   * did. It never reaches the wire — see toSecondVisitView.
   */
  arm: HoldoutStamp;
  /** When the evaluation happened. Every outcome has one. */
  issuedAt: string;
  /** null unless outcome === 'issued'. */
  expiresAt: string | null;
  issuedOnOrderId: string;
  /** null while live. NON-NULL IS THE ONLY DEFINITION OF "REDEEMED". */
  redeemedAt: string | null;
  /** The free measurement: the drink-attach rate on first baskets. */
  basketHadDrink: boolean;
}

export interface SecondVisitInput {
  memberId: string;
  orderId: string;
  /** Minted by the CALLER. This module reads no RNG and no clock — both would
   *  make the decision untestable and give the phone, the BFF and the Odoo
   *  evaluator three different answers. */
  voucherId: string;
  basketHasDrink: boolean;
  /** The arm, derived from the member id (holdout.ts). NEVER read from a
   *  request body: a client that can choose its arm is not a control arm. */
  arm: HoldoutStamp;
  /** True if this member already has a row. The authoritative guard. */
  alreadyEvaluated: boolean;
  /** Orders the BFF has already seen from this member, EXCLUDING this one. */
  priorTransactions: number;
  /**
   * Points the member holds that the BFF's OWN ledger cannot account for,
   * before this transaction's grant — i.e. `balance − Σ(this member's history
   * deltas)`. A migrated member arrives carrying a balance nobody here granted;
   * that difference is the evidence.
   *
   * 🔴 IT IS NOT THE RAW BALANCE, and that distinction is a defect that shipped
   * once. POST /v1/wallet/topup grants WALLET_RELOAD_BONUS points with no order
   * behind them (50 points at 20 JOD), so a brand-new member who topped up
   * before their first purchase held 50 points, looked exactly like a migrated
   * one, and was written a PERMANENT 'ineligible' row — losing the voucher
   * forever, silently, on the path the home screen's `home.walletHint` actively
   * invites them down. It also biased the experiment: the withheld population
   * became "the holdout arm ∪ the members who topped up first", and the second
   * set is neither randomised nor recorded as such.
   */
  unexplainedPoints: number;
  /** Qualifying window spend BEFORE this transaction is recorded. */
  priorWindowSpend: number;
  at: Date;
}

export interface SecondVisitDecision {
  /** The row to persist, or null when no row should be written. */
  row: SecondVisitVoucher | null;
  /** Set only when `row` is null. */
  skipped: SecondVisitSkip | null;
}

/**
 * `issuedAt + windowDays × 86_400_000`, as an ISO instant.
 *
 * Instants, not business days: a 30-day voucher LIFE has no boundary to reset
 * on, unlike memory.ts's `subDay` (the "2 free drinks per day" quota), which
 * genuinely needs `ammanDayKey`. The DISPLAYED date still goes through
 * ammanDayKey — see toSecondVisitView.
 */
export function secondVisitExpiresAt(issuedAt: Date, windowDays: number): string {
  return new Date(issuedAt.getTime() + windowDays * MS_PER_DAY).toISOString();
}

/**
 * THE decision. Pure: same inputs, same row, on every device and every server.
 */
export function decideSecondVisit(
  input: SecondVisitInput,
  rules: SecondVisitRules = secondVisitRulesFromConfig(),
): SecondVisitDecision {
  // 1. The programme is off. No row: an evaluation that could not happen is not
  //    an evaluation, and writing one would permanently bar the member from
  //    ever being evaluated once the flag is turned back on.
  if (!rules.enabled) return { row: null, skipped: 'disabled' };

  // 2. Already evaluated. The row that exists IS the record; nothing here may
  //    overwrite it, because an overwrite is how "one per member, ever"
  //    silently becomes "one per member, per deployment".
  if (input.alreadyEvaluated) return { row: null, skipped: 'already-evaluated' };

  const base = {
    id: input.voucherId,
    memberId: input.memberId,
    programme: SECOND_VISIT_PROGRAMME,
    arm: input.arm,
    issuedAt: input.at.toISOString(),
    expiresAt: null,
    issuedOnOrderId: input.orderId,
    redeemedAt: null,
    basketHadDrink: input.basketHasDrink,
  };

  // 3. 🔴 The 19,040 JOD guard (see the header). Any one of these three means
  //    the member has a history the BFF's own order log cannot see. Note
  //    `unexplainedPoints`, NOT the raw balance: the BFF grants points for a
  //    wallet top-up, and reading those back as evidence of a migrated history
  //    disqualified brand-new members permanently.
  if (input.priorTransactions > 0 || input.unexplainedPoints > 0 || input.priorWindowSpend > 0) {
    return { row: { ...base, outcome: 'ineligible' }, skipped: null };
  }

  // 4. The drink condition. It protects the margin — they still pay for the
  //    3.50 drink — and cuts deadweight 25-51% (config index.ts:236-238).
  if (rules.requiresDrink && !input.basketHasDrink) {
    return { row: { ...base, outcome: 'declined' }, skipped: null };
  }

  // 5. The control arm, LAST (see the header). Note the predicate: it is named
  //    for what the member GETS, so `if (receivesTreatment(...)) withhold()`
  //    is the only way to get this backwards, and the outcome test in
  //    bff/test/secondVisit.test.ts asserts against exactly that on W3's
  //    checked-in fixtures (m_3/m_5/m_8 are holdout; demo and m_0 are not).
  if (!receivesTreatment(input.arm)) {
    return { row: { ...base, outcome: 'suppressed' }, skipped: null };
  }

  // 6. Issued.
  return {
    row: {
      ...base,
      outcome: 'issued',
      expiresAt: secondVisitExpiresAt(input.at, rules.windowDays),
    },
    skipped: null,
  };
}

/**
 * 'active' | 'redeemed' | 'expired' | 'none' — DERIVED, never stored.
 *
 * There is deliberately no `expired` column and no status flag. A flag needs a
 * writer and the BFF has no cron, so a row would keep saying "issued" three
 * months past its expiry — a lie only a scheduled job could correct. That is
 * the same shape as the defect W1 just removed (memory.ts:78 accumulating
 * forever because nothing rolled it off). `expiresAt` plus a clock cannot
 * drift.
 */
export function secondVisitStatus(
  v: SecondVisitVoucher,
  at: Date,
): 'active' | 'redeemed' | 'expired' | 'none' {
  if (v.outcome !== 'issued') return 'none';
  if (v.redeemedAt) return 'redeemed';
  if (!v.expiresAt) return 'none';
  if (at.getTime() > Date.parse(v.expiresAt)) return 'expired';
  return 'active';
}

/**
 * What a member may be shown. A SUPERSET of the existing `Voucher`
 * (types/index.ts:209-217), so almond-app's VoucherCard renders it with no new
 * component.
 *
 * `value` is deliberately absent (the in-kind argument in the header) and so is
 * `arm`: a distinct "you are in the control group" signal — even an error code —
 * would tell a curious member which arm they are in, and a control arm that
 * knows it is one is not a control arm.
 */
export interface SecondVisitVoucherView {
  id: string;
  titleAr: string;
  titleEn: string;
  type: VoucherType;
  expiresAt: string;
  used: boolean;
  status: 'active' | 'redeemed' | 'expired';
  /** The Amman calendar day it expires on, for display.
   *
   *  Seven of the eight branches close at 24:00 Amman and City Mall at 23:00
   *  (menu/seed.ts:16-23), so TODAY the UTC and Amman dates agree except in the
   *  final minute and the defect is nearly invisible. That is the argument FOR
   *  the call, not against it: it costs one function §3.6 already requires and
   *  removes the class before the drive-thru extends its hours. */
  expiresOn: string;
  redeemedAt: string | null;
}

/**
 * The row a member may see, or null.
 *
 * 🔴 null for 'suppressed', 'declined' AND 'ineligible' — the SAME bytes a
 * member with no row at all gets. That is the holdout-blindness requirement:
 * three different server-side situations must be one indistinguishable client
 * answer. The row still carries the outcome server-side, so nothing is lost for
 * analysis.
 */
export function toSecondVisitView(
  v: SecondVisitVoucher | null | undefined,
  at: Date,
  rules: SecondVisitRules = secondVisitRulesFromConfig(),
): SecondVisitVoucherView | null {
  if (!v) return null;
  const status = secondVisitStatus(v, at);
  if (status === 'none' || !v.expiresAt) return null;
  return {
    id: v.id,
    titleAr: rules.labelAr,
    titleEn: rules.labelEn,
    type: 'free-item',
    expiresAt: v.expiresAt,
    used: v.redeemedAt !== null,
    status,
    expiresOn: ammanDayKey(new Date(v.expiresAt)),
    redeemedAt: v.redeemedAt,
  };
}

/** Compile-time proof of the handoff to W4: the view is assignable to the
 *  existing Voucher, so VoucherCard needs no new component. If a field is ever
 *  renamed here, this line fails the typecheck rather than the phone. */
export type SecondVisitViewIsAVoucher = SecondVisitVoucherView extends Voucher ? true : false;
