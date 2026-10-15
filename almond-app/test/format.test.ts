import { afterEach, describe, it, expect, vi } from 'vitest';

import { formatDate, formatDayKey, formatJOD, formatNumber, formatSignedJOD, formatTime } from '@/lib/format';

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

describe('F1 dates and times use Latin digits in Arabic too', () => {
  it('a time: «09:07 ص», Arabic day-period, Latin digits', () => {
    const s = formatTime(AT, 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toMatch(/09:07/);
    expect(s).toMatch(/ص/);
  });

  it('a date: «30 أيلول», Arabic month, Latin digits', () => {
    const s = formatDate(AT, 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toMatch(/30/);
    expect(s).toMatch(/أيلول/);
  });

  it('an Amman day key keeps its own day, in Latin digits', () => {
    const s = formatDayKey('2026-11-15', 'ar');
    expect(s).not.toMatch(ARABIC_INDIC);
    expect(s).toMatch(/^15 /);
  });

  it('English is unchanged', () => {
    expect(formatDate(AT, 'en')).toBe('Sep 30');
    expect(formatTime(AT, 'en')).toBe('09:07 AM');
  });
});

describe('F2 an engine that ignores the numbering system is folded to Latin', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Arabic-Indic output from Intl still reaches the screen as Latin', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      (() => ({ format: () => '٣٠ أيلول ٠٩:٠٧' })) as unknown as typeof Intl.DateTimeFormat,
    );
    expect(formatDate(AT, 'ar')).toBe('30 أيلول 09:07');
  });
});

describe('F3 money and points keep their convention', () => {
  it('JOD: three decimals, Latin, in both languages', () => {
    expect(formatJOD(3.5, 'ar')).toBe('3.500 د.أ');
    expect(formatJOD(3.5, 'en')).toBe('JOD 3.500');
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
    // («3.250−»); only the number, or «د.أ» lands before it for a reader.
    expect(formatSignedJOD(-3.25, 'ar')).toBe(`${LRI}\u22123.250${PDI} د.أ`);
    expect(formatSignedJOD(20, 'ar')).toBe(`${LRI}+20.000${PDI} د.أ`);
  });

  it('English reads left to right, and zero has no sign', () => {
    expect(formatSignedJOD(-3.25, 'en')).toBe('\u2212JOD 3.250');
    expect(formatSignedJOD(0, 'ar')).toBe(`${LRI}0.000${PDI} د.أ`);
  });
});
