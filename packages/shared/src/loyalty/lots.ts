/**
 * THE POINT LEDGER — PER-LOT EXPIRY, FIFO REDEMPTION, NO EXEMPTION.
 *
 * The owner's rule, verbatim:
 *
 *   «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد وصرف النقاط FIFO»
 *   «لا إعفاء — القاعدة للجميع»
 *
 * Every point lives 12 months. A new purchase does NOT renew it. Points are
 * spent oldest-first. No tier is exempt.
 *
 * ── WHY A LIST AND NOT A NUMBER ─────────────────────────────────────────────
 *
 * `points: number` cannot express any of that. A balance of 240 does not say
 * when it was earned, so it cannot say when it dies, and a redemption cannot
 * know which part of it was consumed. The balance is therefore a list of
 * `PointLot` rows and the scalar becomes `liveBalance(lots, at)` — a derived
 * sum, never a stored second opinion that can disagree with the rows.
 *
 * What this REPLACES is a per-ACCOUNT inactivity rule: `expirePoints()` zeroed
 * the WHOLE balance after 12 months of silence, any purchase reset the clock on
 * everything, and the 6% rung was exempt. All three are gone in the same change
 * (see §7 of the design): leaving the inactivity rule running beside this one
 * is the worst outcome available.
 *
 * ── WHAT IT IS WORTH ────────────────────────────────────────────────────────
 *
 * Simulated over 160,935 live earn rows and 10,621 redemptions with real FIFO
 * lots: at a 12-month lot life, 17.6% of everything issued expires — 4,385
 * JOD/yr on the historical 6.884 blended rate, ~2,300 JOD/yr on the shipped
 * 2/4/6 ladder (blended 3.63). The inactivity rule it replaces harvested ~557
 * JOD/yr, so this is 7.9× more, and 17.6% breakage puts the programme inside
 * the published retail band (20-30%) instead of at zero, which is what IFRS 15
 * vintage accounting wants. 18 months halves it (9.3%, 2,319 JOD/yr); 24 months
 * quarters it (4.2%, 1,035 JOD/yr). See config.POINT_LOT_LIFE_MONTHS.
 *
 * ── WHY THIS MODULE IMPORTS ALMOST NOTHING ──────────────────────────────────
 *
 * 🔴 THE IMPORT LIST IS THE ENFORCEMENT MECHANISM FOR «لا إعفاء».
 *
 * This file imports `../config` and `../lib/ammanWeekday`, and nothing else. It
 * deliberately does NOT import `./constants` (the tier table) or `./earn`
 * (`TierRung`), so it CANNOT reference a rung: the deleted `tier.id === 'top'`
 * exemption is not one line away from returning, it is unreachable. A comment
 * saying "do not exempt a tier" does not fail a build; an absent symbol does.
 * bff/test/lots.test.ts L4 asserts the import list, in the idiom T23a/W1-2 use.
 *
 * It is pure and list-in / list-out for the same reason loyalty/window.ts is:
 * the BFF, the phone and the future Odoo evaluator can only have ONE definition
 * between them. A window divergence cost a wrong RATE; a ledger divergence
 * refuses a redemption the member can see on their screen.
 *
 * ── WHY THE CLOCK IS AMMAN DAY KEYS ─────────────────────────────────────────
 *
 * The displayed date and the enforced date must be the same day. Under an epoch
 * instant a lot granted 22:30 Amman on 15 Nov dies at 22:30 on 15 Nov next
 * year: the member is shown "expires 15 Nov", walks in at 21:00 on the 15th and
 * is refused at the counter. That is window.ts's "an epoch edge MOVES WITHIN A
 * BUSINESS DAY", except it refuses money instead of flickering a rate.
 *
 * It is also not hypothetical. The deleted loyalty/expiry.ts computed expiry
 * with `Date#getMonth`/`setMonth`, which are HOST-LOCAL, and genuinely
 * disagreed across hosts — measured:
 *
 *   expiryAt(Date.parse('2028-02-29T22:00:00Z'), 12)
 *     TZ=UTC        → 2029-03-01T22:00:00Z   (Amman day 2029-03-02)
 *     TZ=Asia/Amman → 2029-02-28T22:00:00Z   (Amman day 2029-03-01)
 *
 * A full calendar day apart, silently, for 0.14% of evening grants (all
 * clustered on 28/29 February). Day-key arithmetic is timezone-free by
 * construction — see window.ts:143-152's argument for shiftDayKey — so every
 * date in this file is a bare 'YYYY-MM-DD' and every comparison is a string
 * compare. L7 pins that three different host zones agree.
 *
 * ── DELIBERATE ASYMMETRY WITH window.ts ─────────────────────────────────────
 *
 * `entriesInWindow` EXCLUDES a future-dated entry ("a till whose clock runs
 * fast must not hand a member a head start"). Liveness here has NO LOWER BOUND:
 * a back- or forward-dated lot is spendable immediately. The asymmetry is on
 * purpose — in the window a head start GAINS the member a rung, whereas a lower
 * bound here would COST them money they have already been told they hold.
 *
 * ── FIFO IS BY GRANT DATE, NOT BY EXPIRY DATE ───────────────────────────────
 *
 * «صرف النقاط FIFO» — oldest first. While `lifeMonths` is one constant the two
 * orders are identical. They diverge only if the config changes mid-flight: a
 * lot granted later under a shorter life could expire before an older lot.
 * FIFO-by-grant is kept (it is the stated rule, and it is what `grantedOn` and
 * `seq` are the keys for); the consequence is that the older lot is consumed
 * first and the shorter-lived newer lot is the one that dies, which maximises
 * breakage. If that ever becomes real it is an owner decision, not a tidy-up.
 */
