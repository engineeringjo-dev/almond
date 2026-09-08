/**
 * THE 90-DAY ROLLING WINDOW AND THE QUARTERLY EVALUATION.
 *
 * `config.TIER_WINDOW_DAYS` (90) and `config.TIER_EVALUATION` ('quarterly')
 * have been declared since 2026-09-06 and nothing implemented them. The BFF's
 * `addSpend` was `m.windowSpend += jod`: it never rolled anything off, so every
 * member ratcheted upward forever. That is not a hypothetical — it is the
 * defect MEASURED in the live programme, which ran 3,906 promotions and ZERO
 * demotions in 980 days because its qualifying spend was cumulative. This
 * module is the fix, and it is pure so that the BFF, the phone and the future
 * Odoo evaluator can only have ONE window definition between them.
 *
 * ── WHY THE WINDOW IS A RANGE OF AMMAN DAY KEYS, NOT AN EPOCH DELTA ─────────
 *
 * `TIER2_VISITS_ALTERNATIVE` is denominated in DISTINCT DAYS, so an epoch
 * window (`at >= now - 90*86400000`) would run one rule on two clocks — the
 * exact hazard lib/ammanWeekday.ts exists for (§3.6: the BFF, the phone and the
 * till are not on the same clock). An epoch edge also MOVES WITHIN A BUSINESS
 * DAY: the same member's rate would flicker between a 21:00 and a 23:00
 * request, because at 21:00 Amman the 90-days-ago instant is still yesterday.
 * Every entry therefore carries the Amman day the WRITER decided, and every
 * comparison here is string arithmetic on calendar keys. Day arithmetic runs
 * through Date.UTC on the PARSED key — never ms-subtraction from a host clock.
 *
 * The window is INCLUSIVE of today: `windowDays` keys ending at today, i.e.
 * today plus the 89 before it. Read exclusively it would be a 91-day window —
 * a free qualifying day for every member, forever.
 *
 * ── WHY PROMOTION IS IMMEDIATE AND DEMOTION IS IMPOSSIBLE ───────────────────
 *
 * config/index.ts:174-199 gives exactly two measured numbers for the quarterly
 * cadence and BOTH measure the downward direction: quarterly over monthly cuts
 * demotions per tier-holder per year from 1.74 to 0.65 (−63%), and 90 days over
 * 30 cuts the demoted share from 66.8% to 26.6%. The same paragraph then
 * abolishes demotion outright. Nothing measured supports deferring a PROMOTION.
 *
 * So: the rung a member is paid at is `max(stored floor, what the live window
 * qualifies for)`, recomputed on every read (standing) and materialised on
 * every write (holdRung). The quarterly boundary is the REQUALIFICATION stamp —
 * `Evaluation.requalified`, the hook a coupon would hang on — and never a rate
 * gate. Deferring promotion to the next quarter boundary would cost the whole
 * mechanic its only sentence: «باقي لك ٣ زيارات ويتضاعف خصمك ×٢» is a promise
 * about the NEXT VISIT, at a median return gap of 28 days, and the saving is
 * ~0.20 JOD per promoted member (half a quarter × ~10 JOD × 2 extra pts/JOD)
 * against a 15,133 JOD/yr programme.
 *
 * ── THE FLOOR CAN ONLY GO UP ────────────────────────────────────────────────
 *
 * `holdRung()` is the ONLY writer of a floor, and it is `higherRung(floor,
 * qualified)`. A source-level test (W1-2 in bff/test/window.test.ts) asserts
 * that every `heldTierId =` line in bff/src and almond-app also names
 * holdRung(, because a comment saying "never assign this directly" does not
 * fail a build.
 */
import { config } from '../config';
import { ammanDayKey } from '../lib/ammanWeekday';
import { MEASURED_MEMBER_BASKET_JOD, tiers } from './constants';
import { higherRung, rungFromSpend, type TierRung } from './earn';

/** One qualifying purchase, dated by the AMMAN business day it happened on.
 *  `day` is decided by the writer (the till, the BFF, the phone) and never
 *  re-derived from a reader's clock — that is the whole point. */
export interface SpendEntry {
  /** Invoice total in JOD, tax-inclusive — the same number computeEarn sees. */
  jod: number;
  /** 'YYYY-MM-DD' in Asia/Amman. See spendEntry(). */
  day: string;
}

/** Every dial the windowing reads, injectable exactly like EarnRules. */
export interface WindowRules {
  /** Length of the rolling window in Amman days, INCLUSIVE of today. */
  windowDays: number;
  /** Distinct qualifying days that open the second rung without the spend. */
  visitsAlternative: number;
  evaluation: 'quarterly' | 'monthly';
  /** The ladder, ascending by threshold — the same ramp computeEarn uses. */
  ramp: readonly TierRung[];
}

