import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import {
  NO_PROMOTION_RECORD,
  dismissPromotion,
  observeRung,
  parsePromotion,
  promotionCopy,
  serialisePromotion,
  type PromotionRecord,
} from '@/lib/promotion';
import { usePromotionStore } from '@/stores/promotionStore';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';
import { spendEntry } from '@almond/shared/loyalty/window';
import { tiers } from '@/services/seed';
import type { TierId } from '@/types';

/**
 * S2 — THE PROMOTION CELEBRATION.
 *
 * «🎉 مبروك! خصمك تضاعف — صرت على ٤٪ · وباقي لك ٧ زيارات للـ٦٪»
 *
 * Outcome tests, in the style of C8: each one asserts what a member IS or IS
 * NOT shown, not which branch ran. The four properties the package has to hold
 * are named in the describes — fires once, survives a restart, never fires for
 * a brand-new member, and never fires on a re-qualification.
 *
 * P7 runs against the REAL AsyncStorage web build (its `window.localStorage`
 * backing store is shimmed below), so "survives an app restart" is a genuine
 * write-drop-read, not an assertion about a mock.
 */

// ---------------------------------------------------------------------------
// A localStorage backing store, so the real AsyncStorage module works in node.
// ---------------------------------------------------------------------------
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}
const disk = new MemoryStorage();
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: disk };
});

const BASE = tiers[0].id as TierId;
const PLUS = tiers[1].id as TierId;
const TOP = tiers[tiers.length - 1].id as TierId;

/** A record for a member already recorded on `rung`, with nothing owed. */
const seen = (rung: string): PromotionRecord => ({ seenRungId: rung, pending: null });

