import { describe, it, expect, afterEach } from 'vitest';
import { ammanDayKey, ammanWeekday } from '@almond/shared/lib/ammanWeekday';
import { computeEarn } from '@almond/shared/loyalty/earn';
import {
  addMonthsToDayKey, consumeFifo, grantLot, liveBalance, lotExpiresOn,
  lotRulesFromConfig, migrateBalance, nextExpiry, type PointLot,
} from '@almond/shared/loyalty/lots';
import {
  qualifyingSpend, qualifyingVisitDays, spendEntry, windowRulesFromConfig,
} from '@almond/shared/loyalty/window';
import { comboPairs } from '@almond/shared/lib/combo';
import type { CartItem } from '@almond/shared/types';
import {
  mockLoyaltyService,
  settleExpiry,
  __setMockSpinConfig,
  __getMockUser,
  type LoyaltyUser,
} from '@/services/loyalty.service.mock';
import { estimateEarnedPoints, ESTIMATE_RULES } from '@/lib/earnEstimate';
import { defaultSpinConfig } from '@/services/spinDefaults';

/**
 * The mock's own internals: spin/eligibility (D9) and expiry enforcement
 * (D10/D11). These cannot run from bff/ — that workspace does not depend on
 * almond-app and cannot resolve the `@/` alias. See LOYALTY-EARN-PATCH §7.
 *
 * §7 T-numbers covered here: T11 is 'a free-spin day grants exactly one spin
 * per day'; T15 is 'a stale balance actually reaches zero' plus 'a GET never
 * mutates' and 'runs on the write path too'. T13 is held behind §8.3, below.
 * Everything else in §7 lives in bff/test/earn.test.ts.
 *
 * Plus the APP-SIDE half of T7. bff/test/earn.test.ts's T7b binds the server's
 * earn module to the shared function by identity; nothing bound the app's. T7's
 * static walk is name-based, so a fork written with numeric literals is
 * invisible to it — and a fork in the app is D2 itself, since DATA_SOURCE is
 * 'mock' and this mock IS the app's live grant. 'D2 — one earn calculation'
 * below binds both app paths (the grant and the displayed estimate) by VALUE.
 */

const DAY = 86400000;
let seq = 0;
const newUserId = () => `test-user-${++seq}`;

function cartLine(itemId: string, unitBasePrice: number, qty: number, isDrink: boolean): CartItem {
  return {
    lineId: `${itemId}__M`, itemId, nameAr: '', nameEn: '', emoji: '',
    sizeId: 'M', sizeNameAr: '', sizeNameEn: '',
    unitBasePrice, customizations: [], qty, isDrink,
  };
}

const LOT_RULES = lotRulesFromConfig();

/**
 * A member holding `points` granted `ageDays` ago, and nothing else.
 *
 * The successor to `staleBeanUser`. That one had to reset `heldTierId` too,
 * because the expiry rule read the member's RUNG (the 6% rung was exempt). It
 * does not any more — «لا إعفاء — القاعدة للجميع» — so the rung is left alone
 * here on purpose, and the L4 tests set it deliberately to prove it is ignored.
 */
function memberWithLots(
  grants: { points: number; ageDays: number }[],
  rung: LoyaltyUser['heldTierId'] = 'base',
): { id: string; u: LoyaltyUser } {
  const id = newUserId();
  const u = __getMockUser(id);
  u.spendLog = [];
  u.heldTierId = rung;
  u.lots = [];
  u.history = [];
  for (const g of grants) {
    u.lots = grantLot(u.lots, g.points, 'earn', new Date(Date.now() - g.ageDays * DAY), LOT_RULES).lots;
  }
  // Stamped at the OLDEST grant day, which is what a real member looks like:
  // the stamp is written at member creation and every lot granted after it
  // expires later than it does, so nothing is ever born already-settled. A
  // fixture that stamped `today` over back-dated lots would claim their expiry
  // had already been booked and would quietly measure nothing.
  u.expirySettledThrough = u.lots.length
    ? u.lots.map((l) => l.grantedOn).sort()[0]
    : ammanDayKey();
  return { id, u };
}