/** What one evaluation boundary decided. There is no demotion, so this can
 *  only ever RAISE `heldId`; `requalified: false` means "kept the rate, earned
 *  no coupon this period", which is not a loss event and needs no notice. */
export interface Evaluation {
  /** '2026-Q3' (quarterly) or '2026-M09' (monthly). */
  period: string;
  /** The floor AFTER this evaluation. Never below the floor before it. */
  heldId: string;
  /** What the live window qualified for when the evaluation ran. */
  qualifiedId: string;
  /** Did the live window still reach the held rung? The coupon hook. */
  requalified: boolean;
  windowSpend: number;
  visitDays: number;
}

/** Everything a caller needs to pay, display and explain the member's rung.
 *  `held` is what they are PAID at; `floor` is what is stored; `qualified` is
 *  what the live 90 days would give them on their own. Keeping all three
 *  visible is what makes a promotion observable BEFORE the write that
 *  materialises it — and what keeps this a read that mutates nothing (D11). */
export interface TierStanding {
  held: TierRung;
  floor: TierRung;
  qualified: TierRung;
  windowSpend: number;
  /** Distinct Amman days in the window carrying jod > 0. */
  visitDays: number;
  next: {
    rung: TierRung;
    jodRemaining: number;
    /** What the member is TOLD. "20 JOD in 90 days" is not a sayable
     *  sentence; "3 more visits" is. */
    visitsRemaining: number;
    /**
     * Is `visitsRemaining` a GUARANTEE or an estimate?
     *
     * True only where a visits door exists (ramp[1], config
     * .TIER2_VISITS_ALTERNATIVE): that many more qualifying days promotes the
     * member whatever they spend. False above it, where the only route is spend
     * and the number is a projection at the 5.85 JOD measured basket. The copy
     * layer MUST NOT state an unguaranteed count declaratively — see
     * almond-app/lib/tierCopy.ts.
     */
    visitsGuaranteed: boolean;
    /** The multiplier step being moved toward — "×2", then "×1.5". */
    step: number;
  } | null;
}