// ---------------------------------------------------------------------------
// P1 — a brand-new member is BASELINED, never congratulated.
// ---------------------------------------------------------------------------
describe('P1 the first sight of a member is a baseline, not a promotion', () => {
  it('starting on the entry rung is not a promotion', () => {
    // Every member has always been on 2%. Congratulating someone for arriving
    // where they started is the failure mode a naive "tier != last tier" check
    // produces on its very first run, for every member at once.
    const r = observeRung(NO_PROMOTION_RECORD, BASE);
    expect(r.pending).toBeNull();
    expect(r.seenRungId).toBe(BASE);
  });

  it('installing the app already on 4% is not a promotion either', () => {
    // The same rule, in the case that would otherwise fire a false «مبروك» at
    // every member who has ever been promoted, the moment they update.
    expect(observeRung(NO_PROMOTION_RECORD, PLUS)).toEqual({ seenRungId: PLUS, pending: null });
    expect(observeRung(NO_PROMOTION_RECORD, TOP)).toEqual({ seenRungId: TOP, pending: null });
  });

  it('"nothing recorded" and "recorded on the entry rung" are different states', () => {
    // If `seenRungId: ''` were stored as 'base', the baseline above would be
    // indistinguishable from a real 2%-holder and the first observation of a
    // 4% member would celebrate. This is the whole distinction.
    expect(NO_PROMOTION_RECORD.seenRungId).not.toBe(BASE);
    expect(observeRung(seen(BASE), PLUS).pending).not.toBeNull();
    expect(observeRung(NO_PROMOTION_RECORD, PLUS).pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P2 — it fires exactly once.
// ---------------------------------------------------------------------------
describe('P2 the celebration fires once and cannot fire again', () => {
  it('a rise in the rung PAID is owed once', () => {
    const promoted = observeRung(seen(BASE), PLUS);
    expect(promoted.pending).toEqual({ fromId: BASE, toId: PLUS });

    // Observed again on the next render, the next launch, the next week: the
    // record is unchanged — the same object, so the store writes nothing.
    expect(observeRung(promoted, PLUS)).toBe(promoted);

    const done = dismissPromotion(promoted);
    expect(done.pending).toBeNull();
    expect(observeRung(done, PLUS)).toBe(done);
  });

  it('dismissing keeps the mark, so the same promotion cannot come back', () => {
    const done = dismissPromotion(observeRung(seen(BASE), PLUS));
    expect(done.seenRungId).toBe(PLUS);
    expect(observeRung(done, PLUS).pending).toBeNull();
  });

  it('a rung the ramp does not carry changes nothing', () => {
    // A retired id off an old wire body. rungById() elsewhere falls back to the
    // entry rung so the member is still PAID; here silence is the safe answer.
    const before = seen(PLUS);
    expect(observeRung(before, 'silver')).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// P3 — a re-qualification is not a promotion.
// ---------------------------------------------------------------------------
describe('P3 only a rise in the rung PAID is a promotion', () => {
  it('re-qualifying a rung already held says nothing', () => {
    // There is no demotion, so `held = max(floor, live window)` re-qualifies
    // every quarter for the rest of a promoted member's life. Celebrating that
    // would fire «مبروك! خصمك تضاعف» four times a year, forever.
    const held = seen(PLUS);
    expect(observeRung(held, PLUS)).toBe(held);
  });

  it('a rung that reads LOWER neither celebrates nor lowers the mark', () => {
    // Reachable for a member whose floor was never materialised by a write and
    // whose 90-day window then rolled off. If the mark came down with it, the
    // next qualifying visit would replay a promotion the member already had.
    const dropped = observeRung(seen(PLUS), BASE);
    expect(dropped.seenRungId).toBe(PLUS);
    expect(dropped.pending).toBeNull();
    expect(observeRung(dropped, PLUS).pending).toBeNull();
  });

  it('the second step is still a promotion, and its own', () => {
    const top = observeRung(seen(PLUS), TOP);
    expect(top.pending).toEqual({ fromId: PLUS, toId: TOP });
  });
});

// ---------------------------------------------------------------------------
// P4 — the sentence, at the doubling.
// ---------------------------------------------------------------------------
describe('P4 the copy at the promotion to 4%', () => {
  const next = { id: TOP, jodRemaining: 45, visitsRemaining: 8, visitsGuaranteed: false, step: 1.5 };

  it('names the rate reached and the rung above it, in both languages', () => {
    const en = promotionCopy({ fromId: BASE, toId: PLUS }, next, 'en')!;
    expect(en.key).toBe('loyalty.promotedDoubled');
    expect(en.params.tier).toBe('4%');
    expect(en.next).not.toBeNull();
    expect(en.next!.key).toBe('loyalty.promotedNext');
    expect(en.next!.params).toEqual({ visits: 8, tier: '6%' });

    const ar = promotionCopy({ fromId: BASE, toId: PLUS }, next, 'ar')!;
    expect(ar.params.tier).toBe(tiers[1].nameAr);
    expect(ar.next!.params.tier).toBe(tiers[2].nameAr);
  });

  it('the count is the standing\'s, never a second projection', () => {
    // FINAL.md §2.1: the number said out loud must be the one the ladder will
    // honour, and there must be exactly one place that decides it.
    const c = promotionCopy({ fromId: BASE, toId: PLUS }, { ...next, visitsRemaining: 3 }, 'en')!;
    expect(c.next!.params.visits).toBe(3);
  });

  it('no multiplier is spoken — the doubling is said in words', () => {
    // «المضاعف ×2 يُذكر مرة واحدة فقط»: loyalty.toPlus is the one key carrying
    // the literal ×2 (C9 in bff/test/copy.test.ts pins that), and ×1.5 is never
    // said at all. This sentence must not add a second copy of either.
    const c = promotionCopy({ fromId: BASE, toId: PLUS }, next, 'en')!;
    expect(JSON.stringify(c)).not.toContain('×');
    expect(c.key).not.toBe('loyalty.toPlus');
  });

  it('drops the second clause when there is no rung above', () => {
    expect(promotionCopy({ fromId: BASE, toId: PLUS }, null, 'en')!.next).toBeNull();
    expect(promotionCopy({ fromId: BASE, toId: PLUS }, undefined, 'en')!.next).toBeNull();
  });

  it('nothing owed is nothing shown', () => {
    expect(promotionCopy(null, next, 'en')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P5 — the sentence at the TOP, where the approved copy has no second clause.
// ---------------------------------------------------------------------------
describe('P5 the copy at the top of the ladder', () => {
  it('congratulates without pointing anywhere', () => {
    const c = promotionCopy({ fromId: PLUS, toId: TOP }, null, 'en')!;
    expect(c.key).toBe('loyalty.promotedTop');
    expect(c.params.tier).toBe('6%');
    expect(c.next).toBeNull();
  });

  it('a jump straight from 2% to 6% is not called a doubling', () => {
    // One 70 JOD invoice. The rate tripled; «خصمك تضاعف» would be false, and
    // this is the only rise in the shipped ramp where it would be.
    const c = promotionCopy({ fromId: BASE, toId: TOP }, null, 'en')!;
    expect(c.key).toBe('loyalty.promotedTop');
  });

  it('the doubling claim is gated on the arithmetic, not on the rung name', () => {
    // A future middle rung whose step is not ×2 gets no celebration rather than
    // a false one: it has to bring its own key deliberately.
    expect(tiers[1].multiplier).toBe(tiers[0].multiplier * 2);
    expect(promotionCopy({ fromId: PLUS, toId: PLUS }, null, 'en')).toBeNull();
  });

  it('even at the top, no second clause is invented from a stale nextTier', () => {
    const c = promotionCopy(
      { fromId: PLUS, toId: TOP },
      { id: TOP, jodRemaining: 0, visitsRemaining: 4, visitsGuaranteed: false, step: 1 },
      'en',
    )!;
    expect(c.next).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P6 — the persisted blob.
// ---------------------------------------------------------------------------
describe('P6 what goes on disk, and what comes back', () => {
  it('round-trips', () => {
    const r = observeRung(seen(BASE), PLUS);
    expect(parsePromotion(serialisePromotion('m_1', r), 'm_1')).toEqual(r);
  });

  it('a blob written for another member is not read at all', () => {
    // Two accounts on one handset. Inheriting the first member's owed
    // celebration would congratulate the second on a promotion that is not
    // theirs; re-baselining is silent, which is the safe direction.
    const r = observeRung(seen(BASE), PLUS);
    expect(parsePromotion(serialisePromotion('m_1', r), 'm_2')).toEqual(NO_PROMOTION_RECORD);
  });

  it('nothing unreadable can manufacture a promotion', () => {
    for (const raw of ['', 'not json', '{}', '[]', 'null', '{"userId":"m_1"}']) {
      expect(parsePromotion(raw, 'm_1')).toEqual(NO_PROMOTION_RECORD);
    }
    // ... including a pending that does not describe a RISE.
    const backwards = JSON.stringify({ userId: 'm_1', seenRungId: PLUS, pending: { fromId: TOP, toId: BASE } });
    expect(parsePromotion(backwards, 'm_1').pending).toBeNull();
    // ... or one naming a rung the ramp does not carry.
    const retired = JSON.stringify({ userId: 'm_1', seenRungId: 'gold', pending: null });
    expect(parsePromotion(retired, 'm_1')).toEqual(NO_PROMOTION_RECORD);
  });
});

// ---------------------------------------------------------------------------
// P7 — the store: the disk, the member, and the hydration gate.
// ---------------------------------------------------------------------------
describe('P7 the store survives a restart and decides nothing before it', () => {
  const reset = () => {
    disk.clear();
    usePromotionStore.setState({ userId: '', record: NO_PROMOTION_RECORD, hydrated: false });
  };
  /** A cold start with the disk left exactly as it was. */
  const restart = async () => {
    usePromotionStore.setState({ userId: '', record: NO_PROMOTION_RECORD, hydrated: false });
    await usePromotionStore.getState().hydrate();
  };

  beforeEach(reset);

  it('a promotion detected on Tuesday is still owed on Friday', async () => {
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('m_1', BASE);
    expect(usePromotionStore.getState().record.pending).toBeNull();

    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record.pending).toEqual({ fromId: BASE, toId: PLUS });

    // The member closes the app without opening it. Cold start, days later.
    await restart();
    expect(usePromotionStore.getState().record.pending).toEqual({ fromId: BASE, toId: PLUS });

    // ... and the balance arriving again does not re-fire or duplicate it.
    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record.pending).toEqual({ fromId: BASE, toId: PLUS });
  });

  it('once dismissed it stays dismissed across restarts', async () => {
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('m_1', BASE);
    usePromotionStore.getState().observe('m_1', PLUS);
    usePromotionStore.getState().dismiss();

    await restart();
    expect(usePromotionStore.getState().record.pending).toBeNull();
    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record.pending).toBeNull();
    // The mark survived, which is what makes that true.
    expect(usePromotionStore.getState().record.seenRungId).toBe(PLUS);
  });

  it('🔴 nothing is recorded before the disk has been read', async () => {
    // THE RACE THIS PACKAGE WOULD OTHERWISE LOSE. On a cold start the balance
    // query can resolve before AsyncStorage does. An observation folded into
    // the empty in-memory record would BASELINE over the real one — and a
    // baseline never celebrates — so the promotion would be swallowed on the
    // exact launch that should have shown it.
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('m_1', BASE);

    // Simulate the launch: state cleared, hydrate() not yet resolved.
    usePromotionStore.setState({ userId: '', record: NO_PROMOTION_RECORD, hydrated: false });
    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record).toEqual(NO_PROMOTION_RECORD);

    // The disk read lands, and the promotion is found where it always was.
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record.pending).toEqual({ fromId: BASE, toId: PLUS });
  });

  it('a second member on the same handset is baselined, not handed the first', async () => {
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('m_1', BASE);
    usePromotionStore.getState().observe('m_1', PLUS);
    expect(usePromotionStore.getState().record.pending).not.toBeNull();

    usePromotionStore.getState().observe('m_2', PLUS);
    expect(usePromotionStore.getState().record.pending).toBeNull();
    await restart();
    expect(usePromotionStore.getState().record.pending).toBeNull();
  });

  it('an anonymous id records nothing', async () => {
    await usePromotionStore.getState().hydrate();
    usePromotionStore.getState().observe('', PLUS);
    expect(usePromotionStore.getState().record).toEqual(NO_PROMOTION_RECORD);
  });
});

// ---------------------------------------------------------------------------
// P8 — the whole chain, through the mock the app actually runs.
// ---------------------------------------------------------------------------
describe('P8 the celebration a real member is shown', () => {
  const DAY = 86_400_000;
  let seq = 0;

  it('crossing the 4-visits door doubles the rate and says so', async () => {
    // Three qualifying days at 3 JOD: 9 JOD, below the 20 JOD door and one day
    // short of the visits door. This member is on 2%.
    const id = `promo-door-${++seq}`;
    const u = __getMockUser(id);
    u.spendLog = [1, 4, 9].map((d) => spendEntry(3, new Date(Date.now() - d * DAY)));
    u.heldTierId = 'base';

    const before = await mockLoyaltyService.getBalance(id);
    expect(before.tier).toBe(BASE);
    const baseline = observeRung(NO_PROMOTION_RECORD, before.tier);
    expect(baseline.pending).toBeNull();

    // The fourth visit day. Any basket size opens the rung — that is what makes
    // the door a door.
    u.spendLog.push(spendEntry(2.5, new Date()));
    const after = await mockLoyaltyService.getBalance(id);
    expect(after.tier).toBe(PLUS);
    expect(after.visitDays).toBe(4);

    const promoted = observeRung(baseline, after.tier);
    expect(promoted.pending).toEqual({ fromId: BASE, toId: PLUS });

    const copy = promotionCopy(promoted.pending, after.nextTier, 'ar')!;
    expect(copy.key).toBe('loyalty.promotedDoubled');
    expect(copy.params.tier).toBe(tiers[1].nameAr);
    // The second clause carries the standing's own count, and that count is a
    // PROJECTION: the 6% rung has no visits door, so the sentence hedges it.
    expect(after.nextTier!.visitsGuaranteed).toBe(false);
    expect(copy.next!.params.visits).toBe(after.nextTier!.visitsRemaining);
    expect(copy.next!.params.tier).toBe(tiers[2].nameAr);
  });

  it('a member who stays put is never congratulated again', async () => {
    const id = `promo-stay-${++seq}`;
    const u = __getMockUser(id);
    u.spendLog = [1, 4, 9, 20].map((d) => spendEntry(3, new Date(Date.now() - d * DAY)));
    u.heldTierId = 'plus';

    let record = NO_PROMOTION_RECORD;
    for (let i = 0; i < 5; i++) {
      const bal = await mockLoyaltyService.getBalance(id);
      record = observeRung(record, bal.tier);
    }
    expect(record).toEqual({ seenRungId: PLUS, pending: null });
  });

  it('the 6% promotion says nothing about a rung above it', async () => {
    const id = `promo-top-${++seq}`;
    const u = __getMockUser(id);
    u.spendLog = [spendEntry(70, new Date(Date.now() - DAY))];
    u.heldTierId = 'plus';

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.tier).toBe(TOP);
    expect(bal.nextTier).toBeNull();

    const promoted = observeRung(seen(PLUS), bal.tier);
    const copy = promotionCopy(promoted.pending, bal.nextTier, 'en')!;
    expect(copy.key).toBe('loyalty.promotedTop');
    expect(copy.next).toBeNull();
  });
});