afterEach(() => {
  __setMockSpinConfig(JSON.parse(JSON.stringify(defaultSpinConfig)));
});

describe('D2 — one earn calculation: the app grants what computeEarn returns', () => {
  const MON = new Date('2026-09-07T10:00:00Z'); // Monday in Amman
  const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday — BONUS_BEAN_DAY
  const FRI = new Date('2026-09-11T10:00:00Z'); // Friday — WEEKDAY_EARN_BONUS

  /** A member whose 90-day window spend is exactly `windowSpend`, with a fresh
   *  ledger so points start at zero. One entry
   *  the day before `asOf`: the same spend on the same day as before, now
   *  expressed in the shared {jod, day} entry. `heldTierId` is reset to the
   *  entry rung so the fixture means what its name says — the RUNG is
   *  max(floor, window), so a leftover 'top' floor would pay 6% on a 0 JOD
   *  window.
   *
   *  🔴 `asOf` IS THE EVALUATION INSTANT, NOT `Date.now()`, AND THAT IS THE
   *  WHOLE POINT. This dated the spend at `Date.now() - DAY` while every
   *  assertion evaluates at a FIXED `at` (MON/TUE/FRI). Those two clocks agree
   *  only until the wall clock passes the fixed hour: run this suite after
   *  10:00 UTC and `Date.now() - DAY` lands AFTER `MON`, so the spend has not
   *  happened yet at the instant being measured, the window reads 0, and the
   *  member is paid the entry rung while the test expects the rung 150 JOD
   *  buys. Two tests went red every afternoon and green every morning — a
   *  fixture bug that reads exactly like an app-vs-shared divergence, which is
   *  the one thing this suite exists to detect.
   *
   *  Anchoring to `asOf` makes the fixture mean "a day before we look",
   *  whenever we look. */
  function memberWithSpend(windowSpend: number, asOf: Date): string {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spendLog = windowSpend > 0
      ? [spendEntry(windowSpend, new Date(asOf.getTime() - DAY))]
      : [];
    u.heldTierId = 'base';
    u.lots = [];
    u.expirySettledThrough = ammanDayKey();
    return id;
  }

  it('earn: pointsEarned === computeEarn(...).points over the whole input matrix', async () => {
    // THIS IS THE APP-SIDE ANTI-DIVERGENCE TEST. T7's walk is name-based, so a
    // hand-rolled fork using numeric literals passes it; this does not.
    for (const total of [7.2, 20.3]) {
      for (const windowSpend of [0, 150, 750]) {
        for (const paidFromBalance of [false, true]) {
          for (const pairs of [0, 2]) {
            for (const bonusDayActivated of [false, true]) {
              for (const at of [MON, TUE, FRI]) {
                const id = memberWithSpend(windowSpend, at);
                const where = JSON.stringify({
                  total, windowSpend, paidFromBalance, pairs, bonusDayActivated,
                  at: at.toISOString(),
                });
                const res = await mockLoyaltyService.earn({
                  userId: id,
                  invoiceAmount: total,
                  paidFromBalance,
                  comboPairs: pairs,
                  bonusDayActivated,
                  at,
                });
                const expected = computeEarn({
                  total, windowSpend, paidFromBalance, comboPairs: pairs,
                  bonusDayActivated, at,
                }).points;
                expect(res.pointsEarned, where).toBe(expected);
                // ... and the balance moves by exactly that, never by that plus
                // a separately-added combo bonus (the pre-patch app did add it
                // twice-over, outside the ceiling — §4 D4).
                expect(liveBalance(__getMockUser(id).lots), where).toBe(expected);
              }
            }
          }
        }
      }
    }
  });

  it('earn: a redemption reaches the shared calculation, and only cash earns', async () => {
    // Owner, 2026-09-08: points are money off the bill, and «لا يكسب نقاط على
    // الجزء المدفوع بالنقاط». The phone must show the grant the server will
    // pay, so the mock forwards `pointsRedeemed` rather than holding its own
    // idea of what a redemption is worth — a second conversion here would show
    // one number on the phone and charge another at the till.
    //
    // 10 JOD with 300 points (3.00 JOD) spent on it: 7 JOD of cash at the 2%
    // entry rung = 14 points, not the 20 the full invoice would have paid.
    const partial = await mockLoyaltyService.earn({
      userId: memberWithSpend(0, MON), invoiceAmount: 10, paidFromBalance: false,
      pointsRedeemed: 300, at: MON,
    });
    expect(partial.pointsEarned).toBe(14);
    expect(partial.pointsEarned).toBe(
      computeEarn({ total: 10, pointsRedeemed: 300, at: MON }).points,
    );

    // ... and a bill made FREE with points earns nothing and banks no lot.
    const id = memberWithSpend(65, MON);            // the 6% rung: the ladder cannot
    const free = await mockLoyaltyService.earn({ //  rescue a percentage of zero
      userId: id, invoiceAmount: 10, paidFromBalance: false,
      pointsRedeemed: 1000, at: MON,
    });
    expect(free.pointsEarned).toBe(0);
    expect(liveBalance(__getMockUser(id).lots)).toBe(0);
  });

  it('earn: one absolute number, so a change to BOTH sides at once still shows', async () => {
    // The matrix above binds the app to computeEarn, so it stays green if BOTH
    // sides drift together. This one literal is the anchor that does not.
    //
    // 🔴 THIS NUMBER MOVED ON 2026-09-08, AND THAT IS THE TEST WORKING.
    //
    // It was 20, with a comment saying "paying from the wallet adds NOTHING
    // since 2026-09-06 — the wallet multiplier is retired, which is exactly the
    // kind of change this test exists to surface." It surfaced it.
    //
    // 10 JOD at the 2% entry rung is 20 points; paying from the WALLET now pays
    // 1.5× — the gift-card promise «٥٠٪ رصيد نقاط اضافي عند صرفها», where
    // gift-card balance and top-up balance are one thing. 30 points.
    const id = memberWithSpend(0, MON);
    const res = await mockLoyaltyService.earn({
      userId: id, invoiceAmount: 10, paidFromBalance: true, at: MON,
    });
    expect(res.pointsEarned).toBe(30);

    // The same invoice paid in CASH is still the plain 20 — the anchor for the
    // rate itself, unmixed with the wallet bonus.
    expect((await mockLoyaltyService.earn({
      userId: memberWithSpend(0, MON), invoiceAmount: 10, paidFromBalance: false, at: MON,
    })).pointsEarned).toBe(20);

    // The two rungs above it, on the same invoice: 4% and 6%.
    expect((await mockLoyaltyService.earn({
      userId: memberWithSpend(20, MON), invoiceAmount: 10, paidFromBalance: false, at: MON,
    })).pointsEarned).toBe(40);
    expect((await mockLoyaltyService.earn({
      userId: memberWithSpend(65, MON), invoiceAmount: 10, paidFromBalance: false, at: MON,
    })).pointsEarned).toBe(60);
  });

  it('estimate: the number shown at checkout is computeEarn on the shipped rules', () => {
    // §3.5 row 5: the estimate must equal the grant BY CONSTRUCTION. The one
    // deliberate difference is ESTIMATE_RULES' `weekdayBonus: []` (§8.9), and
    // binding against that same object is what keeps the difference deliberate.
    const items: CartItem[] = [
      cartLine('mineral-water', 0.75, 2, true),
      cartLine('cake-pop', 1.0, 2, false),
    ];
    expect(comboPairs(items)).toBe(2);

    for (const windowSpend of [0, 150, 750]) {
      for (const paidFromBalance of [false, true]) {
        const shown = estimateEarnedPoints({ total: 20.3, items, windowSpend, paidFromBalance });
        const expected = computeEarn(
          { total: 20.3, windowSpend, paidFromBalance, comboPairs: comboPairs(items) },
          ESTIMATE_RULES,
        ).points;
        expect(shown, JSON.stringify({ windowSpend, paidFromBalance })).toBe(expected);
      }
    }
  });
});

