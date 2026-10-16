import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_GAP, CAMPAIGN_PEEK, campaignGeometry, campaignOffset, campaignPages, createCampaignVisitPicker, settledCampaign, wrapCampaign } from '@/lib/campaignPager';
import { createScrollSettlement } from '@/lib/scrollSettlement';

describe('Genuine bilateral campaign peeks and circular manual paging', () => {
  it('leaves exactly 20px of adjacent cards after an 8px gap at narrow and wide sizes, including both logical ends', () => {
    for (const width of [288, 358, 380, 648]) {
      const { card, inset, step } = campaignGeometry(width);
      expect(CAMPAIGN_GAP).toBe(8);
      expect(CAMPAIGN_PEEK).toBe(20);
      expect(inset - CAMPAIGN_GAP).toBe(20);
      expect(width - (inset + card + CAMPAIGN_GAP)).toBe(20);
      for (const rtl of [false, true]) {
        const pages = campaignPages(7, rtl);
        expect(pages).toHaveLength(9);
        expect(pages.filter((page) => page.clone).map((page) => page.slot)).toEqual([0, 8]);
        for (let index = 0; index < 7; index++) {
          const offset = campaignOffset(index, step, 7, rtl);
          const slot = Math.round(offset / step);
          expect(pages[slot]).toEqual({ slot, logical: index, clone: false });
          expect(pages[slot - 1]).toBeDefined();
          expect(pages[slot + 1]).toBeDefined();
          expect(settledCampaign(offset, step, 7, rtl)).toEqual({ logical: index, offset, clone: false });
        }
      }
    }
  });

  it('advances with Arabic finger-right or English finger-left and rebases either end copy to its identical original', () => {
    for (const width of [288, 358, 380, 648]) for (const rtl of [true, false]) {
      const { step } = campaignGeometry(width);
      for (let index = 0; index < 7; index++) {
        const start = campaignOffset(index, step, 7, rtl);
        for (const delta of [-1, 1]) {
          const result = settledCampaign(start + (rtl ? -delta : delta) * step, step, 7, rtl);
          expect(result.logical).toBe(wrapCampaign(index + delta, 7));
          expect(result.offset).toBe(campaignOffset(result.logical, step, 7, rtl));
          expect(result.clone).toBe(index + delta < 0 || index + delta > 6);
        }
      }
    }
    expect(campaignPages(0, false)).toEqual([]);
  });

  it('rapid Next across the wrap keeps the latest intent despite a late end-copy observation', () => {
    vi.useFakeTimers();
    try {
      for (const rtl of [false, true]) {
        const { step } = campaignGeometry(288);
        const committed: number[] = [];
        const settlement = createScrollSettlement((offset) => committed.push(settledCampaign(offset, step, 7, rtl).logical));
        let index = 5;
        for (let tap = 0; tap < 3; tap++) {
          index = wrapCampaign(index + 1, 7);
          settlement.request(campaignOffset(index, step, 7, rtl));
          settlement.update((rtl ? 0 : 8) * step);
          vi.advanceTimersByTime(40);
        }
        vi.advanceTimersByTime(140);
        expect(committed).toEqual([1]);
      }
    } finally { vi.useRealTimers(); }
  });
});

describe('A random opening selection belongs to one focused Home visit', () => {
  it('all seven cards are eligible, without changing their fixed order', () => {
    for (let index = 0; index < 7; index++) {
      const pick = createCampaignVisitPicker(() => (index + 0.5) / 7);
      expect(pick(true, 7)).toBe(index);
    }
    for (const sample of [0, 1, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pick = createCampaignVisitPicker(() => sample);
      expect(pick(true, 7)).toBeGreaterThanOrEqual(0);
      expect(createCampaignVisitPicker(() => sample)(true, 7)).toBeLessThan(7);
    }
  });

  it('samples once on entry, stays stable through effect replay/resize/theme/menu renders, and samples on a real tab return', () => {
    const random = vi.fn().mockReturnValueOnce(0.35).mockReturnValueOnce(0.95);
    const pick = createCampaignVisitPicker(random);
    expect(pick(false, 7)).toBeUndefined();
    expect(random).not.toHaveBeenCalled();
    expect(pick(true, 7)).toBe(2);
    for (const count of [7, 7, 6, 7]) expect(pick(true, count)).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(1);
    expect(pick(false, 7)).toBeUndefined();
    expect(pick(true, 7)).toBe(6);
    expect(pick(true, 7)).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('waits for a nonempty eligible set rather than consuming a visit selection prematurely', () => {
    const random = vi.fn(() => 0.99);
    const pick = createCampaignVisitPicker(random);
    expect(pick(true, 0)).toBeUndefined();
    expect(pick(true, 5)).toBe(4);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it('reads the current RNG on the next visit, without sampling while the picker is constructed', () => {
    const pick = createCampaignVisitPicker();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      expect(random).not.toHaveBeenCalled();
      expect(pick(true, 7)).toBe(0);
      random.mockReturnValue(0.999999);
      expect(pick(true, 7)).toBeUndefined();
      pick(false, 7);
      expect(pick(true, 7)).toBe(6);
      expect(random).toHaveBeenCalledTimes(2);
    } finally { random.mockRestore(); }
  });
});
