import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { formatDayKey } from '@almond/shared/lib/format';
import {
  BalanceWireError, parseMeBalance, toLoyaltyBalance,
} from '@almond/shared/loyalty/balanceWire';
import {
  addDaysToDayKey, addMonthsToDayKey, consumeFifo, daysUntilDayKey, expiredBetween, grantLot,
  isLotLive, liveBalance, liveLots, lotExpiresOn, lotRulesFromConfig, migrateBalance,
  migrationLot, nextExpiry, pruneLots, type PointLot,
} from '@almond/shared/loyalty/lots';
import { decideSecondVisit, secondVisitRulesFromConfig } from '@almond/shared/loyalty/secondVisit';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import { shiftDayKey } from '@almond/shared/loyalty/window';
import { REPO, collectSources, type SourceFile } from './lib/sources';

/**
 * L1-L14 — THE POINT LEDGER.
 *
 * The owner's rule: «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد وصرف النقاط
 * FIFO» and «لا إعفاء — القاعدة للجميع». Every point lives 12 months from the
 * day it was granted, a new purchase renews nothing, points are spent oldest
 * first, and no rung is exempt.
 *
 * This file replaces bff/test/expiry.test.ts, which tested the PER-ACCOUNT
 * inactivity rule this change deletes. That file's D10 claim — "12 CALENDAR
 * months, not 12 × 30 days" — survives here as L9, because the claim was right
 * even though its subject is gone.
 *
 * These live in bff/ for the reason the deleted file's own header gave: the
 * RULE belongs in @almond/shared precisely so it has a test that does not
 * depend on the Expo app resolving. The enforcement half — the mock the phone
 * really runs on — is in almond-app/test/loyalty.mock.test.ts, mirroring the
 * D10/D11 split.
 *
 * Every test takes an INJECTED clock, so none of them can pass or fail on the
 * day they happen to run.
 */

const RULES = lotRulesFromConfig();
/** 13:00 Amman on Tuesday 2026-09-08 — the same anchor window.test.ts uses. */
const NOW = new Date('2026-09-08T10:00:00Z');
const TODAY = ammanDayKey(NOW);
/** A clock `days` after NOW, in the middle of the Amman business day. */
const at = (days: number): Date => new Date(NOW.getTime() + days * 86_400_000);
/** A day key `days` after / before today. */
const day = (days: number): string => shiftDayKey(TODAY, days);

/** Build a ledger by granting in order, exactly as a write path would. */
function ledger(grants: { points: number; onDay: number }[]): PointLot[] {
  let lots: PointLot[] = [];
  for (const g of grants) {
    lots = grantLot(lots, g.points, 'earn', NOW, RULES, day(g.onDay)).lots;
  }
  return lots;
}

let sources: SourceFile[];
beforeAll(() => { sources = collectSources(); });

// ---------------------------------------------------------------------------
// L1 — THE test. The whole difference from the rule being replaced.
// ---------------------------------------------------------------------------