describe('W1 — the app and the BFF measure the SAME 90-day window', () => {
  const RULES = windowRulesFromConfig();

  /** A member with an explicit spend log and nothing else going on. */
  function memberWithLog(log: { jod: number; daysAgo: number }[]): { id: string; u: LoyaltyUser } {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spendLog = log.map((e) => spendEntry(e.jod, new Date(Date.now() - e.daysAgo * DAY)));
    u.heldTierId = 'base';
    u.lots = [];
    u.expirySettledThrough = ammanDayKey();
    return { id, u };
  }

  it('balance.windowSpend IS qualifyingSpend over the shared window', async () => {
    // The app used to compute this itself, over a rolling 365 days, while the
    // BFF accumulated forever — so the same member could be two different tiers
    // on the phone and on the server. This binds the displayed number to the
    // shared function BY VALUE, which a name-based static walk cannot do.
    const { id, u } = memberWithLog([
      { jod: 30, daysAgo: 2 },
      { jod: 25, daysAgo: 85 },
      { jod: 400, daysAgo: 200 }, // outside the window — the whole point
    ]);
    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.windowSpend).toBe(qualifyingSpend(u.spendLog, RULES));
    expect(bal.visitDays).toBe(qualifyingVisitDays(u.spendLog, RULES));
    // 400 JOD of 200-day-old spend counts for exactly nothing.
    expect(bal.windowSpend).toBe(55);
    expect(bal.tier).toBe('plus');
  });

  it('four visit days reach the 4% rung on 12 JOD, exactly as on the BFF', async () => {
    // TIER2_VISITS_ALTERNATIVE: 4 visits is 12 JOD here, 40% of the 20 JOD
    // door. The alternative door is what makes the copy sayable.
    const { id } = memberWithLog([
      { jod: 3, daysAgo: 1 }, { jod: 3, daysAgo: 4 },
      { jod: 3, daysAgo: 9 }, { jod: 3, daysAgo: 20 },
    ]);
    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.windowSpend).toBe(12);
    expect(bal.visitDays).toBe(4);
    expect(bal.tier).toBe('plus');
    expect(bal.multiplier).toBe(2);
  });

  it('the rung never goes down when the window rolls off (there is no demotion)', async () => {
    // Earn to the top rung, then let every entry age out of the window.
    const { id, u } = memberWithLog([]);
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 70, paidFromBalance: false });
    expect((await mockLoyaltyService.getBalance(id)).tier).toBe('top');

    // Age the whole log past the window. windowSpend collapses; the rate does not.
    u.spendLog = u.spendLog.map((e) => spendEntry(e.jod, new Date(Date.now() - 200 * DAY)));
    const after = await mockLoyaltyService.getBalance(id);
    expect(after.windowSpend).toBe(0);
    expect(after.visitDays).toBe(0);
    expect(after.tier).toBe('top');
    expect(after.multiplier).toBe(3);
  });

  it('a ratcheted member is GRANTED the rate their balance shows, and quoted it too', async () => {
    // THE DIVERGENCE THIS TEST EXISTS FOR. buildBalance shows max(floor, live
    // window); if the grant were computed from windowSpend alone, a member
    // whose window has rolled off would be shown 6%, quoted 6% at checkout, and
    // paid 2% — D2 reopened on the ratchet, visible to nobody.
    const monday = new Date('2026-09-07T10:00:00Z');
    const { id, u } = memberWithLog([]);
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 70, paidFromBalance: false });
    u.spendLog = u.spendLog.map((e) => spendEntry(e.jod, new Date(Date.now() - 200 * DAY)));

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.windowSpend).toBe(0);
    expect(bal.tier).toBe('top');

    // 10 JOD at the 6% rung is 60 points — NOT the 20 that a 0 JOD window
    // would earn on its own.
    const res = await mockLoyaltyService.earn({
      userId: id, invoiceAmount: 10, paidFromBalance: false, at: monday,
    });
    expect(res.pointsEarned).toBe(60);

    // ... and the number the cart showed before they paid is the same number.
    expect(estimateEarnedPoints({
      total: 10, items: [], windowSpend: bal.windowSpend, heldRungId: bal.tier,
      paidFromBalance: false,
    })).toBe(res.pointsEarned);
  });
});