import { config } from '../config';
import { ammanDayKey } from '../lib/ammanWeekday';

/**
 * Where a lot came from.
 *
 * It is NOT a rate and NOT a tier — the rule is identical for every source.
 * It exists so a breakage report can separate the liability we INHERITED from
 * the liability we CREATED (the IFRS 15 vintage split), and so the migration
 * lot can be recognised as the one grant that is deliberately absent from the
 * history ledger (see `migrationLot`).
 */
/**
 * Where a lot came from.
 *
 * 'earn' | 'bonus' | 'migration' | 'adjustment' are POINTS. 'topup' | 'gift' |
 * 'refund' are MONEY — see WalletLot below. The union is shared because the
 * ledger is, and a source that cannot name itself would make the member's
 * history unreadable.
 */
export type LotSource =
  | 'earn' | 'bonus' | 'migration' | 'adjustment'
  | 'topup' | 'gift' | 'refund';

/** One grant of points, with its own clock. */
export interface PointLot {
  /** Per-member, monotonically increasing. THE FIFO TIE-BREAK, because
   *  `grantedOn` is a DAY and a member can earn twice in one day. */
  seq: number;
  /** 'YYYY-MM-DD' in Asia/Amman. THE FIFO KEY. Immutable. */
  grantedOn: string;
  /**
   * 'YYYY-MM-DD' in Asia/Amman, INCLUSIVE — the lot is live THROUGH this day.
   *
   * 🔴 STORED AT GRANT TIME, never re-derived by a reader. It is a promise made
   * to the member when the points were issued, and `POINT_LOT_LIFE_MONTHS` is
   * editable: derived, a 12→18 edit would silently resurrect points already
   * dead and a 12→6 edit would kill points already promised — retroactively,
   * across the whole member base, from one token, with no error anywhere.
   * Storing it means a config change applies only to grants made after it,
   * which is the only defensible behaviour for a liability. Same reasoning as
   * HoldoutStamp carrying its own threshold and SecondVisitVoucher.expiresAt
   * being a stored column.
   */
  expiresOn: string;
  /** Integer points granted. IMMUTABLE — the audit number every breakage and
   *  vintage figure is built on. Once this moves, "how much did we issue" is
   *  unanswerable. */
  amount: number;
  /** Integer points not yet spent. 🔴 THE ONLY MUTABLE FIELD IN THIS TYPE. */
  remaining: number;
  source: LotSource;
}

/** Every dial the ledger reads, injectable exactly like EarnRules/WindowRules. */
export interface LotRules {
  /** config.POINT_LOT_LIFE_MONTHS (12). CALENDAR months, not 30-day blocks. */
  lifeMonths: number;
  /** How long a dead lot's ROW is kept, for support and for the breakage
   *  report. Affects no number a member ever sees — a dead lot contributes 0
   *  to every sum in this file from the moment it dies. */
  retentionDays: number;
}

