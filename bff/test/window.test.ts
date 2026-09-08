import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { computeEarn, earnRulesFromConfig, higherRung } from '@almond/shared/loyalty/earn';
import { tiers, MEASURED_MEMBER_BASKET_JOD } from '@almond/shared/loyalty';
import {
  entriesInWindow, evaluate, evaluationPeriod, holdRung, nextPeriod, periodStartDay,
  pruneSpend, qualifiedRung, qualifyingSpend, qualifyingVisitDays, rungById, shiftDayKey,
  spendEntry, standing, windowRulesFromConfig, windowStartDay,
  type SpendEntry,
} from '@almond/shared/loyalty/window';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { collectSources, type SourceFile } from './lib/sources';
import { signIn } from './lib/signIn';

/**
 * W1 — THE 90-DAY ROLLING WINDOW AND THE QUARTERLY EVALUATION.
 *
 * The defect these tests exist for is measured, not hypothetical: the live
 * programme ran 3,906 promotions and ZERO demotions in 980 days because its
 * qualifying spend was cumulative and never rolled off, and
 * bff/src/backend/memory.ts:78 reimplemented that exact line as
 * `m.windowSpend += jod`.
 *
 * T23a/T23b are docs/LOYALTY-ODOO-ARCHITECTURE.md §T23. W1-1..W1-11 are this
 * package's own. Every test with a window in it takes an INJECTED clock, so
 * none of them can pass or fail on the day they happen to run.
 */

const RULES = windowRulesFromConfig();
/** 13:00 Amman on Tuesday 2026-09-08 — inside Q3, far from any boundary. */
const NOW = new Date('2026-09-08T10:00:00Z');
const TODAY = ammanDayKey(NOW);
const MON = new Date('2026-09-07T10:00:00Z');
const ago = (days: number): string => shiftDayKey(TODAY, -days);
const entry = (jod: number, daysAgo: number): SpendEntry => ({ jod, day: ago(daysAgo) });

let sources: SourceFile[];
beforeAll(() => { sources = collectSources(); });

// ---------------------------------------------------------------------------
// T23 — §T23 of docs/LOYALTY-ODOO-ARCHITECTURE.md, verbatim.
// ---------------------------------------------------------------------------