export function windowRulesFromConfig(): WindowRules {
  return {
    windowDays: config.TIER_WINDOW_DAYS,
    visitsAlternative: config.TIER2_VISITS_ALTERNATIVE,
    evaluation: config.TIER_EVALUATION,
    ramp: tiers.map((t) => ({ id: t.id, threshold: t.threshold, multiplier: t.multiplier })),
  };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Calendar arithmetic on a day KEY, in UTC, with no host clock anywhere near
 *  it. Asia/Amman has been UTC+3 year-round since Jordan dropped DST in 2022,
 *  but even if that changed, shifting a bare 'YYYY-MM-DD' through Date.UTC is
 *  timezone-free by construction: it never converts an instant. */
export function shiftDayKey(day: string, deltaDays: number): string {
  if (!DAY_KEY.test(day)) throw new Error(`shiftDayKey: not a YYYY-MM-DD key: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86_400_000);
  return `${at.getUTCFullYear()}-${pad2(at.getUTCMonth() + 1)}-${pad2(at.getUTCDate())}`;
}

/** The oldest day still inside the window. INCLUSIVE of today, hence −(n − 1):
 *  90 days is today and the 89 before it, not today and the 90 before it. */
export function windowStartDay(rules: WindowRules, at: Date = new Date()): string {
  return shiftDayKey(ammanDayKey(at), -(rules.windowDays - 1));
}

/** Build an entry, stamping the AMMAN day — the one helper every writer uses
 *  so no caller invents a second definition of "which day was that". */
export function spendEntry(jod: number, at: Date = new Date()): SpendEntry {
  return { jod, day: ammanDayKey(at) };
}

/** Entries inside [windowStart, today]. A FUTURE-DATED entry is excluded: a
 *  till whose clock runs fast must not hand a member a head start. */
export function entriesInWindow(
  entries: readonly SpendEntry[],
  rules: WindowRules,
  at: Date = new Date(),
): SpendEntry[] {
  const today = ammanDayKey(at);
  const from = windowStartDay(rules, at);
  return entries.filter((e) => e.day >= from && e.day <= today);
}

export function qualifyingSpend(
  entries: readonly SpendEntry[],
  rules: WindowRules,
  at: Date = new Date(),
): number {
  return entriesInWindow(entries, rules, at).reduce((s, e) => s + Math.max(0, e.jod), 0);
}

/**
 * Distinct Amman days inside the window carrying jod > 0.
 *
 * DAYS, NOT ORDERS. At the measured member basket of 5.85 JOD, 4 visits ≈ 23.4
 * JOD, which is what lets config/index.ts:202-205 claim the two doors are
 * "within a rounding error of each other". Counting orders would let four 0.75
 * JOD waters bought in one sitting — 3.00 JOD, 15% of the 20 JOD door, off by
 * 7× — open the 4% rung, and would make the config's own justification false.
 *
 * jod > 0, NOT any recorded entry. A comped or fully-vouchered order must not
 * count as a visit; that matters immediately, because the second-visit voucher
 * gives a member a free item to walk in for.
 */
export function qualifyingVisitDays(
  entries: readonly SpendEntry[],
  rules: WindowRules,
  at: Date = new Date(),
): number {
  const days = new Set<string>();
  for (const e of entriesInWindow(entries, rules, at)) if (e.jod > 0) days.add(e.day);
  return days.size;
}

/**
 * Drop everything the window can never see again.
 *
 * LOSSLESS FOR THE RATE: nothing outside the window can re-enter it, because
 * the window only ever moves forward. It bounds a per-member array that would
 * otherwise grow without limit in process memory — the mirror image of the
 * defect this module exists to fix. It is therefore NOT a lifetime history, and
 * "the member's first ever transaction" is not derivable from it; anything
 * needing that (the second-visit voucher) needs its own durable marker.
 */
export function pruneSpend(
  entries: readonly SpendEntry[],
  rules: WindowRules,
  at: Date = new Date(),
): SpendEntry[] {
  const from = windowStartDay(rules, at);
  return entries.filter((e) => e.day >= from);
}

/** The rung a member's live window earns on its own — before the floor. The
 *  visits door opens ramp[1] ONLY: config names it "Alternative door to tier
 *  2", and the 6% rung deliberately has none. */
export function qualifiedRung(
  windowSpend: number,
  visitDays: number,
  rules: WindowRules,
): TierRung {
  const bySpend = rungFromSpend(Math.max(0, windowSpend), rules.ramp);
  const door = rules.ramp[1];
  if (door && visitDays >= rules.visitsAlternative) return higherRung(bySpend, door);
  return bySpend;
}

/** Look a rung up by id; an unknown id falls back to the entry rung rather than
 *  throwing, so a member carrying a retired tier id is paid the base rate
 *  instead of failing their checkout. */
export function rungById(id: string | undefined, rules: WindowRules): TierRung {
  return rules.ramp.find((r) => r.id === id) ?? rules.ramp[0];
}

/**
 * 🔴 THE ONLY WRITER OF A FLOOR. There is no demotion (config:186-191: 86.1% of
 * everyone reaching tier 2+ would be demoted at least once under a demoting
 * design, and a demotion engine was priced at 1.05 JOD saved per demotion
 * against 17-21 engineer-days), so a floor may only ever rise.
 */
export function holdRung(
  heldId: string | undefined,
  qualified: TierRung,
  rules: WindowRules,
): TierRung {
  return higherRung(rungById(heldId, rules), qualified);
}

/** '2026-Q3' / '2026-M09'. Sorts lexicographically in chronological order,
 *  which is what lets `evaluatedThrough` be compared with `<`. */
export function evaluationPeriod(day: string, evaluation: WindowRules['evaluation']): string {
  if (!DAY_KEY.test(day)) throw new Error(`evaluationPeriod: not a YYYY-MM-DD key: ${day}`);
  const [y, m] = day.split('-').map(Number);
  if (evaluation === 'monthly') return `${y}-M${pad2(m)}`;
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

/** First Amman day of a period key. */
export function periodStartDay(period: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return `${q[1]}-${pad2((Number(q[2]) - 1) * 3 + 1)}-01`;
  const m = /^(\d{4})-M(\d{2})$/.exec(period);
  if (m) return `${m[1]}-${m[2]}-01`;
  throw new Error(`periodStartDay: not a period key: ${period}`);
}

/** The period after this one. */
export function nextPeriod(period: string): string {
  const start = periodStartDay(period);
  const isQuarter = period.includes('-Q');
  const [y, m] = start.split('-').map(Number);
  const step = isQuarter ? 3 : 1;
  const abs = (y * 12 + (m - 1)) + step;
  const day = `${Math.floor(abs / 12)}-${pad2((abs % 12) + 1)}-01`;
  return evaluationPeriod(day, isQuarter ? 'quarterly' : 'monthly');
}

/** How many periods an un-evaluated member may be walked forward in one call.
 *  A silent member is never evaluated (the write path is the only trigger), so
 *  the gap is unbounded in principle; the rate is provably unaffected because
 *  the floor only rises. 40 quarters is ten years of catch-up. */
const MAX_CATCHUP_PERIODS = 40;

/**
 * Close every evaluation period that has come due since `evaluatedThrough`.
 *
 * THIS IS NOT A RATE GATE — the rung is already `max(floor, qualified)` on
 * every read. It exists so that "did this member requalify for the quarter"
 * has an answer a coupon can hang on, and so a silent quarter is recorded as
 * `requalified: false` rather than as a demotion. W1 issues nothing.
 *
 * There is no scheduler in the BFF, so the only trigger is the write path: a
 * member who never transacts is never evaluated. That is provably nil for the
 * rate and costs only the stamp. Odoo gate 4's cron is where it becomes a real
 * schedule.
 */
export function evaluate(
  entries: readonly SpendEntry[],
  heldId: string | undefined,
  evaluatedThrough: string,
  rules: WindowRules,
  at: Date = new Date(),
): Evaluation[] {
  const current = evaluationPeriod(ammanDayKey(at), rules.evaluation);
  const out: Evaluation[] = [];
  if (!evaluatedThrough || evaluatedThrough >= current) return out;

  const windowSpend = qualifyingSpend(entries, rules, at);
  const visitDays = qualifyingVisitDays(entries, rules, at);
  const qualified = qualifiedRung(windowSpend, visitDays, rules);

  let floor = rungById(heldId, rules);
  let period = nextPeriod(evaluatedThrough);
  for (let i = 0; i < MAX_CATCHUP_PERIODS && period <= current; i++) {
    floor = higherRung(floor, qualified);
    out.push({
      period,
      heldId: floor.id,
      qualifiedId: qualified.id,
      // The live window is all the evidence that survives — the log is pruned
      // to 90 days by design. For a member who has been silent since
      // `evaluatedThrough` that is exactly right; for one who transacted, this
      // period was already closed at their first transaction in it.
      requalified: qualified.multiplier >= floor.multiplier,
      windowSpend,
      visitDays,
    });
    if (period === current) break;
    period = nextPeriod(period);
  }
  return out;
}

/**
 * The whole picture, computed fresh and mutating nothing.
 *
 * `next` is the rung above the one the member is PAID at, not the one above
 * their spend: a ratcheted member sitting on 'top' with a window that has
 * rolled back to zero has nothing left to progress to, and telling them they
 * are 4 visits from a rung they already hold is the bug W4's copy would inherit.
 */
export function standing(
  entries: readonly SpendEntry[],
  heldId: string | undefined,
  rules: WindowRules = windowRulesFromConfig(),
  at: Date = new Date(),
): TierStanding {
  const windowSpend = qualifyingSpend(entries, rules, at);
  const visitDays = qualifyingVisitDays(entries, rules, at);
  const qualified = qualifiedRung(windowSpend, visitDays, rules);
  const floor = rungById(heldId, rules);
  const held = higherRung(floor, qualified);

  const idx = rules.ramp.findIndex((r) => r.id === held.id);
  const up = idx >= 0 ? rules.ramp[idx + 1] : undefined;
  let next: TierStanding['next'] = null;
  if (up) {
    const jodRemaining = Math.max(0, up.threshold - windowSpend);
    /**
     * 🔴 THE NUMBER SAID OUT LOUD MUST BE THE ONE THE LADDER WILL HONOUR.
     *
     * This was `Math.min(projected, byDoor)` — the smaller of the visits door
     * and a projection at the measured 5.85 JOD basket — and the copy renders
     * it as a promise ("2 more visits and your cashback DOUBLES"). The smaller
     * of a guarantee and a projection IS a projection: a member with one 10 JOD
     * order was told 2 (ceil(10/5.85)) while the door needed 3, made the two
     * visits at 2.50 JOD each, and finished on 15 JOD / 3 visit days — still
     * paid 2%. That is the same class of defect as the `remaining <= 30` gate
     * W4 removed, in the sentence the whole mechanic rests on.
     *
     * At the door rung the guaranteed count is the door and nothing else: N
     * more qualifying days promotes the member at ANY basket size. It can
     * over-state what a big spender needs (19 JOD on one day is told 3), and
     * over-stating a requirement is the only safe direction for a promise.
     * Above the door rung there is no guarantee to be had — see
     * `visitsGuaranteed`, which is what stops the copy promising one.
     */
    const isDoorRung = up.id === rules.ramp[1]?.id;
    const visitsRemaining = isDoorRung
      ? Math.max(1, rules.visitsAlternative - visitDays)
      : Math.max(1, Math.ceil(jodRemaining / MEASURED_MEMBER_BASKET_JOD));
    next = {
      rung: up,
      jodRemaining,
      visitsRemaining,
      visitsGuaranteed: isDoorRung,
      step: up.multiplier / held.multiplier,
    };
  }

  return { held, floor, qualified, windowSpend, visitDays, next };
}
