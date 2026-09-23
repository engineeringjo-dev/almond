import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Branch, CartItem } from '@almond/shared/types';
import { menuItems } from '@almond/shared/menu';
import { config } from '@/lib/config';
import { createMockOrder, estimatePrepMinutes, DISPLAY_EARN_RULES, type PlaceOrderInput } from '@/data/order';
import { reloadBonus, tierProgress, genGiftCode, GIFT_OCCASIONS } from '@/data/loyalty';
import { getBranches, isBranchOpen } from '@/data/branches';
import { getFeaturedItems } from '@/data/featured';

/**
 * Guards the branching helpers under src/data/**: the order the site builds at
 * checkout (money + Amman timestamps), prep-time estimate, wallet reload bonus,
 * tier progress, branch open/closed and the featured row.
 *
 * All clocks are fixed (fake timers); the suite runs with TZ=UTC
 * (vitest.config.ts) so local-time helpers behave the same everywhere.
 */

const T0 = new Date('2026-09-23T09:00:00.000Z'); // 12:00 in Amman

const line = (over: Partial<CartItem> = {}): CartItem => ({
  lineId: 'l',
  itemId: 'i',
  nameAr: 'x',
  nameEn: 'x',
  emoji: '☕',
  sizeId: 'M',
  sizeNameAr: 'x',
  sizeNameEn: 'x',
  unitBasePrice: 2,
  customizations: [],
  qty: 1,
  ...over,
});

const branch: Branch = {
  id: 'rabyeh',
  nameAr: 'الرابية',
  nameEn: 'Rabyeh',
  areaAr: 'الرابية',
  areaEn: 'Rabyeh',
  lat: 31.97,
  lng: 35.87,
  hours: { open: '07:00', close: '24:00' },
};

describe('estimatePrepMinutes', () => {
  it('is the slowest line, floored at DEFAULT_PREP_MINUTES', () => {
    const floor = config.DEFAULT_PREP_MINUTES;
    expect(estimatePrepMinutes([])).toBe(floor);
    expect(estimatePrepMinutes([line({ prepMinutes: 1 })])).toBe(floor);
    expect(estimatePrepMinutes([line({ prepMinutes: floor + 5 }), line({ prepMinutes: 3 })])).toBe(floor + 5);
    expect(estimatePrepMinutes([line({ prepMinutes: undefined })])).toBe(floor);
  });
});

describe('createMockOrder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  const input = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
    items: [line({ prepMinutes: 12 })],
    totals: { subtotal: 5, tax: 0.4, discount: 1, total: 4.4 } as PlaceOrderInput['totals'],
    orderType: 'pickup',
    branch,
    paymentMethod: 'cash',
    paidFromBalance: false,
    promoCode: null,
    curbside: false,
    carInfo: '',
    ...over,
  });

  it('copies the money from the cart totals and adds the delivery fee to the total only', () => {
    const o = createMockOrder(input({ orderType: 'delivery', deliveryFee: 1.5, deliveryAddress: 'Amman' }));
    expect(o).toMatchObject({ subtotal: 5, tax: 0.4, discount: 1, total: 5.9, type: 'delivery' });
    expect(createMockOrder(input()).total).toBe(4.4);
  });

  it('stamps createdAt / targetReadyAt in Asia/Amman with an explicit +03:00 offset', () => {
    const o = createMockOrder(input());
    expect(o.createdAt).toBe('2026-09-23T12:00:00.000+03:00');
    expect(o.prepMinutes).toBe(12);
    expect(o.targetReadyAt).toBe('2026-09-23T12:12:00.000+03:00');
    expect(o.createdAt.endsWith('Z')).toBe(false);
  });

  it('normalises empty optional fields to undefined and copies branch names', () => {
    const o = createMockOrder(input({ promoCode: null, curbside: false, carInfo: '', deliveryAddress: '' }));
    expect(o.promoCode).toBeUndefined();
    expect(o.curbside).toBeUndefined();
    expect(o.carInfo).toBeUndefined();
    expect(o.deliveryAddress).toBeUndefined();
    expect(o).toMatchObject({ branchId: 'rabyeh', branchNameAr: 'الرابية', branchNameEn: 'Rabyeh', status: 'received' });
  });

  it('tolerates a null branch (empty ids, not a crash)', () => {
    expect(createMockOrder(input({ branch: null }))).toMatchObject({ branchId: '', branchNameEn: '' });
  });

  it('ids are unique per call even within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createMockOrder(input()).id));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^order_[a-z0-9]+$/);
  });
});

describe('DISPLAY_EARN_RULES', () => {
  it('keeps the Friday/weekday bonus OUT of the displayed beans (LOYALTY-EARN-PATCH §8.9)', () => {
    expect(DISPLAY_EARN_RULES.weekdayBonus).toEqual([]);
  });
});

describe('reloadBonus', () => {
  it('applies the highest qualifying tier from config.WALLET_RELOAD_BONUS', () => {
    const tiers = [...config.WALLET_RELOAD_BONUS].sort((a, b) => a.minJOD - b.minJOD);
    expect(reloadBonus(0)).toBe(0);
    expect(reloadBonus(tiers[0].minJOD - 0.001)).toBe(0);
    for (const t of tiers) expect(reloadBonus(t.minJOD)).toBe(t.bonusBeans);
    const top = tiers[tiers.length - 1];
    expect(reloadBonus(top.minJOD * 10)).toBe(Math.max(...tiers.map((t) => t.bonusBeans)));
  });
});

