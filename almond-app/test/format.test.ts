import { afterEach, describe, it, expect, vi } from 'vitest';

import { formatDate, formatDayKey, formatJOD, formatNumber, formatSignedJOD, formatTime, toFils, toJod } from '@/lib/format';
import { computeTotals } from '@almond/shared/cart';
import type { CartItem } from '@almond/shared/types';
import { config } from '@almond/shared/config';

/**
 * F1-F3 — ONE DIGIT SYSTEM ON A SCREEN (audit P2).
 *
 * Money and points were Latin in both languages (Jordanian commercial
 * convention) while `Intl('ar-JO')` wrote dates and times in Arabic-Indic:
 * the previous-orders card printed «٣٠ أيلول» beside «3.500 د.أ».
 */

const ARABIC_INDIC = /[٠-٩۰-۹]/;
// 2026-09-30 09:07 in Amman (UTC+3).
const AT = '2026-09-30T06:07:00.000Z';
const isolated = (date: string) => `\u2066${date}\u2069`;

describe('F1 dates and times use Latin digits in Arabic too', () => {
  it('a time: «09:07 ص», Arabic day-period, Latin digits', () => {
    const s = formatTime(AT, 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toMatch(/09:07/);
    expect(s).toMatch(/ص/);
  });

  it('a full date: day, month, year with Latin digits in one LTR run', () => {
    const s = formatDate(AT, 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toBe(isolated('30/09/2026'));
  });

  it('an Amman day key keeps its own day, in Latin digits', () => {
    const s = formatDayKey('2026-11-15', 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toBe(isolated('15/11/2026'));
  });

  it('English uses the same date order and keeps its existing time format', () => {
    expect(formatDate(AT, 'en')).toBe('30/09/2026');
    expect(formatTime(AT, 'en')).toBe('09:07 AM');
  });
});

describe('F2 an engine that ignores the numbering system is folded to Latin', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Arabic-Indic output from Intl still reaches the screen as Latin', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      (() => ({
        format: () => '٠٩:٠٧ ص',
        // The engine may return fields in any locale order, with local digits.
        formatToParts: () => [
          { type: 'year', value: '٢٠٢٦' }, { type: 'literal', value: '-' },
          { type: 'month', value: '٠٤' }, { type: 'literal', value: '-' },
          { type: 'day', value: '٠٧' },
        ],
      })) as unknown as typeof Intl.DateTimeFormat,
    );
    expect(formatDate(AT, 'ar')).toBe(isolated('07/04/2026'));
    expect(formatTime(AT, 'ar')).toBe('09:07 ص');
  });
});

