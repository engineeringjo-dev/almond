import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@/constants/config';
import { menuItems, tiers } from '@/services/seed';
import { rewardCatalogue } from '@/services/rewardCatalogue';
import { tierProgressCopy } from '@/lib/tierCopy';
import { tierName, MEASURED_MEMBER_BASKET_JOD } from '@almond/shared/loyalty';
import { spendEntry } from '@almond/shared/loyalty/window';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';
import type { TierId } from '@/types';

/**
 * C6-C8 — the two pure modules behind the customer-facing copy.
 *
 * bff/test/copy.test.ts guards the locale FILES (key parity, placeholder
 * parity, no earn rate stated anywhere, no `tiers.*` namespace). These guard
 * what the code puts INTO them: which sentence a member is shown, and whether a
 * reward card names something its own value can buy.
 *
 * Both are outcome tests. C8 asserts the SENTENCE a member sees at a given
 * standing; C7 asserts a rung against a real price out of the shipped menu.
 */

const price = (id: string): number => {
  const item = menuItems.find((m) => m.id === id);
  if (!item) throw new Error(`menu item not found: ${id}`);
  return Math.min(...item.sizes.map((s) => s.price));
};

// ---------------------------------------------------------------------------
// C6 — the tier's name IS its rate.
// ---------------------------------------------------------------------------
describe('C6 tierName', () => {
  it('returns the rate itself, in both languages', () => {
    expect(tiers.map((t) => tierName(t, 'en'))).toEqual(['2%', '4%', '6%']);
    expect(tiers.map((t) => tierName(t, 'ar'))).toEqual(tiers.map((t) => t.nameAr));
  });

  it('the name and the multiplier cannot drift apart', () => {
    // 1 point = 1 qirsh exactly (10,621 live redemptions), so the rung's name is
    // POINTS_PER_JOD × multiplier as a percentage. If a rename ever decoupled
    // the two, a member would be told a rate they are not paid — which is the
    // whole defect this package removes.
    // earn-arith-exempt: asserting the NAME against the ramp — no invoice, no grant. §7 T7.
    const paid = tiers.map((t) => `${config.POINTS_PER_JOD * t.multiplier}%`);
    expect(tiers.map((t) => tierName(t, 'en'))).toEqual(paid);
  });
});

