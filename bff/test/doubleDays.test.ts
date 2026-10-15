import { describe, it, expect } from 'vitest';
import { config, SHIPPED_DOUBLE_POINTS_DAYS, type DoublePointsDay } from '@almond/shared/config';
import {
  activeDoubleDay, computeEarn, earnRulesFromConfig, upcomingDoubleDay,
} from '@almond/shared/loyalty/earn';
import { tiers } from '@almond/shared/loyalty';
import { hijriParts } from '@almond/shared/lib/calendar';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { withShippedDoubleDays } from '../../packages/shared/test-setup/no-double-days';

/**
 * D1-D5 — DOUBLE POINTS ON OCCASIONS.
 *
 * Owner, 2026-10-15: «اضف نقاط مضاعفة في رمضان، الاعياد عيدي الفطر والاضحى ويوم
 * القهوة وكل العطل الرسمية». The rate doubles on the Amman day of the sale —
 * decided by the server's clock, never by a device flag — on every rung and
 * from the wallet too; flat grants (the combo) are not doubled.
 *
 * Every other test file runs with the calendar EMPTY (packages/shared/
 * test-setup/no-double-days.ts) so a CI run on a holiday changes no answer.
 * This file is where the shipped calendar is exercised, explicitly.
 */

const RULES = { ...earnRulesFromConfig(), doubleDays: SHIPPED_DOUBLE_POINTS_DAYS };
const amman = (day: string, hhmm = '12:00'): Date => new Date(`${day}T${hhmm}:00+03:00`);
const PLAIN = amman('2027-04-14');      // a Wednesday on no occasion
const RAMADAN = amman('2027-02-20');

describe('D1 a sale on an occasion earns twice the rate', () => {
  for (const tier of tiers) {
    for (const paidFromBalance of [false, true]) {
      it(`${tier.id}, ${paidFromBalance ? 'from the wallet' : 'cash'}`, () => {
        const ctx = { total: 10, windowSpend: tier.threshold, paidFromBalance };
        const plain = computeEarn({ ...ctx, at: PLAIN }, RULES);
        const occasion = computeEarn({ ...ctx, at: RAMADAN }, RULES);
        expect(plain.doubleDay).toBeNull();
        expect(occasion.doubleDay).toBe('ramadan');
        expect(occasion.points).toBe(plain.points * RULES.doubleDayMultiplier);
        expect(occasion.capApplied, 'the ceiling must not trim a promised double').toBe(false);
      });
    }
  }

  it('the top rung from the wallet is paid 18% on an occasion, not trimmed to 9%', () => {
    // 6% × 1.5 (wallet) × 2 (occasion) = 18% — 180 points on a 10 JOD bill.
    const top = tiers[tiers.length - 1];
    const r = computeEarn({ total: 10, windowSpend: top.threshold, paidFromBalance: true, at: RAMADAN }, RULES);
    expect(r.points).toBe(180);
    expect(r.doubleDayBonus).toBeGreaterThan(0);
  });

  it('the combo bonus is a flat grant and is not doubled', () => {
    const combo = { drinks: [{ unitJod: 3, qty: 1 }], foods: [{ unitJod: 2, qty: 1 }] };
    const plain = computeEarn({ total: 5, combo, at: PLAIN }, RULES);
    const occasion = computeEarn({ total: 5, combo, at: RAMADAN }, RULES);
    expect(plain.comboBonus).toBe(config.COMBO_BONUS_POINTS);
    expect(occasion.comboBonus).toBe(config.COMBO_BONUS_POINTS);
  });
});

describe('D2 the Amman day of the sale decides', () => {
  it('23:30 on the eve is ordinary; 00:30 on the first day is doubled', () => {
    expect(computeEarn({ total: 10, at: amman('2027-02-07', '23:30') }, RULES).doubleDay).toBeNull();
    expect(computeEarn({ total: 10, at: amman('2027-02-08', '00:30') }, RULES).doubleDay).toBe('ramadan');
  });

  it('with no occasion listed nothing doubles — the calendar is the only switch', () => {
    const none = { ...RULES, doubleDays: [] };
    expect(computeEarn({ total: 10, at: RAMADAN }, none).points)
      .toBe(computeEarn({ total: 10, at: PLAIN }, none).points);
  });
});

describe('D3 the notices', () => {
  it('upcomingDoubleDay names tomorrow\'s occasion, and only the day before', () => {
    expect(upcomingDoubleDay(amman('2027-02-07'), SHIPPED_DOUBLE_POINTS_DAYS)?.id).toBe('ramadan');
    expect(upcomingDoubleDay(amman('2027-02-08'), SHIPPED_DOUBLE_POINTS_DAYS)).toBeNull(); // already on
    expect(upcomingDoubleDay(PLAIN, SHIPPED_DOUBLE_POINTS_DAYS)).toBeNull();
    expect(activeDoubleDay(amman('2027-10-01'), SHIPPED_DOUBLE_POINTS_DAYS)?.id).toBe('coffee-day');
  });
});

