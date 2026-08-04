import { describe, it, expect, beforeEach } from 'vitest';
import { calendarFeatures, daypartOf } from '@almond/shared/lib/calendar';
import { computePar, criticalRatio, seasonalNaive, suggestedOrder, inverseNormalCdf } from '../src/forecasting/par';
import { recordOrderLines, historyFor, clearOrderLines, recordStockout, listOrderLines } from '../src/analytics/orderLines';
import type { CartItem } from '@almond/shared/types';

const line = (itemId: string, qty: number): CartItem => ({
  lineId: `${itemId}__M__`, itemId, nameAr: 'x', nameEn: 'x', emoji: '',
  sizeId: 'M', sizeNameAr: 'M', sizeNameEn: 'M', unitBasePrice: 2.5,
  customizations: [], qty,
});

describe('Jordan/Hijri calendar features', () => {
  it('flags Ramadan 2026 with its day number', () => {
    const c = calendarFeatures(new Date('2026-02-20T12:00:00Z'));
    expect(c.isRamadan).toBe(true);
    expect(c.ramadanDay).toBeGreaterThan(0);
  });
  it('flags Eid al-Fitr 2026', () => {
    expect(calendarFeatures(new Date('2026-03-20T12:00:00Z')).isEid).toBe(true);
  });
  it('treats Friday and Saturday as the weekend', () => {
    expect(calendarFeatures(new Date('2026-07-03T12:00:00Z')).isWeekend).toBe(true); // Fri
    expect(calendarFeatures(new Date('2026-07-04T12:00:00Z')).isWeekend).toBe(true); // Sat
    expect(calendarFeatures(new Date('2026-07-05T12:00:00Z')).isWeekend).toBe(false); // Sun
  });
  it('maps hours to dayparts', () => {
    expect(daypartOf(8)).toBe('morning');
    expect(daypartOf(22)).toBe('late');
  });
});

describe('newsvendor par', () => {
  it('reproduces the report croissant example (CR≈0.84 → par≈52)', () => {
    const economics = { price: 2.5, cost: 0.4, salvage: 0 };
    const cr = criticalRatio(economics);
    expect(cr).toBeCloseTo(0.84, 2);
    const { par } = computePar({ mu: 40, sigma: 12, economics });
    expect(par).toBe(52); // 40 + 0.994*12 = 51.9 → ceil
  });
  it('gives a high-margin perishable a higher service level than a costly one', () => {
    const highMargin = criticalRatio({ price: 2.5, cost: 0.4 });
    const lowMargin = criticalRatio({ price: 2.5, cost: 2.0 });
    expect(highMargin).toBeGreaterThan(lowMargin);
  });
  it('rounds up to the minimum batch and respects min display', () => {
    const e = { price: 2.5, cost: 0.4, minBatch: 12, minDisplay: 24 };
    expect(computePar({ mu: 5, sigma: 1, economics: e }).par).toBe(24);
    expect(computePar({ mu: 40, sigma: 5, economics: e }).par % 12).toBe(0);
  });
  it('inverse normal CDF is accurate', () => {
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 6);
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.95996, 4);
  });
  it('suggests only the shortfall', () => {
    expect(suggestedOrder(52, 20, 10)).toBe(22);
    expect(suggestedOrder(10, 30)).toBe(0);
  });
});

describe('order-line logging (forecast training data)', () => {
  beforeEach(() => clearOrderLines());

  it('records lines with calendar covariates and aggregates history by day', () => {
    const mondays = ['2026-06-01T09:00:00Z', '2026-06-08T09:00:00Z', '2026-06-15T09:00:00Z'];
    mondays.forEach((t, i) =>
      recordOrderLines({
        orderId: `o${i}`, memberId: 'm1', branchId: 'b1', orderType: 'pickup',
        items: [line('croissant', 10 + i)], at: new Date(t),
      }));
    const c = calendarFeatures(new Date(mondays[0]));
    const hist = historyFor('b1', 'croissant', c.dow, c.daypart);
    expect(hist).toEqual([10, 11, 12]);
    const { mu } = seasonalNaive(hist);
    expect(mu).toBeCloseTo(11, 5);
  });

  it('records stockouts separately and excludes them from demand history', () => {
    recordStockout('b1', 'croissant', new Date('2026-06-01T09:00:00Z'));
    const c = calendarFeatures(new Date('2026-06-01T09:00:00Z'));
    expect(historyFor('b1', 'croissant', c.dow, c.daypart)).toEqual([]);
    expect(listOrderLines({ branchId: 'b1' }).some((e) => e.stockoutFlag)).toBe(true);
  });
});