describe('full dates have an unambiguous order and calendar year', () => {
  it.each(['ar', 'en'] as const)('day precedes month in %s, including zero padding', (lang) => {
    const expected = lang === 'ar' ? isolated('07/04/2026') : '07/04/2026';
    expect(formatDate('2026-04-07T09:00:00Z', lang)).toBe(expected);
    expect(formatDayKey('2026-04-07', lang)).toBe(expected);
    expect(formatDayKey('2026-04-07', lang, { year: true })).toBe(expected);
  });

  it('instant dates follow the Amman day and year on both sides of midnight', () => {
    expect(formatDate('2026-12-31T20:59:59Z', 'en')).toBe('31/12/2026');
    expect(formatDate('2026-12-31T21:00:00Z', 'en')).toBe('01/01/2027');
    expect(formatDate(new Date('2026-12-31T21:30:00Z'), 'ar')).toBe(isolated('01/01/2027'));
    expect(formatDate('2027-01-01T00:30:00+14:00', 'en')).toBe('31/12/2026');
  });

  it('a day key keeps its own day and year under eastern and western host time zones', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'Asia/Amman', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(formatDayKey('2027-01-01', 'en'), tz).toBe('01/01/2027');
        expect(formatDayKey('2026-12-31', 'ar'), tz).toBe(isolated('31/12/2026'));
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('only an explicit short-date request omits the year', () => {
    expect(formatDayKey('2026-04-07', 'en', { year: false })).toBe('07/04');
    expect(formatDayKey('2026-04-07', 'ar', { year: false })).toBe(isolated('07/04'));
  });
});

describe('F3 customer money uses two decimals without changing financial precision', () => {
  it.each(['ar', 'en'] as const)('money keeps exactly two Latin decimals in %s', (lang) => {
    const expected = (value: string) => lang === 'ar' ? `${value} د.أ` : `JOD ${value}`;
    expect(formatJOD(4.7, lang)).toBe(expected('4.70'));
    expect(formatJOD(0, lang)).toBe(expected('0.00'));
    expect(formatJOD(-0, lang)).toBe(expected('0.00'));
    expect(formatJOD(1234.5, lang)).toBe(expected('1234.50'));
  });

  it.each(['ar', 'en'] as const)('rounds fils and half-cent boundaries for display only in %s', (lang) => {
    const expected = (value: string) => lang === 'ar' ? `${value} د.أ` : `JOD ${value}`;
    expect(formatJOD(4.704, lang)).toBe(expected('4.70'));
    expect(formatJOD(4.705, lang)).toBe(expected('4.71'));
    expect(formatJOD(1.005, lang)).toBe(expected('1.01'));
    expect(formatJOD(2.675, lang)).toBe(expected('2.68'));
    // Rounding to fils first would incorrectly turn this tax fraction into 1.24.
    expect(formatJOD(1.2346, lang)).toBe(expected('1.23'));
  });

  it('a displayed 4.71 still quotes and charges 4.705 JOD / 4,705 fils', () => {
    const line: CartItem = {
      lineId: 'precision', itemId: 'precision', nameAr: '', nameEn: '', emoji: '',
      sizeId: 'S', sizeNameAr: '', sizeNameEn: '', unitBasePrice: 4.705,
      customizations: [], qty: 1,
    };
    const totals = computeTotals([line], 0);
    expect(formatJOD(totals.total, 'en')).toBe('JOD 4.71');
    expect(totals.total).toBe(4.705);
    expect(totals.tax).toBeCloseTo(4.705 - 4.705 / (1 + config.TAX_RATE), 12);
    expect(toFils(totals.total)).toBe(4705);
    expect(toJod(4705)).toBe(4.705);
    expect(line.unitBasePrice).toBe(4.705);
  });

  it('points: Latin with separators', () => {
    expect(formatNumber(12500, 'ar')).toBe('12,500');
  });
});

describe('F4 a movement of money keeps its sign beside its number', () => {
  const LRI = '\u2066';
  const PDI = '\u2069';
  it('Arabic: the signed number is one left-to-right run, and the currency follows it', () => {
    // Isolated, or the bidi algorithm puts the minus on the far side
    // («3.25−»); only the number, or «د.أ» lands before it for a reader.
    expect(formatSignedJOD(-3.25, 'ar')).toBe(`${LRI}\u22123.25${PDI} د.أ`);
    expect(formatSignedJOD(20, 'ar')).toBe(`${LRI}+20.00${PDI} د.أ`);
    expect(formatSignedJOD(-1.005, 'ar')).toBe(`${LRI}\u22121.01${PDI} د.أ`);
  });

  it('English reads left to right, and zero has no sign', () => {
    expect(formatSignedJOD(-3.25, 'en')).toBe('\u2212JOD 3.25');
    expect(formatSignedJOD(20, 'en')).toBe('+JOD 20.00');
    expect(formatSignedJOD(-2.675, 'en')).toBe('\u2212JOD 2.68');
    expect(formatSignedJOD(0, 'ar')).toBe(`${LRI}0.00${PDI} د.أ`);
    expect(formatSignedJOD(-0, 'en')).toBe('JOD 0.00');
  });
});
