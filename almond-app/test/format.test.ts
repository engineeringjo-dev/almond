import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  formatDate, formatDayKey, formatJOD, formatJODHeld, formatJODNeeded, formatNumber, formatSignedJOD,
  formatTime, roundDownToQirsh, roundUpToQirsh, toFils, toJod,
} from '@/lib/format';
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

/**
 * F5 — TWO DECIMALS NEVER ASK FOR LESS THAN IS NEEDED, NOR SHOW MORE THAN IS
 * HELD. Owner, 2026-10-19: «خانتان (كما بناه Codex)». The review of PRs #103 and
 * #104 (docs/CODEX-LOYALTY-REVIEW-2026-10-19.ar.md) item 5: «إنفاق 1.488 يترك
 * 18.512، فتقول الشاشة "اصرف 18.51 د.أ إضافية"», and after spending exactly that
 * «اصرف 0.00 د.أ إضافية»; item 7: «رصيد 7.448 يظهر 7.45، ثم يُرفض تحويل 7.45».
 * Both directions round in integer fils, never `x * 100` in binary floating point.
 */
describe('F5 an amount still needed rounds up, an amount held rounds down', () => {
  const shown = (lang: 'ar' | 'en', value: string) => (lang === 'ar' ? `${value} د.أ` : `JOD ${value}`);

  it.each(['ar', 'en'] as const)('needed: up to the next 0.01, and never 0.00 while something remains, in %s', (lang) => {
    expect(formatJODNeeded(20 - 1.488, lang)).toBe(shown(lang, '18.52'));
    expect(formatJODNeeded(20 - 19.998, lang)).toBe(shown(lang, '0.01'));
    expect(formatJODNeeded(0.001, lang)).toBe(shown(lang, '0.01'));
    expect(formatJODNeeded(8, lang)).toBe(shown(lang, '8.00'));
    expect(formatJODNeeded(0, lang)).toBe(shown(lang, '0.00'));
  });

  it.each(['ar', 'en'] as const)('held: down to the 0.01 below, so a balance never reads more than it pays, in %s', (lang) => {
    expect(formatJODHeld(1.005, lang)).toBe(shown(lang, '1.00'));
    expect(formatJODHeld(7.448, lang)).toBe(shown(lang, '7.44'));
    expect(formatJODHeld(9.575, lang)).toBe(shown(lang, '9.57'));
    expect(formatJODHeld(12.4, lang)).toBe(shown(lang, '12.40'));
    expect(formatJODHeld(0, lang)).toBe(shown(lang, '0.00'));
  });

  it('an amount already in whole qirsh is not moved by binary noise', () => {
    // 1.1 * 100 is 110.00000000000001 and 0.57 * 100 is 56.99999999999999:
    // a float ceil would ask for 1.11, a float floor would show 0.56.
    expect(formatJODNeeded(1.1, 'en')).toBe('JOD 1.10');
    expect(formatJODNeeded(0.1 + 0.2, 'en')).toBe('JOD 0.30');
    expect(formatJODNeeded(20 - 1.49, 'en')).toBe('JOD 18.51');
    expect(formatJODHeld(0.57, 'en')).toBe('JOD 0.57');
    expect(formatJODHeld(4.35, 'en')).toBe('JOD 4.35');
  });

  it('for every whole-fils amount up to 100 JOD: held ≤ exact ≤ needed, each within one qirsh', () => {
    const offenders: string[] = [];
    for (let fils = 0; fils <= 100_000; fils += 1) {
      const jod = fils / 1000;
      const up = toFils(roundUpToQirsh(jod));
      const down = toFils(roundDownToQirsh(jod));
      if (up < fils || up - fils >= 10 || up % 10 !== 0) offenders.push(`up ${jod} → ${up / 1000}`);
      if (down > fils || fils - down >= 10 || down % 10 !== 0) offenders.push(`down ${jod} → ${down / 1000}`);
      if (fils > 0 && up === 0) offenders.push(`up ${jod} shows nothing`);
    }
    expect(offenders.slice(0, 10)).toEqual([]);
  });
});