describe('D4 the shipped calendar', () => {
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const days = SHIPPED_DOUBLE_POINTS_DAYS;

  it('every entry is well formed', () => {
    for (const d of days) {
      expect(d.from, d.id).toMatch(DAY);
      expect(d.to, d.id).toMatch(DAY);
      expect(d.from <= d.to, `${d.id} ${d.from}..${d.to}`).toBe(true);
      expect(d.nameAr.length * d.nameEn.length, d.id).toBeGreaterThan(0);
    }
  });

  it('the fixed holidays sit on their exact dates', () => {
    const FIXED: Record<string, string> = {
      'new-year': '01-01', 'labour-day': '05-01', 'independence-day': '05-25',
      'coffee-day': '10-01', christmas: '12-25',
    };
    for (const d of days.filter((x) => x.id in FIXED)) {
      expect(d.from.slice(5), d.id).toBe(FIXED[d.id]);
      expect(d.to, d.id).toBe(d.from);
    }
  });

  /** Gregorian days between two Amman day keys (b − a). */
  const gap = (a: string, b: string): number =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  /** The Amman day, within ±3 of `near`, on which Umm al-Qura reads month/day. */
  const ummAlQura = (near: string, month: number, day: number): string | null => {
    for (let off = -3; off <= 3; off += 1) {
      const at = new Date(Date.parse(`${near}T09:00:00Z`) + off * 86_400_000);
      const h = hijriParts(at);
      if (h.month === month && h.day === day) return ammanDayKey(at);
    }
    return null;
  };

  it('the Islamic dates agree with Umm al-Qura to within a day (they are estimates)', () => {
    // Jordan fixes these by moon sighting; config holds Umm al-Qura and is
    // corrected when the government announces. A typo of more than a day is a
    // mistake, not an announcement, and fails here.
    const START: Record<string, [number, number]> = {
      ramadan: [9, 1], 'eid-al-fitr': [10, 1], 'eid-al-adha': [12, 9],
      'hijri-new-year': [1, 1], mawlid: [3, 12], 'isra-miraj': [7, 27],
    };
    const END: Record<string, [number, number]> = { 'eid-al-fitr': [10, 3], 'eid-al-adha': [12, 13] };
    for (const d of days.filter((x) => x.id in START)) {
      const [m, dd] = START[d.id];
      const expected = ummAlQura(d.from, m, dd);
      expect(expected, `${d.id} ${d.from}: no Umm al-Qura ${m}/${dd} within 3 days`).not.toBeNull();
      expect(Math.abs(gap(expected!, d.from)), `${d.id} starts ${d.from}, Umm al-Qura ${expected}`).toBeLessThanOrEqual(1);
      if (END[d.id]) {
        const [em, ed] = END[d.id];
        const end = ummAlQura(d.to, em, ed);
        expect(end, `${d.id} ${d.to}`).not.toBeNull();
        expect(Math.abs(gap(end!, d.to)), `${d.id} ends ${d.to}, Umm al-Qura ${end}`).toBeLessThanOrEqual(1);
      }
      if (d.id === 'ramadan') {
        // Ramadan ends the day before 1 Shawwal.
        const shawwal = ummAlQura(d.to, 10, 1);
        expect(shawwal, d.to).not.toBeNull();
        expect(Math.abs(gap(d.to, shawwal!) - 1), `ramadan ends ${d.to}, 1 Shawwal ${shawwal}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every occasion the owner named is listed for every full year covered', () => {
    const OCCASIONS = [
      'ramadan', 'eid-al-fitr', 'eid-al-adha', 'coffee-day', 'new-year', 'isra-miraj',
      'labour-day', 'independence-day', 'hijri-new-year', 'mawlid', 'christmas',
    ];
    for (const year of ['2027', '2028']) {
      const ids = new Set(days.filter((d) => d.from.startsWith(year)).map((d) => d.id));
      for (const id of OCCASIONS) expect(ids.has(id), `${id} missing in ${year}`).toBe(true);
    }
  });

  it('the list runs at least 60 days past today, so it cannot lapse silently', () => {
    const last = days.map((d) => d.to).sort().at(-1)!;
    const horizon = ammanDayKey(new Date(Date.now() + 60 * 86_400_000));
    expect(last >= horizon, `the calendar ends ${last}; extend SHIPPED_DOUBLE_POINTS_DAYS`).toBe(true);
  });
});

describe('D5 the dial is wired, and emptied under test', () => {
  it('earnRulesFromConfig() hands the engine config.DOUBLE_POINTS_DAYS', () => {
    const wired: readonly DoublePointsDay[] = withShippedDoubleDays(() => earnRulesFromConfig().doubleDays);
    expect(wired).toBe(SHIPPED_DOUBLE_POINTS_DAYS);
    expect(earnRulesFromConfig().doubleDayMultiplier).toBe(config.DOUBLE_POINTS_MULTIPLIER);
  });

  it('every other test file sees an empty calendar (test-setup/no-double-days.ts)', () => {
    expect(config.DOUBLE_POINTS_DAYS).toEqual([]);
  });
});