export function lotRulesFromConfig(): LotRules {
  return {
    lifeMonths: config.POINT_LOT_LIFE_MONTHS,
    retentionDays: config.POINT_LOT_RETENTION_DAYS,
  };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad4 = (n: number): string => String(n).padStart(4, '0');

function assertDayKey(day: string, where: string): void {
  if (!DAY_KEY.test(day)) throw new Error(`${where}: not a YYYY-MM-DD key: ${day}`);
}

/**
 * Shift a day KEY by whole days, in UTC, with no host clock near it.
 *
 * The twin of window.ts's `shiftDayKey`, deliberately re-stated here rather
 * than imported: importing `./window` would drag the tier table into this
 * module's reachable graph and undo the «لا إعفاء» enforcement the header
 * describes. It is calendar arithmetic, not a business rule, and L9b asserts
 * the two agree over a four-year sweep so the duplication cannot drift.
 */
/**
 * A slice of the member's MONEY, in fils.
 *
 * 🔴 THE SAME TYPE AND THE SAME FUNCTIONS AS THE POINT LEDGER, DELIBERATELY.
 *
 * Owner, 2026-09-08: the wallet holds top-up balance and gift-card balance —
 * «نفس رصيد الشحن، لكن اذا شخص اشتراه لنفسه اسمه شحن، اذا حدا اهداه لشخص يصبح
 * gift card» — one kind of money with two origins, living two years, spent
 * first-in-first-out. That is the point ledger's problem statement with two
 * numbers changed.
 *
 * Writing a second ledger would mean two FIFO walks, two expiry-day
 * calculations and two off-by-one bugs to find separately. Every function here
 * takes its rules as an argument precisely so this could happen: pass
 * `walletLotRulesFromConfig()` and the same code keeps money instead of points.
 *
 * THE UNIT IS FILS, NOT DINARS. `remaining` must stay an integer — the FIFO
 * walk subtracts it repeatedly, and 0.1 + 0.2 in dinars would leave a member
 * holding 0.30000000000000004 JOD that never quite reaches zero.
 */
export type WalletLot = PointLot;

/**
 * The wallet's dials. Distinct from lotRulesFromConfig() because the two
 * ledgers hold different promises: points live 12 months, money lives 24.
 *
 * 🔴 THIS IS THE CUSTOMER'S OWN MONEY. A points lot expiring is a loyalty rule;
 * a wallet lot expiring is prepaid cash the member handed over. `expiresOn` is
 * stored at grant time for the same reason it is on a point lot, and it matters
 * more here: shortening WALLET_LIFE_MONTHS must never reach backwards into
 * balances a member has already been promised.
 */
export function walletLotRulesFromConfig(): LotRules {
  return {
    lifeMonths: config.WALLET_LIFE_MONTHS,
    retentionDays: config.POINT_LOT_RETENTION_DAYS,
  };
}

export function addDaysToDayKey(day: string, deltaDays: number): string {
  assertDayKey(day, 'addDaysToDayKey');
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86_400_000);
  return `${pad4(at.getUTCFullYear())}-${pad2(at.getUTCMonth() + 1)}-${pad2(at.getUTCDate())}`;
}

/**
 * Add whole CALENDAR months to a day key, clamping to the target month's last
 * valid day.
 *
 * 🔴 NOT `addDaysToDayKey(day, 365)` AND NOT `addDaysToDayKey(day, 360)`.
 * 12 × 30 days is 360 — ~5 days early against what the UI promises, which is
 * the D10 defect the deleted expiry.ts existed to fix — and 365 is wrong across
 * a leap year. L9 pins both.
 *
 * LEAP CLAMP: '2028-02-29' + 12mo → '2029-02-28'. Clamping is what "the same
 * date next year" means to a human and what every calendar library does. It
 * shortens one cohort's life by a day; rolling forward to '2029-03-01' would
 * instead make one day's grants outlive the next day's, which is harder to
 * explain than a one-day clamp.
 */