describe('T23a the ever-accumulating spend counter is gone, by name and by shape', () => {
  it('no source calls addSpend, and no line adds to a windowSpend in place', () => {
    // Clause 1 of §T23. The method was RENAMED rather than fixed in place so
    // that the defect cannot return under its original spelling: a future
    // `addSpend` is a compile error at the Backend interface AND a red test
    // here. Comments are stripped by the walk, so the config's own explanation
    // of the old defect is not an offender.
    const named: string[] = [];
    const inPlace: string[] = [];
    for (const f of sources) {
      f.code.forEach((line, i) => {
        if (/\baddSpend\b/.test(line)) named.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        if (/windowSpend\s*\+=/.test(line)) inPlace.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(named, `addSpend must not exist: ${named.join(' | ')}`).toEqual([]);
    expect(
      inPlace,
      'a window that only ever grows is the defect measured in the live programme'
      + ` (3,906 promotions, 0 demotions, 980 days): ${inPlace.join(' | ')}`,
    ).toEqual([]);
  });

  it('the walk actually looked at the files this claim covers', () => {
    // A walk that silently found nothing would pass the assertion above.
    const paths = new Set(sources.map((f) => f.path));
    expect(paths.has('bff/src/backend/memory.ts')).toBe(true);
    expect(paths.has('bff/src/routes/checkout.ts')).toBe(true);
    expect(paths.has('almond-app/services/loyalty.service.mock.ts')).toBe(true);
  });
});

describe('T23b qualifying spend is the window, and it FALLS as the clock moves', () => {
  // 100 orders spread over 396 days, deterministic so this cannot flake.
  const log: SpendEntry[] = Array.from({ length: 100 }, (_, i) => entry(1 + (i % 5), i * 4));
  const lifetime = log.reduce((s, e) => s + e.jod, 0);

  it('only the in-window subset counts, and the rest is not "not yet counted" — it is gone', () => {
    const inWindow = log.filter((e) => e.day >= windowStartDay(RULES, NOW));
    expect(inWindow.length).toBe(23); // i*4 <= 89
    expect(qualifyingSpend(log, RULES, NOW)).toBe(inWindow.reduce((s, e) => s + e.jod, 0));

    // The number the pre-W1 BFF would have used, for scale: 4.4x the truth.
    expect(lifetime).toBeGreaterThan(qualifyingSpend(log, RULES, NOW) * 4);
  });

  it('advancing the clock strictly DECREASES it — the thing the ratchet could not do', () => {
    const at0 = qualifyingSpend(log, RULES, NOW);
    const at30 = qualifyingSpend(log, RULES, new Date(NOW.getTime() + 30 * 86400000));
    const at200 = qualifyingSpend(log, RULES, new Date(NOW.getTime() + 200 * 86400000));
    expect(at30).toBeLessThan(at0);
    expect(at200).toBe(0);
    // ... and the visit count falls with it.
    expect(qualifyingVisitDays(log, RULES, new Date(NOW.getTime() + 200 * 86400000))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W1-1 .. W1-11
// ---------------------------------------------------------------------------

describe('W1-1 the rung ratchets: it goes up with spend and never comes back down', () => {
  it('65 JOD then 200 days of silence — windowSpend returns to 0, the rate does not', () => {
    // There is no demotion (config/index.ts:186-191). This is the assertion
    // that a demotion cannot sneak in through the roll-off.
    const log = [entry(30, 10), entry(35, 5)];
    const atEarn = standing(log, 'base', RULES, NOW);
    expect(atEarn.windowSpend).toBe(65);
    expect(atEarn.held.id).toBe('top');
    const floor = holdRung('base', atEarn.qualified, RULES).id;
    expect(floor).toBe('top');

    const later = new Date(NOW.getTime() + 200 * 86400000);
    const after = standing(log, floor, RULES, later);
    expect(after.windowSpend).toBe(0);      // the window really did roll off
    expect(after.visitDays).toBe(0);
    expect(after.qualified.id).toBe('base'); // on its own the window is base
    expect(after.held.id).toBe('top');       // ... and the member is still paid 6%
    expect(after.next).toBeNull();           // nothing left to progress toward

    // Monotone at every step of a 400-day walk, not just at the two ends.
    let held = 'base';
    let worst = 0;
    for (let d = 0; d <= 400; d += 7) {
      const at = new Date(NOW.getTime() + d * 86400000);
      const s = standing(log, held, RULES, at);
      held = holdRung(held, s.qualified, RULES).id;
      expect(s.held.multiplier).toBeGreaterThanOrEqual(worst);
      worst = s.held.multiplier;
    }
  });

  it('higherRung is the only comparison, and it is on the multiplier the member is paid', () => {
    const [base, plus, top] = RULES.ramp;
    expect(higherRung(base, plus)).toBe(plus);
    expect(higherRung(top, plus)).toBe(top);
    expect(higherRung(plus, plus)).toBe(plus);
  });
});

describe('W1-2 a floor can only be written through holdRung', () => {
  it('every heldTierId assignment in bff/src and almond-app names holdRung(', () => {
    // A comment saying "never assign this directly" does not fail a build.
    // This is the repo's own idiom — T7's walk, T8's getDay ban, §T23 clause 1.
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('bff/src/') && !f.path.startsWith('almond-app/')) continue;
      f.code.forEach((line, i) => {
        if (/\bheldTierId\s*=[^=]/.test(line) && !/holdRung\(/.test(line)) {
          offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      'the held rung is a FLOOR: there is no demotion, so it may only be written'
      + ' through holdRung(), which cannot lower it. A bare assignment would'
      + ` demote a member with nothing going red. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('and the walk found the assignments it is guarding', () => {
    const assignments = sources
      .filter((f) => f.path.startsWith('bff/src/') || f.path.startsWith('almond-app/'))
      .flatMap((f) => f.code.filter((line) => /\bheldTierId\s*=[^=]/.test(line)));
    expect(assignments.length).toBeGreaterThanOrEqual(2);
  });
});

describe('W1-3 the visits door counts DISTINCT DAYS, not orders', () => {
  it('4 distinct days of 3.00 JOD open the 4% rung; 4 orders in one sitting do not', () => {
    // Counting orders instead of days would let four 0.75 JOD waters — 3.00
    // JOD, 15% of the 20 JOD door, off by 7x — open the rung, and would make
    // the config's "within a rounding error of each other" claim false.
    const fourDays = [entry(3, 1), entry(3, 5), entry(3, 12), entry(3, 30)];
    expect(qualifyingSpend(fourDays, RULES, NOW)).toBe(12);
    expect(qualifyingVisitDays(fourDays, RULES, NOW)).toBe(4);
    expect(standing(fourDays, 'base', RULES, NOW).held.id).toBe('plus');

    const oneSitting = [entry(3, 1), entry(3, 1), entry(3, 1), entry(3, 1)];
    expect(qualifyingVisitDays(oneSitting, RULES, NOW)).toBe(1);
    expect(standing(oneSitting, 'base', RULES, NOW).held.id).toBe('base');

    const threeDays = [entry(3, 1), entry(3, 5), entry(3, 12)];
    expect(qualifyingVisitDays(threeDays, RULES, NOW)).toBe(3);
    expect(standing(threeDays, 'base', RULES, NOW).held.id).toBe('base');
  });

  it('a zero-value visit is not a visit — the free-item hole, closed before it opens', () => {
    // W2 issues a free item next. A fully-vouchered order must not be a fourth
    // visit, or the voucher buys the rung it was never meant to buy.
    const withComp = [entry(3, 1), entry(3, 5), entry(3, 12), entry(0, 20)];
    expect(qualifyingVisitDays(withComp, RULES, NOW)).toBe(3);
    expect(standing(withComp, 'base', RULES, NOW).held.id).toBe('base');
  });

  it('the door opens the SECOND rung only — the 6% rung has no visits door', () => {
    const manyDays = Array.from({ length: 40 }, (_, i) => entry(0.5, i));
    expect(qualifyingVisitDays(manyDays, RULES, NOW)).toBe(40);
    expect(qualifyingSpend(manyDays, RULES, NOW)).toBe(20);
    // 40 visits, 20 JOD: the 4% rung by both doors, and NOT the 6% rung.
    expect(standing(manyDays, 'base', RULES, NOW).held.id).toBe('plus');
  });
});

describe('W1-4 the window is an AMMAN window on every host (T14 twin, §3.6)', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => { process.env.TZ = originalTZ; });

  // 21:30 UTC on Thursday the 10th is 00:30 Amman on FRIDAY the 11th. A host
  // that dated this sale itself would file it on the wrong day, and on a
  // 4-visits door a wrong day is a wrong rung.
  const at = new Date('2026-09-10T21:30:00Z');
  const clock = new Date('2026-09-11T09:00:00Z');

  it('the entry lands on Friday the 11th on a UTC host and on an Amman host', () => {
    for (const tz of ['UTC', 'Asia/Amman']) {
      process.env.TZ = tz;
      expect(spendEntry(10, at).day, tz).toBe('2026-09-11');
    }
    // ... and the host genuinely disagrees, which is what gives this teeth.
    expect(at.getUTCDate()).toBe(10);
  });

  it('qualifyingSpend and qualifyingVisitDays agree on both hosts', () => {
    const log = [spendEntry(10, at), spendEntry(4, new Date('2026-09-10T19:30:00Z'))];
    const seen: { spend: number; days: number }[] = [];
    for (const tz of ['UTC', 'Asia/Amman']) {
      process.env.TZ = tz;
      seen.push({
        spend: qualifyingSpend(log, RULES, clock),
        days: qualifyingVisitDays(log, RULES, clock),
      });
    }
    expect(seen[0]).toEqual(seen[1]);
    // 22:30 Amman Thursday and 00:30 Amman Friday are TWO business days.
    expect(seen[0]).toEqual({ spend: 14, days: 2 });
  });

  it('day arithmetic never touches a host clock', () => {
    for (const tz of ['UTC', 'Asia/Amman', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      expect(shiftDayKey('2026-03-01', -1), tz).toBe('2026-02-28');
      expect(shiftDayKey('2026-12-31', 1), tz).toBe('2027-01-01');
      expect(shiftDayKey('2028-02-28', 1), tz).toBe('2028-02-29'); // leap year
    }
  });
});

describe('W1-5 the window edge is inclusive, and the future is not in it', () => {
  it('windowDays-1 days back is IN; one day older is OUT', () => {
    const oldest = ago(RULES.windowDays - 1);
    expect(windowStartDay(RULES, NOW)).toBe(oldest);

    const log = [
      { jod: 10, day: oldest },                     // the very edge — counts
      { jod: 99, day: ago(RULES.windowDays) },      // one day past it — does not
    ];
    expect(qualifyingSpend(log, RULES, NOW)).toBe(10);
    expect(entriesInWindow(log, RULES, NOW).map((e) => e.jod)).toEqual([10]);

    // Read exclusively the window would be 91 days — a free qualifying day for
    // every member, forever. Count the keys and prove it is exactly 90.
    let keys = 0;
    for (let d = 0; d < 400; d++) if (ago(d) >= windowStartDay(RULES, NOW)) keys++;
    expect(keys).toBe(config.TIER_WINDOW_DAYS);
  });

  it('a future-dated entry is excluded — a fast till hands out no head start', () => {
    const log = [{ jod: 500, day: shiftDayKey(TODAY, 1) }, { jod: 4, day: TODAY }];
    expect(qualifyingSpend(log, RULES, NOW)).toBe(4);
    expect(qualifyingVisitDays(log, RULES, NOW)).toBe(1);
    expect(standing(log, 'base', RULES, NOW).held.id).toBe('base');
  });
});

describe('W1-6 the member with no history', () => {
  it('reads 0 JOD, 0 visits, the entry rung, and 4 visits to the next one', () => {
    const s = standing([], 'base', RULES, NOW);
    expect(s.windowSpend).toBe(0);
    expect(s.visitDays).toBe(0);
    expect(s.held.id).toBe('base');
    expect(s.next).not.toBeNull();
    expect(s.next!.rung.id).toBe('plus');
    expect(s.next!.rung.threshold).toBe(20);
    expect(s.next!.jodRemaining).toBe(20);
    expect(s.next!.visitsRemaining).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(s.next!.step).toBe(2); // the "×2" the copy promises
  });

  it('THE TWO DOORS SAY THE SAME SENTENCE — this is what W4 rests on', () => {
    // "4 more visits" is true whether the member gets there on spend (at the
    // measured 5.85 JOD basket) or on the visits door. If these two ever drift
    // apart, the progress copy starts making a promise one door cannot keep.
    expect(Math.ceil(20 / MEASURED_MEMBER_BASKET_JOD)).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(MEASURED_MEMBER_BASKET_JOD).toBe(5.85);
  });

  it('the visits door is what the member is TOLD, not the spend projection', () => {
    // 3 visits of 0.75 JOD: the spend projection says 4 more visits, the door
    // says 1. The door is a guarantee — a fourth qualifying day opens the 4%
    // rung at ANY basket size — and the guarantee is what may be said out loud.
    const s = standing([entry(0.75, 1), entry(0.75, 4), entry(0.75, 9)], 'base', RULES, NOW);
    expect(s.visitDays).toBe(3);
    expect(Math.ceil(s.next!.jodRemaining / MEASURED_MEMBER_BASKET_JOD)).toBe(4);
    expect(s.next!.visitsRemaining).toBe(1);
    expect(s.next!.visitsGuaranteed).toBe(true);
  });

  it('W1-6b the promised count is never a projection the ladder will not honour', () => {
    // 🔴 THE DEFECT THIS REPLACES. `visitsRemaining` was
    // `Math.min(projected, byDoor)`, so whenever the 5.85 JOD projection was
    // the more optimistic of the two it won — and the copy renders it as a
    // promise. One 10 JOD order projected 2 visits while the door needed 3.
    const s = standing([entry(10, 2)], 'base', RULES, NOW);
    expect(s.visitDays).toBe(1);
    expect(Math.ceil(s.next!.jodRemaining / MEASURED_MEMBER_BASKET_JOD)).toBe(2); // what it used to say
    expect(s.next!.visitsRemaining).toBe(config.TIER2_VISITS_ALTERNATIVE - 1);    // what is true
    expect(s.next!.visitsGuaranteed).toBe(true);

    // The member takes the promise up: two more visits at the cheapest drink on
    // the menu (2.500 JOD). 15 JOD across 3 visit days is neither door, and
    // they are still paid 2% — which is what made the old number a lie.
    const after = standing([entry(10, 2), entry(2.5, 1), entry(2.5, 0)], 'base', RULES, NOW);
    expect(after.windowSpend).toBe(15);
    expect(after.visitDays).toBe(3);
    expect(after.held.id).toBe('base');
    // The count this module actually promised, honoured: the third visit does
    // open the rung, whatever it cost.
    const honoured = standing(
      [entry(10, 2), entry(2.5, 1), entry(2.5, 0), entry(0.75, 3)],
      'base', RULES, NOW,
    );
    expect(honoured.visitDays).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(honoured.held.id).toBe('plus');
  });

  it('W1-6c above the visits door there is no guarantee, and it says so', () => {
    // The 6% rung has no alternative door (config: "Alternative door to tier
    // 2"), so the only route is 65 JOD of spend and any visit count is a
    // projection at the measured basket. 60 JOD projects ONE more visit; a
    // 2.500 JOD americano leaves the member on 62.50, still at 4%.
    const s = standing([entry(60, 5)], 'base', RULES, NOW);
    expect(s.held.id).toBe('plus');
    expect(s.next!.rung.id).toBe('top');
    expect(s.next!.visitsRemaining).toBe(1);
    expect(s.next!.visitsGuaranteed).toBe(false);
    expect(standing([entry(60, 5), entry(2.5, 0)], 'base', RULES, NOW).held.id).toBe('plus');
  });
});

describe('W1-7 the quarterly evaluation is a coupon stamp, never a rate gate', () => {
  it('period keys are chronological strings', () => {
    expect(evaluationPeriod('2026-09-08', 'quarterly')).toBe('2026-Q3');
    expect(evaluationPeriod('2026-01-01', 'quarterly')).toBe('2026-Q1');
    expect(evaluationPeriod('2026-12-31', 'quarterly')).toBe('2026-Q4');
    expect(evaluationPeriod('2026-09-08', 'monthly')).toBe('2026-M09');
    expect(periodStartDay('2026-Q3')).toBe('2026-07-01');
    expect(nextPeriod('2026-Q4')).toBe('2027-Q1');
    expect(nextPeriod('2026-M12')).toBe('2027-M01');
    // Lexicographic order IS chronological order, which is what lets
    // evaluatedThrough be compared with `<`.
    expect('2026-Q3' < '2026-Q4').toBe(true);
    expect('2026-Q4' < '2027-Q1').toBe(true);
  });

  it('a silent quarter keeps the rate and simply does not requalify', () => {
    // config/index.ts:186-191: "nothing is ever taken away and there is no loss
    // event to notify". requalified:false is that, and it is not a demotion.
    const q3 = [{ jod: 25, day: '2026-07-15' }];
    const inQ4 = new Date('2026-12-15T10:00:00Z');
    const due = evaluate(q3, 'plus', '2026-Q3', RULES, inQ4);
    expect(due.map((e) => e.period)).toEqual(['2026-Q4']);
    expect(due[0].heldId).toBe('plus');       // kept
    expect(due[0].qualifiedId).toBe('base');  // the window rolled off
    expect(due[0].requalified).toBe(false);   // ... so no coupon this quarter
    expect(standing(q3, 'plus', RULES, inQ4).held.id).toBe('plus');
  });

  it('a member who requalifies is stamped as such', () => {
    const recent = [{ jod: 25, day: '2026-12-01' }];
    const due = evaluate(recent, 'plus', '2026-Q3', RULES, new Date('2026-12-15T10:00:00Z'));
    expect(due[0].requalified).toBe(true);
    expect(due[0].qualifiedId).toBe('plus');
  });

  it('an already-closed period is not closed twice', () => {
    expect(evaluate([], 'base', '2026-Q3', RULES, NOW)).toEqual([]);
    expect(evaluate([], 'base', '2027-Q1', RULES, NOW)).toEqual([]);
  });

  it('several missed periods are all closed, in order', () => {
    const due = evaluate([], 'base', '2026-Q1', RULES, new Date('2026-12-15T10:00:00Z'));
    expect(due.map((e) => e.period)).toEqual(['2026-Q2', '2026-Q3', '2026-Q4']);
  });

  it('promotion does NOT wait for a boundary — the rate is live', () => {
    // This is the decision, asserted: a member who crosses 20 JOD today is paid
    // 4% today, mid-quarter, with no evaluation having run. Deferring it would
    // break the only sentence the ladder has ("... and your cashback DOUBLES"),
    // which is a promise about the NEXT visit at a 28-day median return gap.
    const crossed = [entry(12, 1), entry(9, 0)];
    expect(standing(crossed, 'base', RULES, NOW).held.id).toBe('plus');
  });
});

describe('W1-8 heldRungId is a FLOOR inside computeEarn, never an override', () => {
  const rules = earnRulesFromConfig();

  it('it raises the rung when the window has fallen below it', () => {
    // 10 JOD on a 0 JOD window: 20 points at the entry rung, 40 at the floor.
    expect(computeEarn({ total: 10, windowSpend: 0, at: MON }, rules).points).toBe(20);
    const held = computeEarn({ total: 10, windowSpend: 0, heldRungId: 'plus', at: MON }, rules);
    expect(held.points).toBe(40);
    expect(held.tierId).toBe('plus');
  });

  it('it never LOWERS the rung the live window already earns', () => {
    const r = computeEarn({ total: 10, windowSpend: 65, heldRungId: 'base', at: MON }, rules);
    expect(r.tierId).toBe('top');
    expect(r.points).toBe(60);
  });

  it('an id that is not in the injected ramp is ignored, not thrown', () => {
    // A stale record carrying a retired tier id ('gold') must not fail a
    // checkout; it simply falls back to what the window earns.
    const r = computeEarn({ total: 10, windowSpend: 20, heldRungId: 'gold', at: MON }, rules);
    expect(r.tierId).toBe('plus');
    expect(r.points).toBe(40);
    expect(rungById('gold', RULES).id).toBe('base');
  });

  it('W1-8b any call site that knows the window also passes the floor', () => {
    // Same shape as T7c in earn.test.ts, and for the same reason: an OUTCOME
    // test can only catch this where a ratcheted member can be constructed, and
    // over HTTP one cannot be (the route mints its own members). A call site
    // that hands computeEarn a windowSpend and withholds the floor pays a
    // rolled-off member LESS than the rate their own balance shows them — with
    // no error raised anywhere. Call sites that pass no windowSpend at all (the
    // website's guest estimate) are outside this rule and untouched by it.
    const offenders: string[] = [];
    for (const f of sources) {
      if (!/^(bff\/src|almond-app|almond-web)\//.test(f.path)) continue;
      f.code.forEach((line, i) => {
        if (!/\b(?:computeEarn|earnedPoints)\s*\(/.test(line)) return;
        const callSite = f.code.slice(i, i + 14).join('\n');
        if (/windowSpend\s*:/.test(callSite) && !/heldRungId\s*:/.test(callSite)) {
          offenders.push(`${f.path}:${i + 1}: passes windowSpend without heldRungId`);
        }
      });
    }
    expect(
      offenders,
      'there is no demotion, so the rung is max(floor, live window). A grant'
      + ' computed from the window alone under-pays every member whose 90 days'
      + ` have rolled off. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('omitting it changes nothing — every pre-existing call site is unaffected', () => {
    for (const windowSpend of [0, 19.99, 20, 64.99, 65, 1000]) {
      expect(computeEarn({ total: 7.2, windowSpend, at: MON }, rules).points)
        .toBe(computeEarn({ total: 7.2, windowSpend, heldRungId: undefined, at: MON }, rules).points);
    }
  });
});

describe('W1-9 the windowing ramp and the display ladder are the same ladder', () => {
  it('windowRulesFromConfig().ramp is tiers, id for id', () => {
    // memory.ts casts holdRung(...).id to TierId. This is what makes that cast
    // true rather than hopeful.
    expect(RULES.ramp.map((r) => r.id)).toEqual(tiers.map((t) => t.id));
    expect(RULES.ramp.map((r) => r.threshold)).toEqual(tiers.map((t) => t.threshold));
    expect(RULES.ramp.map((r) => r.multiplier)).toEqual(tiers.map((t) => t.multiplier));
    expect(RULES.windowDays).toBe(config.TIER_WINDOW_DAYS);
    expect(RULES.visitsAlternative).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(RULES.evaluation).toBe(config.TIER_EVALUATION);
  });
});

describe('W1-10 the window reaches the wire', () => {
  let app: FastifyInstance;
  let token: string;
  const auth = () => ({ authorization: `Bearer ${token}` });
  const line = { itemId: 'hot-americano', sizeId: 'M' as const, optionIds: [], qty: 1 };

  beforeAll(async () => {
    app = await build();
    // NOT the seeded demo member: a fresh enrolment, so "two orders, one visit
    // day" is countable from zero.
    token = await signIn(app, '0791234567');
  });

  const balance = async () =>
    (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth() })).json();

  const checkout = async () => {
    const r = await app.inject({
      method: 'POST', url: '/v1/checkout',
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [line] },
      headers: { ...auth(), 'idempotency-key': randomUUID() },
    });
    expect(r.statusCode).toBe(201);
    return r.json();
  };

  it('two checkouts on one day are ONE visit day, and the grant follows the window', async () => {
    const b0 = await balance();
    expect(b0.windowSpend).toBe(0);
    expect(b0.visitDays).toBe(0);
    expect(b0.tier.id).toBe('base');
    // The progress the app renders, on the wire (the W4 handoff).
    expect(b0.nextTier).toMatchObject({ id: 'plus', threshold: 20, jodRemaining: 20 });
    expect(b0.nextTier.visitsRemaining).toBe(config.TIER2_VISITS_ALTERNATIVE);

    const at = new Date();
    const r1 = await checkout();
    expect(r1.pointsEarned).toBe(computeEarn({
      total: r1.total, windowSpend: b0.windowSpend, heldRungId: b0.tier.id,
      paidFromBalance: false, comboPairs: 0, bonusDayActivated: false, at,
    }).points);

    const b1 = await balance();
    expect(b1.visitDays).toBe(1);
    expect(b1.windowSpend).toBeCloseTo(r1.total, 6);

    const r2 = await checkout();
    expect(r2.pointsEarned).toBe(computeEarn({
      total: r2.total, windowSpend: b1.windowSpend, heldRungId: b1.tier.id,
      paidFromBalance: false, comboPairs: 0, bonusDayActivated: false, at,
    }).points);

    const b2 = await balance();
    // TWO ORDERS, ONE DAY. Counting orders here is the 7x error W1-3 measures.
    expect(b2.visitDays).toBe(1);
    expect(b2.windowSpend).toBeCloseTo(r1.total + r2.total, 6);
  });

  it('the seeded demo member is a real 90-day log, not a frozen number', async () => {
    const backend = createMemoryBackend();
    const s = await backend.getStanding('demo');
    // 70 JOD across four in-window days; the 95 JOD entry 200 days back does
    // not count. Both doors agree on the 6% rung, which is what keeps T10 in
    // earn.test.ts (which recomputes from windowSpend alone) meaningful.
    expect(s.windowSpend).toBe(70);
    expect(s.visitDays).toBe(4);
    expect(s.held.id).toBe('top');
    expect(s.qualified.id).toBe('top');
    expect(s.next).toBeNull();
  });

  it('GET /v1/me/balance reports the rung the member is PAID at, not their spend', async () => {
    // THE RATCHET, ON THE WIRE. A member who reached 6% and then went quiet has
    // windowSpend 0 and tier 'top'; deriving the tier from windowSpend here
    // would show that member "2%" right next to the 6% they are still granted.
    // The backend is injected because 90 days of silence cannot be produced
    // over HTTP — there is no route that back-dates a sale.
    const backend = createMemoryBackend();
    const m = await backend.findOrCreateByPhone('+962795550001', 'Ratchet');
    await backend.recordSpend(m.id, 70, ago(0));
    const stored = await backend.getMember(m.id);
    expect(stored.heldTierId).toBe('top');
    stored.spend = stored.spend.map((e) => ({ ...e, day: ago(200) })); // 200 days pass

    const ratchetApp = await build(backend);
    const ratchetToken = await signIn(ratchetApp, '0795550001');
    const bal = (await ratchetApp.inject({
      method: 'GET', url: '/v1/me/balance',
      headers: { authorization: `Bearer ${ratchetToken}` },
    })).json();

    expect(bal.windowSpend).toBe(0);   // the window really did roll off
    expect(bal.visitDays).toBe(0);
    expect(bal.tier.id).toBe('top');   // ... and the rate did not
    expect(bal.tier.multiplier).toBe(3);
    expect(bal.nextTier).toBeNull();   // nothing above the top rung to promise
  });

  it('recordSpend prunes, and a member cannot be demoted by it', async () => {
    const backend = createMemoryBackend();
    const m = await backend.findOrCreateByPhone('+962790000222', 'W1');
    expect((await backend.getStanding(m.id)).held.id).toBe('base');

    await backend.recordSpend(m.id, 70, ago(0));
    expect((await backend.getStanding(m.id)).held.id).toBe('top');

    // A sale reported for a day already outside the window is recorded and then
    // pruned: it can never resurrect, and it cannot lower the floor either.
    await backend.recordSpend(m.id, 5, ago(400));
    const after = await backend.getMember(m.id);
    expect(after.spend.every((e) => e.day >= windowStartDay(windowRulesFromConfig()))).toBe(true);
    expect(after.heldTierId).toBe('top');
  });
});

describe('W1-11 pruning is lossless for the rate', () => {
  it('qualifyingSpend(prune(log)) === qualifyingSpend(log) at every clock', () => {
    // Pruning bounds an array that would otherwise grow forever in process
    // memory — the mirror of the defect being fixed. It must not eat live data.
    const log: SpendEntry[] = Array.from({ length: 100 }, (_, i) => entry(1 + (i % 5), i * 4));
    for (const d of [0, 1, 30, 89, 90, 200, 400]) {
      const at = new Date(NOW.getTime() + d * 86400000);
      const pruned = pruneSpend(log, RULES, at);
      expect(qualifyingSpend(pruned, RULES, at), `+${d}d`).toBe(qualifyingSpend(log, RULES, at));
      expect(qualifyingVisitDays(pruned, RULES, at), `+${d}d`).toBe(qualifyingVisitDays(log, RULES, at));
      expect(pruned.length, `+${d}d`).toBeLessThanOrEqual(log.length);
    }
  });

  it('pruning at one clock does not break the answer at a LATER clock', () => {
    // The window only ever moves forward, so nothing pruned today could have
    // re-entered tomorrow. That is the whole argument, asserted.
    const log: SpendEntry[] = Array.from({ length: 100 }, (_, i) => entry(1 + (i % 5), i * 4));
    const prunedToday = pruneSpend(log, RULES, NOW);
    for (const d of [1, 10, 90, 365]) {
      const later = new Date(NOW.getTime() + d * 86400000);
      expect(qualifyingSpend(prunedToday, RULES, later), `+${d}d`)
        .toBe(qualifyingSpend(log, RULES, later));
    }
  });

  it('qualifiedRung is a pure function of the two numbers the window produces', () => {
    expect(qualifiedRung(0, 0, RULES).id).toBe('base');
    expect(qualifiedRung(19.99, 3, RULES).id).toBe('base');
    expect(qualifiedRung(20, 0, RULES).id).toBe('plus');
    expect(qualifiedRung(0, 4, RULES).id).toBe('plus');
    expect(qualifiedRung(64.99, 40, RULES).id).toBe('plus');
    expect(qualifiedRung(65, 0, RULES).id).toBe('top');
  });
});