describe('D9 — free-spin day', () => {
  it('spin: a free-spin day grants exactly one spin per day', async () => {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spinsAvailable = 0; // the free-spin day must be the ONLY source
    u.grantDay = '';
    u.grantDayCount = 0;
    __setMockSpinConfig({
      ...defaultSpinConfig,
      eligibility: {
        ...defaultSpinConfig.eligibility,
        // The wheel ships OFF (owner, 2026-09-03). D9 is about the grant
        // logic, so it is turned on explicitly here — the shipped default is
        // asserted separately below.
        enabled: true,
        freeSpinDays: [ammanWeekday(new Date())],
      },
    });

    await expect(mockLoyaltyService.spin(id)).resolves.toBeTruthy();
    // Pre-patch this looped forever: the grant was counted by computeEligibility
    // but never consumed, so canSpin stayed true all day.
    await expect(mockLoyaltyService.spin(id)).rejects.toThrow('No spins available');
    expect((await mockLoyaltyService.getSpinEligibility(id)).spinsAvailable).toBe(0);
  });

  it('spin: eligibility and consumption read the same counter', async () => {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spinsAvailable = 0;
    u.grantDay = '';
    u.grantDayCount = 0;
    __setMockSpinConfig({
      ...defaultSpinConfig,
      eligibility: {
        ...defaultSpinConfig.eligibility,
        // The wheel ships OFF (owner, 2026-09-03). D9 is about the grant
        // logic, so it is turned on explicitly here — the shipped default is
        // asserted separately below.
        enabled: true,
        freeSpinDays: [ammanWeekday(new Date())],
      },
    });

    // Reading eligibility repeatedly must not mint spins.
    expect((await mockLoyaltyService.getSpinEligibility(id)).spinsAvailable).toBe(1);
    expect((await mockLoyaltyService.getSpinEligibility(id)).spinsAvailable).toBe(1);
    expect(u.spinsAvailable).toBe(1);
  });

  it('spin: with no free-spin day configured, banked spins still work exactly once', async () => {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spinsAvailable = 1; // the seeded default
    __setMockSpinConfig({
      ...defaultSpinConfig,
      eligibility: { ...defaultSpinConfig.eligibility, enabled: true },
    });

    await expect(mockLoyaltyService.spin(id)).resolves.toBeTruthy();
    await expect(mockLoyaltyService.spin(id)).rejects.toThrow('No spins available');
  });

  it('spin: the wheel ships OFF — re-enabling it is a product decision', () => {
    // The branches stopped running it (owner, 2026-09-03) and the code now
    // agrees. It is also the most expensive mechanism in the programme if
    // switched on: no losing slot, so every spin wins, and the prize table is
    // worth ~2.67 JOD a spin at menu prices — one spin per five visits is
    // ~7.4% of an average 7.16 JOD invoice, on top of points (§8.4).
    expect(defaultSpinConfig.eligibility.enabled).toBe(false);
  });
});