// ---------------------------------------------------------------------------
// C7 — every rung on the rewards board buys the thing it names.
// ---------------------------------------------------------------------------
describe('C7 the redemption catalogue', () => {
  it('starts at config.FIRST_REWARD_POINTS and rises', () => {
    expect(rewardCatalogue[0].points).toBe(config.FIRST_REWARD_POINTS);
    const pts = rewardCatalogue.map((r) => r.points);
    expect(pts).toEqual([...pts].sort((a, b) => a - b));
    expect(new Set(pts).size).toBe(pts.length);
  });

  it('no card names something its own value cannot buy', () => {
    // The old board had a 60-point ("0.600 JOD") "Flat discount on ANY item"
    // against a menu whose cheapest item is 0.750, a 200-point "Handcrafted
    // drink" against a 3.950 frappe and a 300-point "Brunch plate" against a
    // 3.900 sandwich. Each rung now carries the id of a real item it must cover.
    const offenders: string[] = [];
    for (const r of rewardCatalogue) {
      if (!r.benchmarkItemId) continue;
      const jod = r.points / config.POINTS_PER_JOD_REDEEM;
      const cost = price(r.benchmarkItemId);
      if (jod < cost) offenders.push(`${r.labelKey} ${r.points}pts = ${jod} JOD < ${cost} (${r.benchmarkItemId})`);
    }
    expect(offenders, `Offending rungs: ${offenders.join(' | ')}`).toEqual([]);
  });

  it('the first rung covers the customization it is named after', () => {
    // 237 priced items, 827 priced customization options: the modal option delta
    // is 0.400 JOD (352 of 827) and NOTHING on the menu costs 0.600 or less, so
    // the old 25-point rung (0.250) covered 4.7% of options and no item at all.
    // 138 points = 1.380 JOD covers 715 of 827 = 86.5%.
    const opts = menuItems
      .flatMap((i) => i.customizations.flatMap((g) => g.options))
      .filter((o) => o.priceDelta > 0);
    const jod = rewardCatalogue[0].points / config.POINTS_PER_JOD_REDEEM;
    const covered = opts.filter((o) => o.priceDelta <= jod).length;
    expect(opts.length).toBeGreaterThan(500);
    expect(covered / opts.length).toBeGreaterThan(0.8);
  });

  it('every card names a key the locale files actually carry', () => {
    // A labelKey with no entry renders as "rewardItems.brunchPlate" on the card.
    const read = (lang: 'ar' | 'en') =>
      JSON.parse(
        readFileSync(join(__dirname, '..', 'locales', `${lang}.json`), 'utf8'),
      ) as Record<string, Record<string, string>>;
    const en = read('en');
    const ar = read('ar');
    for (const r of rewardCatalogue) {
      const [ns, key] = r.labelKey.split('.');
      expect(en[ns]?.[key], `en ${r.labelKey}`).toBeTruthy();
      expect(ar[ns]?.[key], `ar ${r.labelKey}`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// C8 — which sentence a member is shown.
// ---------------------------------------------------------------------------
describe('C8 tierProgressCopy', () => {
  it('C8a a member with nothing is 4 visits from the doubling, and says ×2', () => {
    const c = tierProgressCopy({ windowSpend: 0 }, 'en');
    expect(c).not.toBeNull();
    expect(c!.key).toBe('loyalty.toPlus');
    expect(c!.params.visits).toBe(4);
    // 4 is the DOOR (config.TIER2_VISITS_ALTERNATIVE), not the 5.85 JOD spend
    // projection — the count in a declarative sentence has to be one the ladder
    // honours at any basket size. The two happen to agree at zero spend
    // (ceil(20 / 5.85) = 4) and nowhere else, which is exactly why the
    // projection was the wrong one to say out loud; pinned here because a ramp
    // move that separated them further would make the coincidence misleading.
    expect(Math.ceil(tiers[1].threshold / MEASURED_MEMBER_BASKET_JOD))
      .toBe(config.TIER2_VISITS_ALTERNATIVE);
  });

  it('C8b "one more visit" is said only when one more visit really does it', () => {
    // Two generations of this defect. TierProgress.tsx and LoyaltyCard.tsx
    // first gated it on `remaining <= 30` against a 20 JOD threshold, so it was
    // unconditionally true and every member was told "One step away" from zero
    // spend. Then it was gated on a spend PROJECTION: 15 JOD said
    // ceil(5 / 5.85) = 1 and rendered "Just one more visit! 🔥 Your rate
    // becomes 4%" — a member who came back for a 2.500 JOD americano finished
    // on 17.50 JOD across 2 visit days and was still paid 2%.
    const at15 = tierProgressCopy({ windowSpend: 15 }, 'en')!;
    expect(at15.key).not.toBe('loyalty.oneVisitLeft');
    // Knowing only the spend, the honest count is the door minus the day that
    // 15 JOD must already have been spent on: 3, not 1.
    expect(at15.params.visits).toBe(config.TIER2_VISITS_ALTERNATIVE - 1);
    expect(tierProgressCopy({ windowSpend: 0 }, 'en')!.key).not.toBe('loyalty.oneVisitLeft');

    // It fires on the GUARANTEE: three visit days banked, and the fourth opens
    // the 4% rung at any basket size.
    const guaranteed = tierProgressCopy(
      {
        windowSpend: 2.25,
        tier: 'base' as TierId,
        nextTier: {
          id: 'plus' as TierId, jodRemaining: 17.75, visitsRemaining: 1,
          visitsGuaranteed: true, step: 2,
        },
      },
      'en',
    )!;
    expect(guaranteed.key).toBe('loyalty.oneVisitLeft');

    // ... and never on a projection. 60 JOD projects one visit to the 6% rung,
    // where there is no visits door at all: one 2.500 JOD americano leaves the
    // member on 62.50 of the 65 they need.
    const projected = tierProgressCopy(
      {
        windowSpend: 60,
        tier: 'plus' as TierId,
        nextTier: {
          id: 'top' as TierId, jodRemaining: 5, visitsRemaining: 1,
          visitsGuaranteed: false, step: 1.5,
        },
      },
      'en',
    )!;
    expect(projected.key).toBe('loyalty.nearlyNext');
  });

  it('C8c the second step is 8 visits and never says a multiplier', () => {
    const c = tierProgressCopy({ windowSpend: 20 }, 'en')!;
    expect(c.key).toBe('loyalty.toTop');
    expect(c.params.visits).toBe(Math.ceil((tiers[2].threshold - 20) / MEASURED_MEMBER_BASKET_JOD));
    expect(c.params.visits).toBe(8);
    // ×1.5 is deliberately never spoken — repeating a multiplier spends it.
    expect(c.params.tier).toBe('6%');
    expect(JSON.stringify(c.params)).not.toContain('×');
  });

  it('C8d the top of the ladder has no progress sentence at all', () => {
    expect(tierProgressCopy({ windowSpend: 65 }, 'en')).toBeNull();
    // ... and a RATCHETED member — held at the top with a window that rolled
    // back to zero — must not be told to climb to a rung they already hold.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'top' as TierId }, 'en')).toBeNull();
    expect(tierProgressCopy({ windowSpend: 0, nextTier: null }, 'en')).toBeNull();
    // ... and the same holds one rung DOWN, which the top-rung-only guard used
    // to miss: a member holding `plus` by floor whose window rolled to 0 was
    // told "4 more visits and your cashback DOUBLES ×2" toward the 4% rung they
    // are already paid at, directly beside a badge reading 4%.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'plus' as TierId }, 'en')).toBeNull();
    // A member genuinely below it still gets the sentence.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'base' as TierId }, 'en')!.key)
      .toBe('loyalty.toPlus');
  });

  it('C8e a real standing beats the spend projection', () => {
    // The case that makes this matter: 4 visit-days and 12 JOD. The member is
    // ALREADY on the 4% rung through the visits door, and standing() knows it;
    // progressToNextTier(12) does not, and points them back at 4%.
    const withStanding = tierProgressCopy(
      { windowSpend: 12, tier: 'plus' as TierId, nextTier: { id: 'top' as TierId, jodRemaining: 53, visitsRemaining: 10, step: 1.5 } },
      'en',
    )!;
    expect(withStanding.key).toBe('loyalty.toTop');
    expect(withStanding.params.visits).toBe(10);

    const projectionOnly = tierProgressCopy({ windowSpend: 12 }, 'en')!;
    expect(projectionOnly.key).toBe('loyalty.toPlus');
  });

  it('C8f the sentence names the rung in the reader\'s language', () => {
    expect(tierProgressCopy({ windowSpend: 20 }, 'ar')!.params.tier).toBe(tiers[2].nameAr);
    expect(tierProgressCopy({ windowSpend: 20 }, 'en')!.params.tier).toBe('6%');
  });
});

// ---------------------------------------------------------------------------
// C8g — the whole chain, through the mock the app actually runs.
// ---------------------------------------------------------------------------
describe('C8g the sentence a real member is shown', () => {
  const DAY = 86_400_000;
  let seq = 0;

  it('a member through the 4-visits door is not told to climb to the rung they hold', async () => {
    // 4 distinct days × 3 JOD = 12 JOD. That is 40% of the 20 JOD door, but
    // TIER2_VISITS_ALTERNATIVE opens the 4% rung anyway, so this member IS on
    // 4%. A spend-only projection (progressToNextTier(12)) still says "N more
    // visits and your cashback DOUBLES" — to a member who already doubled.
    const id = `copy-visits-${++seq}`;
    const u = __getMockUser(id);
    u.spendLog = [1, 4, 9, 20].map((d) => spendEntry(3, new Date(Date.now() - d * DAY)));
    u.heldTierId = 'base';

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.tier).toBe('plus');
    expect(bal.visitDays).toBe(4);

    const copy = tierProgressCopy(bal, 'ar')!;
    expect(copy.key).toBe('loyalty.toTop');
    expect(copy.params.tier).toBe(tiers[2].nameAr);
    // The projection alone would have said the opposite.
    expect(tierProgressCopy({ windowSpend: bal.windowSpend }, 'ar')!.key).toBe('loyalty.toPlus');
  });

  it('a ratcheted top-rung member with an empty window is shown no progress at all', async () => {
    const id = `copy-ratchet-${++seq}`;
    const u = __getMockUser(id);
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 70, paidFromBalance: false });
    u.spendLog = u.spendLog.map((e) => spendEntry(e.jod, new Date(Date.now() - 200 * DAY)));

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.windowSpend).toBe(0);
    expect(bal.tier).toBe('top');
    // There is no demotion, so this member is PAID 6%. Telling them they are 4
    // visits from 4% — which windowSpend 0 projects — would be a lie in the
    // opposite direction from the one W4 removed.
    expect(tierProgressCopy(bal, 'en')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C8h — the DEFAULT member sees the sentence at all.
// ---------------------------------------------------------------------------
describe('C8h the demo seed renders the progress sentence', () => {
  it('a brand-new user of the shipped mock is shown a real, guaranteed sentence', async () => {
    // THE WIRING TEST, not another copy test. Everything above builds its own
    // balance, so none of it can see the state the app actually starts in.
    //
    // The mock's demo seed used to put every unseen userId on 72 JOD across
    // three in-window days with a 'top' floor — the LAST rung, where
    // `standing().next` is null, tierProgressCopy returns null, and all three
    // render sites drop the line. config.DATA_SOURCE is 'mock', the mock's
    // `store` is a fresh Map on every launch and earn() only ever ADDS spend,
    // so that was every user on every launch: the centrepiece of W4 rendered
    // for nobody while 222 unit tests stayed green.
    const bal = await mockLoyaltyService.getBalance(`copy-demo-seed-${Date.now()}`);

    expect(bal.tier).not.toBe(tiers[tiers.length - 1].id);
    expect(bal.nextTier, 'the seeded member must have a rung above them').not.toBeNull();

    const copy = tierProgressCopy(bal, 'en');
    expect(copy, 'the demo member must be shown a progress sentence').not.toBeNull();
    // ... and it must be a DEFINITE one, which is only allowed on a guaranteed
    // count: the seed sits below the visits door, so the number it states is
    // the door and the ladder honours it at any basket size.
    expect(bal.nextTier!.visitsGuaranteed).toBe(true);
    expect(copy!.key).toBe('loyalty.toPlus');
    expect(copy!.params.visits).toBeGreaterThan(0);
  });
});