describe('L1 a lot dies on its own schedule, and a later purchase does not renew it', () => {
  it('100 on day 0 and 100 on day 200: the day after the first expires, the balance is 100', () => {
    const lots = ledger([{ points: 100, onDay: 0 }, { points: 100, onDay: 200 }]);
    const firstDies = lots[0].expiresOn;

    // Alive together, right up to the last day of the first lot.
    expect(liveBalance(lots, NOW)).toBe(200);
    expect(liveBalance(lots, new Date(`${firstDies}T09:00:00Z`))).toBe(200);

    // 🔴 THE ASSERTION THE WHOLE CHANGE IS ABOUT.
    //   200 → the INACTIVITY rule this replaces (the day-200 purchase renewed
    //         everything, so nothing had died);
    //     0 → a per-ACCOUNT rule with no renewal (the whole balance dies at
    //         once, on the oldest clock);
    //   100 → per-LOT, which is the owner's rule and the only one that can
    //         explain itself to a member.
    const nextDay = new Date(`${addDaysToDayKey(firstDies, 1)}T09:00:00Z`);
    expect(liveBalance(lots, nextDay)).toBe(100);

    // The second lot dies on ITS OWN day — twelve calendar months after the day
    // it was granted, not with the first and not 200 days after it (200 days on
    // from firstDies is 2028-03-26, because 2028 is a leap year; the answer is
    // 2028-03-27, which is what "the same date next year" means).
    expect(lots[1].expiresOn).toBe(addMonthsToDayKey(lots[1].grantedOn, 12));
    expect(lots[1].expiresOn > firstDies).toBe(true);
    expect(liveBalance(lots, new Date(`${addDaysToDayKey(lots[1].expiresOn, 1)}T09:00:00Z`))).toBe(0);
  });

  it('the dead lot is still a ROW — it is worth 0, it was not erased', () => {
    // `amount` is the audit number the breakage and IFRS 15 vintage figures are
    // built on. Deleting the row on expiry would make "how much did we issue"
    // unanswerable; pruning it only happens after POINT_LOT_RETENTION_DAYS.
    const lots = ledger([{ points: 100, onDay: 0 }]);
    const after = at(400);
    expect(liveBalance(lots, after)).toBe(0);
    expect(lots).toHaveLength(1);
    expect(lots[0].amount).toBe(100);
    expect(lots[0].remaining).toBe(100);
    expect(isLotLive(lots[0], after)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// L2 / L3 — FIFO, and what a partial spend must NOT touch.
// ---------------------------------------------------------------------------

describe('L2/L3 FIFO consumes the oldest lot first and never re-dates the remainder', () => {
  const lots = () => ledger([
    { points: 40, onDay: -180 }, { points: 40, onDay: -90 }, { points: 40, onDay: 0 },
  ]);

  it('L2 spending 100 empties the two oldest and leaves 20 on the newest', () => {
    const res = consumeFifo(lots(), 100, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lots.map((l) => l.remaining)).toEqual([0, 0, 20]);
    // ... and the ORDER it consumed in is reported, oldest first.
    expect(res.consumed).toEqual([{ seq: 0, points: 40 }, { seq: 1, points: 40 }, { seq: 2, points: 20 }]);
  });

  it('L3 the partly-spent lot keeps its grant day, its expiry day, its amount and its seq', () => {
    const before = lots();
    const res = consumeFifo(before, 100, NOW);
    if (!res.ok) throw new Error('unreachable');
    const c = res.lots[2];

    // 🔴 THE MUTATION THIS CATCHES: setting `grantedOn = today` (or re-deriving
    // `expiresOn`) on the partly-consumed lot silently extends those 20 points
    // by up to 12 months — and does it again on every partial spend, so a
    // member who redeems little and often holds points that never expire. That
    // is the inactivity rule sneaking back in through the redemption path.
    expect(c.grantedOn).toBe(before[2].grantedOn);
    expect(c.expiresOn).toBe(before[2].expiresOn);
    expect(c.amount).toBe(before[2].amount); // never `amount -= take`
    expect(c.seq).toBe(before[2].seq);
    expect({ ...c, remaining: before[2].remaining }).toEqual(before[2]);

    // The surviving 20 die on the day the original 40 were always going to.
    expect(liveBalance(res.lots, new Date(`${c.expiresOn}T09:00:00Z`))).toBe(20);
    expect(liveBalance(res.lots, new Date(`${addDaysToDayKey(c.expiresOn, 1)}T09:00:00Z`))).toBe(0);
  });

  it('the input array is never mutated — a write returns a new array of new objects', () => {
    const before = lots();
    const snapshot = JSON.parse(JSON.stringify(before));
    const res = consumeFifo(before, 100, NOW);
    if (!res.ok) throw new Error('unreachable');
    expect(before).toEqual(snapshot);
    expect(res.lots[0]).not.toBe(before[0]);
  });

  it('two grants on ONE day are ordered by seq, not by array position', () => {
    // `grantedOn` is a DAY and a member can earn twice in a day, so `seq` is
    // the tie-break. Shuffling the stored array must not change what is spent.
    const lots = ledger([{ points: 10, onDay: 0 }, { points: 10, onDay: 0 }]);
    const shuffled = [lots[1], lots[0]];
    const res = consumeFifo(shuffled, 10, NOW);
    if (!res.ok) throw new Error('unreachable');
    expect(res.consumed).toEqual([{ seq: 0, points: 10 }]);
  });

  it('a DEAD lot is skipped, never consumed, even when the live balance is short', () => {
    const lots = ledger([{ points: 100, onDay: -400 }, { points: 40, onDay: 0 }]);
    const res = consumeFifo(lots, 40, NOW);
    if (!res.ok) throw new Error('unreachable');
    // The dead 100 are untouched and the LIVE 40 paid for it — a redemption at
    // 09:00 must not be able to spend a lot that died at midnight.
    expect(res.lots[0].remaining).toBe(100);
    expect(res.lots[1].remaining).toBe(0);
    expect(res.consumed).toEqual([{ seq: 1, points: 40 }]);
  });
});

// ---------------------------------------------------------------------------
// L4 — «لا إعفاء». No rung is exempt, and none can be.
// ---------------------------------------------------------------------------

describe('L4 no tier is exempt, and the module cannot reach a tier to exempt one', () => {
  it('the ledger has no way to be told which rung a member holds', () => {
    // The rule is expressed in the SIGNATURES: nothing in this module accepts a
    // rung, a tier id or a member. Two identical ledgers must expire
    // identically because there is no third input.
    const a = ledger([{ points: 500, onDay: -400 }, { points: 60, onDay: -3 }]);
    const b = ledger([{ points: 500, onDay: -400 }, { points: 60, onDay: -3 }]);
    expect(liveBalance(a, NOW)).toBe(60);
    expect(liveBalance(b, NOW)).toBe(liveBalance(a, NOW));
    expect(nextExpiry(a, NOW)).toEqual(nextExpiry(b, NOW));
  });

  it('lots.ts names no rung and imports neither the tier table nor the earn module', () => {
    // 🔴 THE STRUCTURAL HALF, in the idiom T23a and W1-2 use. The deleted
    // `expirePoints` had `if (tier.id === 'top') return 0;` — one line. A
    // comment saying "do not exempt a tier" does not fail a build; an
    // unreachable symbol does, and this is what keeps it unreachable.
    const f = sources.find((x) => x.path === 'packages/shared/src/loyalty/lots.ts');
    expect(f, 'the walk did not find the ledger module').toBeTruthy();
    const code = f!.code.join('\n');

    const offenders: string[] = [];
    for (const pattern of [/'top'/, /"top"/, /\btierId\b/, /\bheldTierId\b/, /\brungId\b/, /\btiers\b/]) {
      if (pattern.test(code)) offenders.push(String(pattern));
    }
    expect(
      offenders,
      'the ledger must not be able to name a rung — «لا إعفاء — القاعدة للجميع».'
      + ` Offending patterns: ${offenders.join(' | ')}`,
    ).toEqual([]);

    const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).sort();
    // The complete import list, asserted whole: a new import here is a
    // deliberate decision, not an accident nobody notices.
    expect(imports).toEqual(['../config', '../lib/ammanWeekday']);
  });

  it('no source still carries the retired inactivity rule, by name', () => {
    // The rule was DELETED, not switched off. Leaving `expirePoints`,
    // `beansExpireAt`, `lastEarnAt` or `BEAN_EXPIRY_MONTHS` alive beside the
    // ledger is the worst outcome available: two expiry rules, disagreeing.
    const offenders: string[] = [];
    for (const f of sources) {
      f.code.forEach((line, i) => {
        if (/\b(expirePoints|beansExpireAt|beansNeverExpire|lastEarnAt|BEAN_EXPIRY_MONTHS)\b/.test(line)) {
          offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      `the per-account inactivity rule must be gone, not dormant: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L5 — the balance IS the sum of the live lots, and there is no second number.
// ---------------------------------------------------------------------------

describe('L5 the balance is derived, and no scalar exists that could disagree', () => {
  it('liveBalance equals the sum of the live lots through an arbitrary sequence', () => {
    let lots = ledger([{ points: 90, onDay: -300 }, { points: 55, onDay: -100 }]);
    for (const [d, spend] of [[0, 40], [30, 30], [120, 25]] as const) {
      const clock = at(d);
      const res = consumeFifo(lots, spend, clock);
      expect(res.ok, `spend ${spend} on day ${d}`).toBe(true);
      if (!res.ok) return;
      lots = res.lots;
      const manual = lots.filter((l) => isLotLive(l, clock)).reduce((s, l) => s + l.remaining, 0);
      expect(liveBalance(lots, clock)).toBe(manual);
      expect(liveBalance(lots, clock)).toBe(liveLots(lots, clock).reduce((s, l) => s + l.remaining, 0));
    }
  });

  it('no member type anywhere still carries a scalar points balance', () => {
    // The W1 `windowSpend` technique: the field was DELETED rather than
    // shadowed, so every reader became a typecheck failure instead of a silent
    // second opinion. This keeps it deleted.
    const offenders: string[] = [];
    for (const f of sources) {
      if (!/bff\/src|almond-app\/services/.test(f.path)) continue;
      f.code.forEach((line, i) => {
        if (/\b[mu]\.points\s*[-+]?=/.test(line)) offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(
      offenders,
      `the balance is liveBalance(lots); nothing may add to a stored scalar: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L6 — a refusal is atomic.
// ---------------------------------------------------------------------------

describe('L6 a redemption larger than the LIVE balance is refused without a single write', () => {
  it('40 live and 100 dead: spending 60 refuses and the array is deep-equal', () => {
    const lots = ledger([{ points: 100, onDay: -400 }, { points: 40, onDay: -1 }]);
    const snapshot = JSON.parse(JSON.stringify(lots));

    const res = consumeFifo(lots, 60, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    // It reports the LIVE total, not the row total — 140 is what a naive sum
    // over `remaining` would say, and it is the wrong answer twice over.
    expect(res.live).toBe(40);
    // 🔴 NOTHING MOVED. The trap is a loop that debits the live lot and only
    // then discovers it is 20 short: the member is charged for a reward they
    // did not receive.
    expect(lots).toEqual(snapshot);
  });

  it('spending exactly the live balance succeeds; one more point does not', () => {
    const lots = ledger([{ points: 40, onDay: -1 }]);
    expect(consumeFifo(lots, 40, NOW).ok).toBe(true);
    expect(consumeFifo(lots, 41, NOW).ok).toBe(false);
  });

  it('a fractional or non-positive spend throws rather than silently rounding', () => {
    const lots = ledger([{ points: 40, onDay: 0 }]);
    expect(() => consumeFifo(lots, 10.5, NOW)).toThrow(/whole number/);
    expect(() => consumeFifo(lots, 0, NOW)).toThrow(/positive/);
    expect(() => consumeFifo(lots, -10, NOW)).toThrow(/positive/);
  });
});

// ---------------------------------------------------------------------------
// L7 — the same answer on every host. The W1-4 twin.
// ---------------------------------------------------------------------------

describe('L7 the 12-month boundary is identical on a UTC host and an Amman host', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => { process.env.TZ = originalTZ; });
  const ZONES = ['UTC', 'Asia/Amman', 'Pacific/Kiritimati'];

  it('the measured 2028-02-29 evening case, which the deleted expiryAt got wrong', () => {
    // 🔴 REPRODUCES THE DIVERGENCE THAT WAS MEASURED IN THE OLD CODE. The
    // deleted loyalty/expiry.ts used `Date#getMonth`/`setMonth`, which are
    // HOST-LOCAL, so `expiryAt(Date.parse('2028-02-29T22:00:00Z'), 12)` landed
    // on Amman day 2029-03-02 on a UTC host and 2029-03-01 on an Amman host —
    // a full calendar day apart, for the same grant, with no error raised.
    // 22:00 UTC on the 29th is 01:00 Amman on 2028-03-01, so the correct answer
    // is one year from THAT day.
    const grantedAt = new Date('2028-02-29T22:00:00Z');
    const seen = new Set<string>();
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const { lot } = grantLot([], 100, 'earn', grantedAt, RULES);
      seen.add(`${lot!.grantedOn}/${lot!.expiresOn}`);
    }
    expect([...seen]).toEqual(['2028-03-01/2029-03-01']);
  });

  it('liveness at the boundary agrees on every host', () => {
    const lots = ledger([{ points: 100, onDay: 0 }]);
    const last = new Date(`${lots[0].expiresOn}T21:30:00Z`);   // 00:30 Amman, next day
    const onDay = new Date(`${lots[0].expiresOn}T09:00:00Z`);
    const answers = new Set<string>();
    for (const tz of ZONES) {
      process.env.TZ = tz;
      answers.add(JSON.stringify({
        on: liveBalance(lots, onDay),
        after: liveBalance(lots, last),
        next: nextExpiry(lots, onDay),
      }));
    }
    expect(answers.size).toBe(1);
    // 21:30 UTC is already TOMORROW in Amman, so the lot is dead — the business
    // day, not the host's date, decides.
    expect(liveBalance(lots, onDay)).toBe(100);
    expect(liveBalance(lots, last)).toBe(0);
  });

  it('month and day arithmetic never touches a host clock', () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(addMonthsToDayKey('2026-01-15', 12), tz).toBe('2027-01-15');
      expect(addMonthsToDayKey('2028-02-29', 12), tz).toBe('2029-02-28');
      expect(addDaysToDayKey('2026-03-01', -1), tz).toBe('2026-02-28');
    }
  });
});

// ---------------------------------------------------------------------------
// L8 / L9 — the boundary itself, and the calendar arithmetic under it.
// ---------------------------------------------------------------------------

describe('L8 expiry is inclusive of its last day', () => {
  it('live all through expiresOn, dead the next morning', () => {
    const lots = ledger([{ points: 100, onDay: 0 }]);
    const d = lots[0].expiresOn;
    expect(isLotLive(lots[0], new Date(`${addDaysToDayKey(d, -1)}T09:00:00Z`))).toBe(true);
    expect(isLotLive(lots[0], new Date(`${d}T09:00:00Z`))).toBe(true);
    expect(isLotLive(lots[0], new Date(`${addDaysToDayKey(d, 1)}T09:00:00Z`))).toBe(false);
    // The member is SHOWN this day and must be served on it. Exclusive liveness
    // would refuse a redemption at the counter on the date printed on the card.
    expect(nextExpiry(lots, new Date(`${d}T09:00:00Z`))).toEqual({ amount: 100, on: d });
  });

  it('a future-dated grant is spendable at once — the deliberate asymmetry with the window', () => {
    // window.ts excludes a future-dated SpendEntry ("a fast till must not hand
    // a member a head start"). Here a head start would COST the member points
    // they have been told they hold, so liveness has no lower bound.
    const lots = ledger([{ points: 50, onDay: 3 }]);
    expect(liveBalance(lots, NOW)).toBe(50);
    expect(consumeFifo(lots, 50, NOW).ok).toBe(true);
  });
});

describe('L9 twelve CALENDAR months, not 360 days and not 365 (carries D10 forward)', () => {
  it('12 months is 12 months, and it is 5 days later than 12 × 30', () => {
    // The claim that outlived bff/test/expiry.test.ts. 12 × 30 = 360 days is
    // ~5 days EARLY against what the UI promises.
    expect(addMonthsToDayKey('2026-01-15', 12)).toBe('2027-01-15');
    const legacy360 = addDaysToDayKey('2026-01-15', 360);
    expect(legacy360).toBe('2027-01-10');
    expect(addMonthsToDayKey('2026-01-15', 12) > legacy360).toBe(true);
  });

  it('nor is it a flat 365 days across a leap year', () => {
    // 2027-03-01 + 365 days lands on 2028-02-29, a day early, because 2028 is a
    // leap year. Calendar months are the only definition that always means
    // "the same date next year".
    expect(addMonthsToDayKey('2027-03-01', 12)).toBe('2028-03-01');
    expect(addDaysToDayKey('2027-03-01', 365)).toBe('2028-02-29');
  });

  it('29 February clamps to 28 February, and never rolls forward to 1 March', () => {
    // Clamping shortens one cohort by a day; rolling forward would make one
    // day's grants OUTLIVE the next day's, which is harder to explain.
    expect(addMonthsToDayKey('2028-02-29', 12)).toBe('2029-02-28');
    expect(addMonthsToDayKey('2028-03-01', 12)).toBe('2029-03-01');
    expect(addMonthsToDayKey('2028-02-29', 12) < addMonthsToDayKey('2028-03-01', 12)).toBe(true);
    // Month lengths, not a 30-day block.
    expect(addMonthsToDayKey('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDayKey('2026-05-31', 1)).toBe('2026-06-30');
  });

  it('L9b the ledger\'s day arithmetic agrees with the window\'s, day for day', () => {
    // addDaysToDayKey is stated in lots.ts rather than imported from window.ts,
    // because importing window.ts would drag the tier table into this module's
    // reachable graph and undo L4. This is what stops the duplication drifting.
    for (let i = -800; i <= 800; i += 7) {
      expect(addDaysToDayKey('2026-01-01', i)).toBe(shiftDayKey('2026-01-01', i));
    }
  });

  it('lotExpiresOn reads the shipped dial, and the dial is 12', () => {
    expect(config.POINT_LOT_LIFE_MONTHS).toBe(12);
    expect(RULES.lifeMonths).toBe(config.POINT_LOT_LIFE_MONTHS);
    expect(lotExpiresOn('2026-01-15')).toBe(addMonthsToDayKey('2026-01-15', config.POINT_LOT_LIFE_MONTHS));
  });

  it('expiresOn is STORED, so changing the dial cannot move a promise already made', () => {
    // A lot built under one rule keeps its date when read under another. A
    // derived expiry would let a 12→18 edit resurrect points already dead and a
    // 12→6 edit kill points already promised — retroactively, from one token.
    const { lot } = grantLot([], 100, 'earn', NOW, { lifeMonths: 6, retentionDays: 90 });
    expect(lot!.expiresOn).toBe(addMonthsToDayKey(lot!.grantedOn, 6));
    // Read with the shipped 12-month rules: still dead after its own 6 months.
    expect(liveBalance([lot!], new Date(`${addDaysToDayKey(lot!.expiresOn, 1)}T09:00:00Z`))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// L10 — reads are pure. D11, now free rather than policed.
// ---------------------------------------------------------------------------

describe('L10 every read is pure — there is no expiry mutation to trigger', () => {
  it('reading across the expiry boundary mutates nothing and needs no sweep', () => {
    const lots = ledger([{ points: 100, onDay: 0 }, { points: 50, onDay: 200 }]);
    const snapshot = JSON.parse(JSON.stringify(lots));
    const dead = at(700); // past BOTH lots' own expiry days
    for (const clock of [NOW, at(200), dead, dead]) {
      liveBalance(lots, clock);
      liveLots(lots, clock);
      nextExpiry(lots, clock);
      expiredBetween(lots, day(0), ammanDayKey(clock));
    }
    expect(lots).toEqual(snapshot);
    // The falling number, with no job having run in between.
    expect(liveBalance(lots, NOW)).toBe(150);
    expect(liveBalance(lots, new Date(`${addDaysToDayKey(lots[0].expiresOn, 1)}T09:00:00Z`))).toBe(50);
    expect(liveBalance(lots, dead)).toBe(0);
  });

  it('expiredBetween books each death exactly once, and is idempotent per day', () => {
    const lots = ledger([{ points: 100, onDay: 0 }, { points: 50, onDay: 200 }]);
    const afterFirst = addDaysToDayKey(lots[0].expiresOn, 1);
    const afterBoth = addDaysToDayKey(lots[1].expiresOn, 1);

    expect(expiredBetween(lots, day(0), day(1))).toBe(0);          // nothing dead yet
    expect(expiredBetween(lots, day(0), afterFirst)).toBe(100);    // the first lot
    expect(expiredBetween(lots, afterFirst, afterFirst)).toBe(0);  // settled twice, same day
    expect(expiredBetween(lots, afterFirst, afterBoth)).toBe(50);  // then the second
    // Booked in one go it is the same total — no death is counted twice or lost.
    expect(expiredBetween(lots, day(0), afterBoth)).toBe(150);
  });

  it('pruning drops only rows that have been dead longer than the retention window', () => {
    const lots = ledger([{ points: 100, onDay: 0 }]);
    const dies = lots[0].expiresOn;
    expect(config.POINT_LOT_RETENTION_DAYS).toBe(90);
    const lastKept = addDaysToDayKey(dies, config.POINT_LOT_RETENTION_DAYS);
    expect(pruneLots(lots, new Date(`${lastKept}T09:00:00Z`), RULES)).toHaveLength(1);
    expect(pruneLots(lots, new Date(`${addDaysToDayKey(lastKept, 1)}T09:00:00Z`), RULES)).toHaveLength(0);
    // Lossless for every number a member sees: it was already worth 0.
    expect(liveBalance(lots, new Date(`${lastKept}T09:00:00Z`))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// L11 — the wire says WHICH points and HOW MANY.
// ---------------------------------------------------------------------------

describe('L11 nextExpiry names the earliest day and sums every lot on it', () => {
  it('two grants on one day report 80, not 40', () => {
    const lots = ledger([{ points: 40, onDay: -300 }, { points: 40, onDay: -300 }, { points: 25, onDay: -10 }]);
    const next = nextExpiry(lots, NOW);
    expect(next).toEqual({ amount: 80, on: lots[0].expiresOn });
    // "40 points expire on 15/11" would be false for half of them.
    expect(next!.amount).not.toBe(40);
  });

  it('a partly-spent lot reports what is LEFT, not what was granted', () => {
    const lots = ledger([{ points: 40, onDay: -300 }, { points: 25, onDay: -10 }]);
    const res = consumeFifo(lots, 30, NOW);
    if (!res.ok) throw new Error('unreachable');
    expect(nextExpiry(res.lots, NOW)).toEqual({ amount: 10, on: lots[0].expiresOn });
  });

  it('null when nothing is live — a fully expired member, and a brand-new one', () => {
    expect(nextExpiry([], NOW)).toBeNull();
    expect(nextExpiry(ledger([{ points: 100, onDay: -400 }]), NOW)).toBeNull();
    const spent = consumeFifo(ledger([{ points: 40, onDay: 0 }]), 40, NOW);
    if (!spent.ok) throw new Error('unreachable');
    expect(nextExpiry(spent.lots, NOW)).toBeNull();
  });

  it('parseMeBalance requires the field, and requires it to be a DAY KEY', () => {
    const wire = {
      points: 80, windowSpend: 12, visitDays: 2,
      tier: { id: 'base', nameAr: '٢٪', nameEn: '2%', multiplier: 1 },
      nextTier: null,
      nextExpiry: { amount: 80, on: '2027-11-15' },
    };
    expect(parseMeBalance(wire).nextExpiry).toEqual({ amount: 80, on: '2027-11-15' });
    expect(parseMeBalance({ ...wire, nextExpiry: null }).nextExpiry).toBeNull();

    // ABSENT IS NOT NULL. A producer that never thought about expiry would
    // otherwise render "no expiry" for a member whose points die next week.
    expect(() => parseMeBalance({ ...wire, nextExpiry: undefined })).toThrow(BalanceWireError);
    // 🔴 AN ISO INSTANT IS REFUSED. `new Date('2027-11-15T00:00:00Z')` reaching
    // the day-key formatter is how the app would print the day BEFORE the one
    // the server enforces.
    expect(() => parseMeBalance({
      ...wire, nextExpiry: { amount: 80, on: '2027-11-15T00:00:00.000Z' },
    })).toThrow(BalanceWireError);
    expect(() => parseMeBalance({ ...wire, nextExpiry: { amount: 'lots', on: '2027-11-15' } }))
      .toThrow(BalanceWireError);

    // ... and it survives the flattening into the type the screens read.
    expect(toLoyaltyBalance(parseMeBalance(wire), 'u1').nextExpiry).toEqual({ amount: 80, on: '2027-11-15' });
  });

  it('the day key is formatted from its own parts, on every host', () => {
    const originalTZ = process.env.TZ;
    try {
      const seen = new Set<string>();
      for (const tz of ['UTC', 'Asia/Amman', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
        process.env.TZ = tz;
        seen.add(formatDayKey('2027-11-15', 'en'));
      }
      // One answer, and it is the 15th — `new Date('2027-11-15')` is UTC
      // midnight and renders as the 14th west of Greenwich.
      expect([...seen]).toEqual(['Nov 15']);
    } finally {
      process.env.TZ = originalTZ;
    }
  });

  it('daysUntilDayKey counts calendar days, not milliseconds', () => {
    expect(daysUntilDayKey(day(14), NOW)).toBe(14);
    expect(daysUntilDayKey(TODAY, NOW)).toBe(0);
    expect(daysUntilDayKey(day(-1), NOW)).toBe(-1);
    // 21:30 UTC is already tomorrow in Amman, so "today" has moved on. A
    // millisecond countdown would still say 14.
    expect(daysUntilDayKey(day(14), new Date(`${TODAY}T21:30:00Z`))).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// L12 — the migration lot, and the 19,040 JOD guard it must not disarm.
// ---------------------------------------------------------------------------

describe('L12 the migration lot is dated at cutover and stays out of the history ledger', () => {
  it('one lot, seq 0, source migration, alive for a full 12 months from cutover', () => {
    const lots = migrateBalance(240, TODAY, RULES);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toEqual({
      seq: 0, grantedOn: TODAY, expiresOn: addMonthsToDayKey(TODAY, 12),
      amount: 240, remaining: 240, source: 'migration',
    });
    // 🔴 DATED AT CUTOVER, NOT AT LAST ACTIVITY. A rule may not take money
    // retroactively: these members were never told their points had a clock.
    // Dating the lot at last activity would kill most of the dormant tail on
    // day one, with no notice, for exactly the members most likely to complain.
    expect(liveBalance(lots, at(364))).toBe(240);
  });

  it('a zero or negative opening balance mints no lot at all', () => {
    expect(migrateBalance(0, TODAY, RULES)).toEqual([]);
    expect(migrateBalance(-5, TODAY, RULES)).toEqual([]);
    expect(() => migrationLot(0, TODAY, RULES)).toThrow(/positive/);
  });

  it('seq 0 plus the cutover date puts inherited liability FIRST in FIFO', () => {
    const withEarned = grantLot(migrateBalance(100, TODAY, RULES), 50, 'earn', NOW, RULES).lots;
    const res = consumeFifo(withEarned, 120, NOW);
    if (!res.ok) throw new Error('unreachable');
    expect(res.consumed).toEqual([{ seq: 0, points: 100 }, { seq: 1, points: 20 }]);
    expect(res.lots[0].source).toBe('migration');
  });

  it('a migrated member is still `unexplainedPoints > 0`, so W2\'s guard still refuses', () => {
    // 🔴 THE 19,040 JOD LINE. `unexplainedPoints` is
    // liveBalance − Σ(history deltas), and the migration grant writes NO
    // history row. Log it and every one of the 47,720 migrated members becomes
    // "explained", the guard stops tripping, and each one's next drink is a
    // "first identified transaction": 47,720 × 0.399 JOD of material.
    const lots = migrateBalance(240, TODAY, RULES);
    const history: { deltaPoints: number }[] = []; // a migration writes nothing
    const unexplainedPoints = liveBalance(lots, NOW) - history.reduce((s, h) => s + h.deltaPoints, 0);
    expect(unexplainedPoints).toBe(240);

    const decision = decideSecondVisit({
      memberId: 'm_migrated', orderId: 'o1', voucherId: 'svv_1',
      basketHasDrink: true, arm: assignHoldout('m_migrated', holdoutSpecFromConfig('secondVisitVoucher')),
      alreadyEvaluated: false, priorTransactions: 0,
      unexplainedPoints, priorWindowSpend: 0, at: NOW,
    }, secondVisitRulesFromConfig());
    expect(decision.row!.outcome).toBe('ineligible');
  });
});

// ---------------------------------------------------------------------------
// L13 — the grant guards.
// ---------------------------------------------------------------------------

describe('L13 a zero grant writes no lot, and a negative one throws', () => {
  it('zero appends nothing — computeEarn returns 0 on a small invoice', () => {
    const before = ledger([{ points: 10, onDay: 0 }]);
    const res = grantLot(before, 0, 'earn', NOW, RULES);
    expect(res.lot).toBeNull();
    expect(res.lots).toEqual(before);
    expect(res.lots).not.toBe(before); // still a copy; the caller's is untouched
  });

  it('negative and fractional grants throw rather than poisoning the sums', () => {
    // `addPoints(id, delta)` had no sign guard. One −50 lot makes every
    // subsequent sum silently wrong; one float makes Σ disagree with the
    // integer on the member's screen (1 point = 1 qirsh, exactly).
    expect(() => grantLot([], -50, 'earn', NOW, RULES)).toThrow(/negative/);
    expect(() => grantLot([], 12.5, 'earn', NOW, RULES)).toThrow(/whole number/);
  });

  it('seq rises monotonically, and a pruned dead lot cannot collide with a live one', () => {
    let lots = ledger([{ points: 10, onDay: -400 }, { points: 10, onDay: -10 }]);
    expect(lots.map((l) => l.seq)).toEqual([0, 1]);
    // Prune the dead row, then grant again: the new seq must not reuse 0.
    lots = pruneLots(lots, at(60), RULES);
    expect(lots.map((l) => l.seq)).toEqual([1]);
    lots = grantLot(lots, 10, 'earn', at(60), RULES).lots;
    expect(lots.map((l) => l.seq)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// L14 — the copy matches the code.
// ---------------------------------------------------------------------------

describe('L14 no string promises what the ledger does not do', () => {
  const LOCALES = [
    'almond-app/locales/en.json', 'almond-app/locales/ar.json',
    'almond-web/src/messages/en.json', 'almond-web/src/messages/ar.json',
  ];
  const flatten = (v: unknown, prefix = '', out: Record<string, string> = {}) => {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (val && typeof val === 'object') flatten(val, key, out);
      else out[key] = String(val);
    }
    return out;
  };
  const load = (rel: string) => flatten(JSON.parse(readFileSync(join(REPO, rel), 'utf8')));

  it('no locale value in any of the four files says points never expire', () => {
    // 🔴 THE W4 DEFECT, IN THE ONE PLACE IT COSTS THE MEMBER MONEY. Three
    // strings said this — rewards.beansNeverExpire, tierBenefits.noExpire and
    // the tail of loyalty.tierMax — because the retired rule really did exempt
    // the top rung. Under «لا إعفاء» every one of them is now a lie.
    const offenders: string[] = [];
    for (const rel of LOCALES) {
      for (const [k, v] of Object.entries(load(rel))) {
        if (/never expire|لا تنتهي|ما بتنتهي|بينتهي\s*ولا/i.test(v)) offenders.push(`${rel} ${k}: ${v}`);
      }
    }
    expect(
      offenders,
      `every point expires 12 months after it is granted: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('the expiry copy names a POINTS COUNT as well as a date, in both languages', () => {
    // Under a per-lot rule "your points expire on 15/11" is false for every
    // point that is not in that slice. The sentence has to say which ones.
    for (const rel of ['almond-app/locales/en.json', 'almond-app/locales/ar.json']) {
      const flat = load(rel);
      for (const key of ['rewards.pointsExpireNext', 'home.nudgeExpiry']) {
        expect(flat[key], `${rel} ${key}`).toBeTruthy();
        expect(flat[key], `${rel} ${key} must name the count`).toContain('{{points}}');
        expect(flat[key], `${rel} ${key} must name the day`).toContain('{{date}}');
      }
    }
  });

  it('the retired keys are gone from both files, not just from one', () => {
    for (const rel of ['almond-app/locales/en.json', 'almond-app/locales/ar.json']) {
      const flat = load(rel);
      for (const key of ['rewards.beansNeverExpire', 'rewards.beansExpire', 'tierBenefits.noExpire']) {
        expect(flat[key], `${rel} still carries ${key}`).toBeUndefined();
      }
    }
  });

  it('no source hands a day key to a date formatter that parses an instant', () => {
    // `new Date('2026-11-15')` is UTC midnight, so formatDate would render the
    // 14th on any host west of Greenwich — a day earlier than the ledger
    // enforces. formatDayKey exists for exactly this and must be what is used.
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('almond-app/') && !f.path.startsWith('almond-web/')) continue;
      f.code.forEach((line, i) => {
        if (/formatDate\s*\(\s*[\w.]*\bnextExpiry\b/.test(line) || /new Date\(\s*[\w.]*\bnextExpiry\.on\b/.test(line)) {
          offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(offenders, `a day key must go through formatDayKey: ${offenders.join(' | ')}`).toEqual([]);
  });
});
