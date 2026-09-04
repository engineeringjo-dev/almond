import { describe, it, expect, afterEach } from 'vitest';
import { ammanWeekday } from '@almond/shared/lib/ammanWeekday';
import { expiryAt } from '@almond/shared/loyalty/expiry';
import { computeEarn } from '@almond/shared/loyalty/earn';
import { comboPairs } from '@almond/shared/lib/combo';
import type { CartItem } from '@almond/shared/types';
import {
  mockLoyaltyService,
  expirePoints,
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

/** A Bean member (no qualifying spend in the window) who last earned `ageDays`
 *  ago. Bean, not Silver: the seeded spend log would otherwise put them a tier
 *  up — the expiry RULE is tier-sensitive (Gold/Black are exempt, §8.3). */
function staleBeanUser(ageDays: number, points: number): { id: string; u: LoyaltyUser } {
  const id = newUserId();
  const u = __getMockUser(id);
  u.spendLog = [];
  u.points = points;
  u.lastEarnAt = Date.now() - ageDays * DAY;
  return { id, u };
}

afterEach(() => {
  __setMockSpinConfig(JSON.parse(JSON.stringify(defaultSpinConfig)));
});

describe('D2 — one earn calculation: the app grants what computeEarn returns', () => {
  const MON = new Date('2026-09-07T10:00:00Z'); // Monday in Amman
  const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday — BONUS_BEAN_DAY
  const FRI = new Date('2026-09-11T10:00:00Z'); // Friday — WEEKDAY_EARN_BONUS

  /** A member whose rolling-12m spend is exactly `windowSpend`, with a fresh
   *  `lastEarnAt` so expiry never fires and points start at zero. */
  function memberWithSpend(windowSpend: number): string {
    const id = newUserId();
    const u = __getMockUser(id);
    u.spendLog = windowSpend > 0 ? [{ amount: windowSpend, at: Date.now() - DAY }] : [];
    u.points = 0;
    u.lastEarnAt = Date.now();
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
                const id = memberWithSpend(windowSpend);
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
                expect(__getMockUser(id).points, where).toBe(expected);
              }
            }
          }
        }
      }
    }
  });

  it('earn: one absolute number, so a change to BOTH sides at once still shows', async () => {
    // 10 JOD x 5 pts/JOD = 50 base, wallet x1.5 = 75. Bean, Monday, no pairs.
    const id = memberWithSpend(0);
    const res = await mockLoyaltyService.earn({
      userId: id, invoiceAmount: 10, paidFromBalance: true, at: MON,
    });
    expect(res.pointsEarned).toBe(75);
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

describe('D10/D11 — expiry is explicit, and it still happens', () => {
  it('expiry: a stale balance actually reaches zero', () => {
    const { u } = staleBeanUser(400, 500);
    // THIS is the assertion that detects expiry having silently stopped
    // running when the buildBalance side effect was removed (§4 D10/D11).
    expect(expirePoints(u, Date.now())).toBe(500);
    expect(u.points).toBe(0);
  });

  it('expiry: a fresh balance is untouched, and Gold/Black stay exempt', () => {
    const { u: fresh } = staleBeanUser(30, 500);
    expect(expirePoints(fresh, Date.now())).toBe(0);
    expect(fresh.points).toBe(500);

    // Today's RULE, unchanged: the top tiers are exempt. Removing that
    // exemption is D5, held behind §8.3 — it must NOT ship with this unit.
    const { u: black } = staleBeanUser(400, 500);
    black.spendLog = [{ amount: 5000, at: Date.now() - 10 * DAY }];
    expect(expirePoints(black, Date.now())).toBe(0);
    expect(black.points).toBe(500);
  });

  it('expiry: 360 days is not yet expired (D10)', () => {
    const { u } = staleBeanUser(360, 500);
    expect(expirePoints(u, Date.now())).toBe(0);
    expect(u.points).toBe(500);
  });

  it('expiry: a GET never mutates — two reads agree (D11)', async () => {
    const { id } = staleBeanUser(400, 500);
    const a = await mockLoyaltyService.getBalance(id);
    const b = await mockLoyaltyService.getBalance(id);
    expect(a.points).toBe(0); // expiry ran explicitly, before the response
    expect(b.points).toBe(a.points);
  });

  it('expiry: runs on the write path too — earn() expires before it grants', async () => {
    const { id, u } = staleBeanUser(400, 500);
    const res = await mockLoyaltyService.earn({
      userId: id,
      invoiceAmount: 10,
      paidFromBalance: false,
    });
    // The 500 stale points are gone; only the fresh grant survives.
    expect(u.points).toBe(res.pointsEarned);
    expect(res.pointsEarned).toBeGreaterThan(0);
  });

  it('expiry: the date the UI shows is 12 calendar months from the last activity', () => {
    const { id, u } = staleBeanUser(30, 500);
    return mockLoyaltyService.getBalance(id).then((bal) => {
      expect(bal.beansExpireAt).toBe(new Date(expiryAt(u.lastEarnAt)).toISOString());
    });
  });
});

describe('held behind §8', () => {
  // D5 inverts the expiry rule so the LARGEST balances stop being a permanent
  // liability. That takes points away from Gold and Black members, which is
  // precisely the change §8.3 says must ship with a notice period, an in-app
  // countdown and the liability numbers. The safe set keeps today's rule, and
  // 'a fresh balance is untouched, and Gold/Black stay exempt' above asserts
  // the exemption is still THERE — so this todo and that test are deliberately
  // contradictory, and whoever ships §8.3 must flip both together.
  it.todo(
    'T13 expiry: every tier expires on the same clock (D5, §8.3)'
    + ' — beansExpireAt loses its tierId argument, so for a Bean user AND a'
    + ' Black user beansExpireAt(u) === new Date(expiryAt(u.lastEarnAt)).toISOString();'
    + ' and expirePoints drops its `tier.id === gold || black` early return.',
  );
});