export function addMonthsToDayKey(day: string, months: number): string {
  assertDayKey(day, 'addMonthsToDayKey');
  if (!Number.isInteger(months)) {
    throw new Error(`addMonthsToDayKey: months must be a whole number, got ${months}`);
  }
  const [y, m, d] = day.split('-').map(Number);
  const abs = y * 12 + (m - 1) + months;
  const ty = Math.floor(abs / 12);
  const tm = ((abs % 12) + 12) % 12; // 0-based, correct for a negative `abs` too
  // Day 0 of month tm+2 is the LAST day of month tm+1 — the clamp target.
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${pad4(ty)}-${pad2(tm + 1)}-${pad2(Math.min(d, lastDay))}`;
}

/** The day a lot granted on `grantedOn` is live THROUGH. */
export function lotExpiresOn(grantedOn: string, rules: LotRules = lotRulesFromConfig()): string {
  return addMonthsToDayKey(grantedOn, rules.lifeMonths);
}

/**
 * Can this lot still be spent?
 *
 * INCLUSIVE OF ITS LAST DAY: a lot whose `expiresOn` is today is spendable all
 * of today and dead tomorrow. That is the only rule under which the date on the
 * member's card is the date the till honours (L8).
 *
 * No lower bound — see the header's note on the deliberate asymmetry with
 * window.ts.
 */
export function isLotLive(lot: PointLot, at: Date = new Date()): boolean {
  return lot.remaining > 0 && ammanDayKey(at) <= lot.expiresOn;
}

/** Every spendable lot, IN FIFO ORDER — oldest grant first, `seq` breaking a
 *  same-day tie. This is the order `consumeFifo` walks. */
export function liveLots(lots: readonly PointLot[], at: Date = new Date()): PointLot[] {
  return lots.filter((l) => isLotLive(l, at)).sort(byFifo);
}

const byFifo = (a: PointLot, b: PointLot): number =>
  a.grantedOn === b.grantedOn ? a.seq - b.seq : a.grantedOn.localeCompare(b.grantedOn);

/**
 * THE BALANCE. A pure function of the stored rows and the clock.
 *
 * Expiry is not an operation here — it is the ABSENCE of a row from this sum.
 * A member who never returns reads 0 from the first instant after their last
 * lot's expiry day: to them, to an admin, to a report and to the till. There is
 * no "in the meantime", and no stored scalar that can disagree, because there
 * is no stored scalar. That is also why a GET can never need to mutate (D11):
 * there is no mutation to trigger.
 */
export function liveBalance(lots: readonly PointLot[], at: Date = new Date()): number {
  let sum = 0;
  for (const l of lots) if (isLotLive(l, at)) sum += l.remaining;
  return sum;
}

/**
 * The NEXT slice of points to die, and how many — or null when the member holds
 * no live points.
 *
 * `amount` is the sum of EVERY live lot sharing the earliest expiry day, not
 * the first lot's remainder: two grants on one day must report 80, not 40. The
 * sentence this feeds is "40 points expire on 15/11", and a wire that can only
 * name one lot cannot say it truthfully.
 */
export function nextExpiry(
  lots: readonly PointLot[],
  at: Date = new Date(),
): { amount: number; on: string } | null {
  const live = lots.filter((l) => isLotLive(l, at));
  if (live.length === 0) return null;
  let on = live[0].expiresOn;
  for (const l of live) if (l.expiresOn < on) on = l.expiresOn;
  let amount = 0;
  for (const l of live) if (l.expiresOn === on) amount += l.remaining;
  return { amount, on };
}

/**
 * Points that DIED in the interval settled by [`fromDay`, `toDay`).
 *
 * Read it as: a lot whose last live day is `expiresOn` is dead on
 * `expiresOn + 1`. Settling on day T books every lot that is dead as of T
 * (`expiresOn < T`) and not already booked at the previous settle on day S
 * (`expiresOn < S`) — i.e. exactly `S <= expiresOn < T`.
 *
 * Idempotent by construction: settling twice on the same day gives S === T, an
 * empty range, and 0. A dead lot's `remaining` is frozen (consumeFifo skips it
 * forever), so nothing can be booked twice.
 */
export function expiredBetween(
  lots: readonly PointLot[],
  fromDay: string,
  toDay: string,
): number {
  assertDayKey(fromDay, 'expiredBetween');
  assertDayKey(toDay, 'expiredBetween');
  let sum = 0;
  for (const l of lots) if (l.expiresOn >= fromDay && l.expiresOn < toDay) sum += l.remaining;
  return sum;
}

/**
 * Append one grant. Returns a NEW array; the caller's is never mutated.
 *
 * `amount === 0` appends NOTHING and returns `lot: null` — `computeEarn`
 * returns 0 on a small invoice and a zero-point row is noise, not a grant. A
 * NEGATIVE or fractional amount THROWS: `addPoints(id, delta)` has no sign
 * guard of its own, and one −50 lot or one float would poison every sum in this
 * file silently, making Σ disagree with the integer on the member's screen.
 * Everything in the programme is integral — 1 point = 1 qirsh exactly, over
 * 10,621 live redemptions.
 *
 * `seq` is DERIVED here as `1 + max(seq)`, not carried as a member field. Safe
 * because a pruned lot is by construction both dead and older than every live
 * lot, so a reused seq can never collide with a live one; and it removes a
 * field the migration would otherwise have to backfill for 47,720 rows.
 */
export function grantLot(
  lots: readonly PointLot[],
  amount: number,
  source: LotSource,
  at: Date = new Date(),
  rules: LotRules = lotRulesFromConfig(),
  on?: string,
): { lots: PointLot[]; lot: PointLot | null } {
  if (!Number.isInteger(amount)) {
    throw new Error(`grantLot: amount must be a whole number of points, got ${amount}`);
  }
  if (amount < 0) throw new Error(`grantLot: amount must not be negative, got ${amount}`);
  if (amount === 0) return { lots: lots.slice(), lot: null };
  const grantedOn = on ?? ammanDayKey(at);
  assertDayKey(grantedOn, 'grantLot');
  let seq = -1;
  for (const l of lots) if (l.seq > seq) seq = l.seq;
  const lot: PointLot = {
    seq: seq + 1,
    grantedOn,
    expiresOn: lotExpiresOn(grantedOn, rules),
    amount,
    remaining: amount,
    source,
  };
  return { lots: [...lots, lot], lot };
}

export type ConsumeResult =
  | { ok: true; lots: PointLot[]; consumed: readonly { seq: number; points: number }[] }
  | { ok: false; live: number };

/**
 * Spend `points`, oldest lot first, decrementing `remaining` and NOTHING else.
 *
 * 🔴 THE FOUR WAYS TO GET THIS WRONG, named so they can be avoided:
 *
 *  1. RE-DATING THE PARTIALLY CONSUMED LOT. Setting `grantedOn = today` (or
 *     re-deriving `expiresOn`) silently extends the remainder by up to 12
 *     months, and does it again on every partial spend — a member who redeems
 *     small amounts often would hold points that never expire. That is the
 *     inactivity rule sneaking back in through the redemption path. L3.
 *  2. CLOSE-AND-REGRANT. Deleting the lot and appending a fresh one for the
 *     remainder is the same defect wearing a hat, and it breaks FIFO order too.
 *  3. DECREMENTING `amount`. It is the audit number; see the field's docstring.
 *  4. SPENDING FIRST AND DISCOVERING THE SHORTFALL SECOND. The check below runs
 *     against the LIVE balance BEFORE any write, and the write path builds a
 *     fresh array, so a refusal cannot have mutated anything even by accident.
 *     A loop that debits two lots and only then finds it is short leaves the
 *     member charged for a reward they did not receive. L6.
 *
 * Dead lots are SKIPPED, never consumed, even when the live balance is short:
 * liveness is evaluated before consumption, so a redemption at 09:00 cannot
 * spend a lot that died at midnight.
 */
export function consumeFifo(
  lots: readonly PointLot[],
  points: number,
  at: Date = new Date(),
): ConsumeResult {
  if (!Number.isInteger(points)) {
    throw new Error(`consumeFifo: points must be a whole number, got ${points}`);
  }
  if (points <= 0) throw new Error(`consumeFifo: points must be positive, got ${points}`);

  const order = liveLots(lots, at);
  const live = order.reduce((s, l) => s + l.remaining, 0);
  // ── THE PRE-FLIGHT CHECK. Nothing has been written above this line. ──
  if (live < points) return { ok: false, live };

  const takenBySeq = new Map<number, number>();
  const consumed: { seq: number; points: number }[] = [];
  let need = points;
  for (const l of order) {
    if (need <= 0) break;
    const take = Math.min(l.remaining, need);
    takenBySeq.set(l.seq, take);
    consumed.push({ seq: l.seq, points: take });
    need -= take;
  }
  return {
    ok: true,
    // A NEW array of NEW objects: `remaining` is the only field that moves, and
    // the caller's array is untouched whatever they do with ours.
    lots: lots.map((l) => {
      const take = takenBySeq.get(l.seq);
      return take === undefined ? { ...l } : { ...l, remaining: l.remaining - take };
    }),
    consumed,
  };
}

/**
 * Drop rows the ledger can never need again — dead for longer than
 * `retentionDays`.
 *
 * LOSSLESS FOR EVERY NUMBER A MEMBER SEES: a dead lot already contributes 0 to
 * `liveBalance` and `nextExpiry`. It bounds a per-member array that would
 * otherwise hold one row per grant forever. At `retentionDays: 90` the array
 * holds at most 15 months of grants — ~5 rows at the measured median member
 * (1 visit / 90 days), ~55 at the p95.
 *
 * ⚠ Prune only AFTER `settleExpiry` has booked the loss, or the history row for
 * those points is lost with them.
 */
export function pruneLots(
  lots: readonly PointLot[],
  at: Date = new Date(),
  rules: LotRules = lotRulesFromConfig(),
): PointLot[] {
  const today = ammanDayKey(at);
  return lots.filter((l) => today <= addDaysToDayKey(l.expiresOn, rules.retentionDays));
}

/**
 * The ONE lot a pre-existing member's scalar balance becomes at cutover.
 *
 * 🔴 DATED AT THE CUTOVER DAY, NOT AT ANY HISTORICAL DATE. A rule may not take
 * money retroactively: «كل نقطة تعيش ١٢ شهر» is a promise about a point's life
 * made NOW, and members holding balances today were never told those points had
 * a clock. Dating the lot at each member's last known activity would kill most
 * of the dormant tail on day one — 17.6% modelled breakage becomes ~100% for
 * exactly the members most likely to complain, with no notice. (The data to do
 * it the other way does not exist here either: all 47,720 live members have
 * zero orders in the BFF's log and *.odoo.com is unreachable.)
 *
 * 🔴 `source: 'migration'` earns its place three times:
 *   (i)   it is the inherited-vs-created split a breakage/IFRS 15 vintage
 *         report needs;
 *   (ii)  it is DELIBERATELY ABSENT FROM `history`, which is what keeps
 *         `unexplainedPoints = liveBalance − Σ(history deltas)` equal to the
 *         migrated balance — so the second-visit voucher's 19,040 JOD guard
 *         still trips for all 47,720. Log the migration grant and every
 *         migrated member becomes "explained", the guard stops tripping, and
 *         W2's over-issue re-opens silently. L12 pins this;
 *   (iii) `seq: 0` plus the cutover date puts it FIRST in FIFO, so inherited
 *         liability is retired before newly earned points — both the owner's
 *         rule and the accounting result.
 *
 * A balance of 0 or less gets NO lot: `migrateBalance` returns [].
 *
 * 🔴 CUTOVER + 12 MONTHS IS A CLIFF: every unredeemed migrated point in the
 * business dies on one calendar day. That is a product decision, not a code
 * one, and it is recorded as an open decision. A cheap, already-built
 * mitigation exists if the owner asks for it — lib/sha256.ts + loyalty/
 * holdout.ts already give a deterministic, storage-free 0..N bucket from a
 * member id, so `grantedOn = addDaysToDayKey(cutover, bucket(memberId, 0..89))`
 * would smear the cliff across a quarter with no new machinery and no stored
 * state. Do NOT ship it unasked: it changes when members' money dies.
 */
export function migrationLot(
  points: number,
  on: string,
  rules: LotRules = lotRulesFromConfig(),
): PointLot {
  if (!Number.isInteger(points) || points <= 0) {
    throw new Error(`migrationLot: points must be a positive whole number, got ${points}`);
  }
  assertDayKey(on, 'migrationLot');
  return {
    seq: 0,
    grantedOn: on,
    expiresOn: lotExpiresOn(on, rules),
    amount: points,
    remaining: points,
    source: 'migration',
  };
}

/** A pre-existing scalar balance, as lots. Zero or less → no lot at all. */
export function migrateBalance(
  points: number,
  on: string,
  rules: LotRules = lotRulesFromConfig(),
): PointLot[] {
  return points > 0 ? [migrationLot(points, on, rules)] : [];
}

/**
 * Whole days from today (Amman) until `day`. Negative once the day has passed.
 *
 * 🔴 DAY-KEY SUBTRACTION, NOT `(new Date(x) - Date.now()) / 86400000`. The
 * millisecond form measures from the reader's clock to a UTC-midnight parse of
 * a calendar key, so it flips a day at 21:00 Amman and again on a host in
 * another zone — the same hazard as everything else in this file. This is what
 * the home nudge's "expiring soon" window is measured with.
 */
export function daysUntilDayKey(day: string, at: Date = new Date()): number {
  assertDayKey(day, 'daysUntilDayKey');
  const [ty, tm, td] = day.split('-').map(Number);
  const [fy, fm, fd] = ammanDayKey(at).split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}