describe('tierProgress', () => {
  it('ratio is clamped to [0,1] and remaining is never negative', () => {
    for (const spend of [0, 1, 19.999, 20, 40, 64.99, 65, 1000]) {
      const p = tierProgress(spend);
      expect(p.ratio, `spend=${spend}`).toBeGreaterThanOrEqual(0);
      expect(p.ratio, `spend=${spend}`).toBeLessThanOrEqual(1);
      expect(p.remaining, `spend=${spend}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('at the top rung there is no next tier: ratio 1, remaining 0', () => {
    const p = tierProgress(10_000);
    expect(p.next).toBeNull();
    expect(p.ratio).toBe(1);
    expect(p.remaining).toBe(0);
  });

  it('remaining is exactly the JOD to the next threshold', () => {
    const p = tierProgress(5);
    expect(p.next).not.toBeNull();
    expect(p.remaining).toBeCloseTo(p.next!.threshold - 5, 9);
    expect(p.current.threshold).toBeLessThanOrEqual(5);
  });
});

describe('gift helpers', () => {
  it('genGiftCode has the ALMOND-XXXXX shape', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    expect(genGiftCode()).toMatch(/^ALMOND-[A-Z0-9]{5}$/);
  });

  it('occasion ids are unique and every occasion is bilingual', () => {
    expect(new Set(GIFT_OCCASIONS.map((o) => o.id)).size).toBe(GIFT_OCCASIONS.length);
    expect(GIFT_OCCASIONS.every((o) => o.ar.trim() && o.en.trim())).toBe(true);
  });
});

describe('isBranchOpen', () => {
  // An instant at h:m on the AMMAN wall clock. Jordan has been UTC+3 all year
  // since October 2022, so on 2026-09-23 that is (h-3):m UTC; Date.UTC
  // normalises a negative hour onto the previous day. These cases pin the
  // minute arithmetic; the Amman-vs-host case below pins the time zone.
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 23, h - 3, m));

  it('precondition: this suite runs with TZ=UTC (vitest.config.ts env)', () => {
    expect(new Date('2026-09-23T05:30:00.000Z').getHours()).toBe(5);
  });

  it('opens at the opening minute and closes at the closing minute (half-open interval)', () => {
    expect(isBranchOpen(branch, at(6, 59))).toBe(false);
    expect(isBranchOpen(branch, at(7, 0))).toBe(true);
    expect(isBranchOpen(branch, at(23, 59))).toBe(true);
    expect(isBranchOpen(branch, at(0, 0))).toBe(false);
  });

  it('honours mall hours (10:00–23:00)', () => {
    const mall: Branch = { ...branch, hours: { open: '10:00', close: '23:00' } };
    expect(isBranchOpen(mall, at(9, 59))).toBe(false);
    expect(isBranchOpen(mall, at(22, 59))).toBe(true);
    expect(isBranchOpen(mall, at(23, 0))).toBe(false);
  });

  it('every real branch has parseable HH:MM hours with open < close', () => {
    for (const b of getBranches()) {
      expect(b.hours.open, b.id).toMatch(/^\d{2}:\d{2}$/);
      expect(b.hours.close, b.id).toMatch(/^\d{2}:\d{2}$/);
      expect(b.hours.open < b.hours.close, b.id).toBe(true);
    }
  });

  // REGRESSION — fixed 2026-09-23 (was low/medium): src/data/branches.ts:15 reads `now.getHours()` — the
  // VIEWER's local clock — but branch hours are Amman wall-clock times. A
  // visitor (or a device) not on Asia/Amman sees the wrong open/closed badge:
  // at 08:30 Amman time a browser on UTC reads 05:30 and shows every branch as
  // CLOSED. The repo already has an Amman-aware formatter
  // (@almond/shared/lib/format toAmmanISO / AMMAN_TZ); use Intl with timeZone
  // 'Asia/Amman' here.
  it('evaluates opening hours in Asia/Amman regardless of the host time zone', () => {
    const ammanMorning = new Date('2026-09-23T05:30:00.000Z'); // 08:30 in Amman
    const ammanLateNight = new Date('2026-09-23T21:30:00.000Z'); // 00:30 next day in Amman
    expect(isBranchOpen(branch, ammanMorning)).toBe(true);
    expect(isBranchOpen(branch, ammanLateNight)).toBe(false);
  });
});

describe('getFeaturedItems', () => {
  it('returns at most `limit` in-stock items that all have a photo', () => {
    const out = getFeaturedItems(10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => i.imageUrl && i.inStock !== false)).toBe(true);
  });

  it('is deterministic (no hydration mismatch) and has no duplicates', () => {
    const a = getFeaturedItems(12).map((i) => i.id);
    const b = getFeaturedItems(12).map((i) => i.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('returns every candidate when the limit exceeds the pool', () => {
    const pool = menuItems.filter((i) => i.imageUrl && i.inStock !== false);
    expect(getFeaturedItems(pool.length + 5)).toHaveLength(pool.length);
  });
});