/**
 * L1-L4 / T13 — THE PER-LOT RULE, THROUGH THE PATH A SCREEN ACTUALLY TAKES.
 *
 * The pure arithmetic is asserted in bff/test/lots.test.ts (L1-L14); this half
 * is the enforcement, mirroring the D10/D11 split the deleted file documented.
 * The block this replaces asserted the OPPOSITE rule — a whole balance dying
 * after 12 silent months, with the 6% rung exempt — and every one of its tests
 * is deleted because its subject is, not to make anything pass.
 */
describe('L — per-lot expiry, through the mock the app really runs on', () => {
  it('L1 a lot dies on schedule even though the member kept buying', () => {
    // 🔴 THE TEST. 100 points a year and a day old, 100 points fresh.
    //
    // Under the INACTIVITY rule this replaced, the recent grant renewed
    // everything and the answer was 200. Under a per-account rule with no
    // renewal it would be 0. Only a per-LOT rule gives 100, and that is the
    // owner's rule: «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد».
    const { u } = memberWithLots([{ points: 100, ageDays: 400 }, { points: 100, ageDays: 5 }]);
    expect(liveBalance(u.lots)).toBe(100);
    expect(u.lots).toHaveLength(2); // the dead row is still there; it is worth 0
  });

  it('L2/L3 earn then redeem: oldest first, and the remainder keeps its own clock', async () => {
    // Three 40-point grants three months apart, spend 100 through the same
    // method the rewards screen calls.
    const { id, u } = memberWithLots([
      { points: 40, ageDays: 180 }, { points: 40, ageDays: 90 }, { points: 40, ageDays: 1 },
    ]);
    const newest = u.lots[2];
    const before = { ...newest };

    const res = await mockLoyaltyService.redeemReward(id, {
      beans: 100, titleAr: 'مكافأة', titleEn: 'Reward', type: 'free-item',
    });
    expect(res.points).toBe(20);
    expect(u.lots.map((l) => l.remaining)).toEqual([0, 0, 20]);

    // 🔴 THE PARTIALLY CONSUMED LOT WAS NOT RE-DATED. Re-dating it (or closing
    // it and re-granting the remainder) silently extends those 20 points by up
    // to 12 months, and does it again on every partial spend — the inactivity
    // rule sneaking back in through the redemption path.
    expect(u.lots[2].grantedOn).toBe(before.grantedOn);
    expect(u.lots[2].expiresOn).toBe(before.expiresOn);
    expect(u.lots[2].amount).toBe(before.amount); // the audit number never moves
    expect(u.lots[2].seq).toBe(before.seq);
  });

  it('L6 a redemption bigger than the LIVE balance is refused, and moves nothing', async () => {
    const { id, u } = memberWithLots([{ points: 100, ageDays: 400 }, { points: 40, ageDays: 1 }]);
    const snapshot = JSON.parse(JSON.stringify(u.lots));
    await expect(mockLoyaltyService.redeemReward(id, {
      beans: 60, titleAr: 'مكافأة', titleEn: 'Reward', type: 'free-item',
    })).rejects.toThrow('Not enough beans');
    // 100 of the 140 points are dead, so 60 is short — and the refusal is
    // ATOMIC: a loop that debits the live lot first and only then discovers it
    // is short leaves the member charged for a reward they never received.
    expect(u.lots).toEqual(snapshot);
    expect(u.vouchers.some((v) => v.titleEn === 'Reward')).toBe(false);
  });

  it('T13/L4 every rung expires on the same clock — the 6% rung is NOT exempt', async () => {
    // 🔴 THE DISCHARGE OF `it.todo('T13 expiry: every tier expires on the same
    // clock')`, which was pre-registered for exactly this change. The todo's own
    // wording described a SMALLER change than the one that shipped — it expected
    // `beansExpireAt` to lose its tierId argument. There is no beansExpireAt any
    // more, and no per-account expiry at all: the whole rule was replaced, and
    // the tier cannot be consulted because @almond/shared/loyalty/lots.ts does
    // not import the tier table. Owner: «لا إعفاء — القاعدة للجميع».
    const grants = [{ points: 500, ageDays: 400 }, { points: 60, ageDays: 3 }];
    const base = memberWithLots(grants, 'base');
    const top = memberWithLots(grants, 'top');
    // Same rung on the wire as the fixture asked for, so the assertion below is
    // about expiry and not about a fixture that silently reset itself.
    expect((await mockLoyaltyService.getBalance(top.id)).tier).toBe('top');
    expect((await mockLoyaltyService.getBalance(base.id)).tier).toBe('base');

    const b = await mockLoyaltyService.getBalance(base.id);
    const t = await mockLoyaltyService.getBalance(top.id);
    expect(t.points).toBe(b.points);
    expect(t.points).toBe(60);
    expect(t.nextExpiry).toEqual(b.nextExpiry);
  });

  it('L10 a read never mutates — two GETs agree across a boundary (D11)', async () => {
    const { id, u } = memberWithLots([{ points: 500, ageDays: 400 }]);
    const snapshot = JSON.parse(JSON.stringify(u.lots));
    const a = await mockLoyaltyService.getBalance(id);
    const b = await mockLoyaltyService.getBalance(id);
    // The number is right on the FIRST read, with no sweep and no side effect:
    // a dead lot is worth 0 to liveBalance from the instant it dies. D11 used
    // to need policing (`expirePoints` was a mutation a read had to trigger);
    // now it holds by construction and this proves it.
    expect(a.points).toBe(0);
    expect(b.points).toBe(a.points);
    expect(a.nextExpiry).toBeNull();
    expect(u.lots).toEqual(snapshot);
    expect(u.history).toEqual([]); // and no history row was written by a GET
  });

  it('L11 the balance says WHICH points die next, summed over the whole day', async () => {
    const { id, u } = memberWithLots([
      { points: 40, ageDays: 300 }, { points: 40, ageDays: 300 }, { points: 25, ageDays: 10 },
    ]);
    const bal = await mockLoyaltyService.getBalance(id);
    // TWO grants on one day report 80, not 40. "40 points expire on 15/11" is
    // the sentence, and a payload that can only name one lot cannot say it.
    expect(bal.nextExpiry).toEqual({ amount: 80, on: u.lots[0].expiresOn });
    expect(bal.nextExpiry!.on).toBe(lotExpiresOn(u.lots[0].grantedOn, LOT_RULES));
    // ... and it is an Amman DAY KEY, not an ISO instant. Anything that reaches
    // `new Date(string)` renders the day BEFORE west of Greenwich.
    expect(bal.nextExpiry!.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('L12 the ledger line: expiry is written to history on the next write, once', async () => {
    const { id, u } = memberWithLots([{ points: 500, ageDays: 400 }]);
    // A member who never comes back is never formally settled, and it costs
    // nothing: their balance already reads 0 to everyone. The row is written on
    // the next write path — here, an order.
    expect(liveBalance(u.lots)).toBe(0);
    expect(u.history).toEqual([]);

    const res = await mockLoyaltyService.earn({ userId: id, invoiceAmount: 10, paidFromBalance: false });
    const expiredRows = u.history.filter((h) => h.deltaPoints === -500);
    expect(expiredRows).toHaveLength(1);
    expect(expiredRows[0].reasonEn).toBe('Points expired');
    // The grant survives; the dead 500 do not, and the grant did not revive them.
    expect(liveBalance(u.lots)).toBe(res.pointsEarned);
    expect(res.pointsEarned).toBeGreaterThan(0);

    // IDEMPOTENT. A second write does not book the same loss twice.
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 10, paidFromBalance: false });
    expect(u.history.filter((h) => h.deltaPoints === -500)).toHaveLength(1);
    expect(settleExpiry(u)).toBe(0);
  });

  it('L1b a top-up grants its own lot and renews nothing', async () => {
    // `u.lastEarnAt = Date.now(); // a reload counts as activity (extends
    // beans)` used to sit in topUp. That ONE LINE was the inactivity rule: a
    // 20 JOD reload resurrected a year of dormant points. It is gone.
    const { id, u } = memberWithLots([{ points: 500, ageDays: 400 }]);
    await mockLoyaltyService.topUp(id, 20);
    const bonus = u.lots.filter((l) => l.source === 'bonus');
    expect(bonus).toHaveLength(1);
    expect(liveBalance(u.lots)).toBe(bonus[0].amount); // the 500 stayed dead
  });

  it('L5 the seeded demo member is a ledger, not a scalar', async () => {
    // The shipped mock is the app's ONLY data source (config.DATA_SOURCE is
    // 'mock'), so its seed is what every screen renders on first launch. It
    // holds two grants made months apart, which is what makes `nextExpiry`
    // non-null and the home nudge's expiring-soon window reachable at all.
    const id = newUserId();
    const u = __getMockUser(id);
    expect(u.lots.length).toBeGreaterThan(1);
    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.points).toBe(liveBalance(u.lots));
    expect(bal.points).toBe(u.lots.reduce((s, l) => s + l.remaining, 0));
    expect(bal.nextExpiry).not.toBeNull();
    // FIFO: the oldest grant is the one closest to death.
    const oldest = [...u.lots].sort((a, b) => a.grantedOn.localeCompare(b.grantedOn))[0];
    expect(bal.nextExpiry!.on).toBe(oldest.expiresOn);
  });
});
