import { describe, expect, it } from 'vitest';
import type { Branch } from '@almond/shared/types';
import { branches } from '@almond/shared/menu';
import { resolvePromo } from '@/lib/promo';
import { haversineKm, withDistances } from '@/lib/distance';
import { asLang, formatDate, formatJOD, formatJODHeld, formatJODNeeded, formatTime } from '@/lib/format';
import { tierProgress } from '@/data/loyalty';
import { cn } from '@/lib/cn';

/**
 * Guards the pure helpers under src/lib/**: promo resolution (money off the
 * bill), nearest-branch ordering, locale coercion and className merging.
 */

describe('resolvePromo', () => {
  it('returns the JOD discount for a known code', () => {
    expect(resolvePromo('ALMOND')).toBe(1);
    expect(resolvePromo('WELCOME')).toBe(1.5);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolvePromo('  welcome ')).toBe(1.5);
    expect(resolvePromo('Almond')).toBe(1);
  });

  it('returns 0 for unknown / empty codes', () => {
    expect(resolvePromo('')).toBe(0);
    expect(resolvePromo('FREE')).toBe(0);
    expect(resolvePromo('ALMOND1')).toBe(0);
  });

  it('does not resolve Object.prototype keys as codes', () => {
    // PROMOS is a plain object literal; an inherited key must never come back
    // as a function/object "discount". (Upper-casing currently protects it —
    // this pins that if someone drops the normalisation.)
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(resolvePromo(k)).toBe(0);
    }
  });
});

describe('haversineKm', () => {
  it('is 0 for the same point and symmetric', () => {
    const a = { lat: 31.9719, lng: 35.8665 };
    const b = { lat: 32.0136, lng: 35.8714 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 12);
  });

  it('matches a known distance (1° of latitude ≈ 111.19 km)', () => {
    expect(haversineKm({ lat: 31, lng: 35 }, { lat: 32, lng: 35 })).toBeCloseTo(111.19, 1);
  });
});

describe('withDistances', () => {
  const b = (id: string, lat: number, lng: number): Branch => ({
    id,
    nameAr: id,
    nameEn: id,
    areaAr: id,
    areaEn: id,
    lat,
    lng,
    hours: { open: '07:00', close: '24:00' },
  });

  it('without coords keeps the given order and leaves distance undefined', () => {
    const out = withDistances(branches, null);
    expect(out.map((x) => x.branch.id)).toEqual(branches.map((x) => x.id));
    expect(out.every((x) => x.distanceKm === undefined)).toBe(true);
  });

  it('with coords sorts nearest-first and attaches distances', () => {
    const list = [b('far', 32.5, 36), b('near', 31.97, 35.87), b('mid', 32.05, 35.9)];
    const out = withDistances(list, { lat: 31.97, lng: 35.87 });
    expect(out.map((x) => x.branch.id)).toEqual(['near', 'mid', 'far']);
    expect(out[0].distanceKm).toBeCloseTo(0, 6);
    expect(out.every((x) => typeof x.distanceKm === 'number')).toBe(true);
  });

  it('does not reorder the caller’s array', () => {
    const list = [b('far', 32.5, 36), b('near', 31.97, 35.87)];
    withDistances(list, { lat: 31.97, lng: 35.87 });
    expect(list.map((x) => x.id)).toEqual(['far', 'near']);
  });
});

describe('asLang', () => {
  it("maps 'en' to en and everything else to the Arabic default", () => {
    expect(asLang('en')).toBe('en');
    expect(asLang('ar')).toBe('ar');
    expect(asLang('fr')).toBe('ar');
    expect(asLang('')).toBe('ar');
  });
});

describe('cn', () => {
  it('joins truthy classes and drops falsy ones', () => {
    expect(cn('a', false, null, undefined, 'b', { c: true, d: false }, ['e'])).toBe('a b c e');
  });
});

describe('shared date/time formatting (one digit system with prices)', () => {
  // The website shares @almond/shared/lib/format with the app: its rewards
  // and wallet history print a date next to a Latin «12.50 د.أ».
  const AT = '2026-09-30T06:07:00.000Z';
  const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/;

  it('Arabic dates and times carry Latin digits, like the prices beside them', () => {
    expect(formatDate(AT, 'ar')).not.toMatch(ARABIC_INDIC);
    expect(formatDate(AT, 'ar')).toBe('\u206630/09/2026\u2069');
    expect(formatTime(AT, 'ar')).toMatch(/09:07/);
    expect(formatJOD(12.5, 'ar')).toBe('12.50 د.أ');
  });

  it('English uses DD/MM/YYYY while time keeps its existing format', () => {
    expect(formatDate(AT, 'en')).toBe('30/09/2026');
    expect(formatTime(AT, 'en')).toBe('09:07 AM');
  });

  it('keeps day/month distinct and moves instants into the correct Amman year', () => {
    expect(formatDate('2026-04-07T09:00:00Z', 'en')).toBe('07/04/2026');
    expect(formatDate('2026-12-31T21:30:00Z', 'en')).toBe('01/01/2027');
    expect(formatDate('2026-12-31T21:30:00Z', 'ar')).toBe('\u206601/01/2027\u2069');
  });
});

describe('customer money display', () => {
  it('uses two decimals, Latin digits and the existing currency placement', () => {
    expect(formatJOD(4.7, 'ar')).toBe('4.70 د.أ');
    expect(formatJOD(4.7, 'en')).toBe('JOD 4.70');
    expect(formatJOD(0, 'en')).toBe('JOD 0.00');
  });

  it('rounds half-cent values without pre-rounding raw fractional fils', () => {
    expect(formatJOD(1.005, 'en')).toBe('JOD 1.01');
    expect(formatJOD(2.675, 'ar')).toBe('2.68 د.أ');
    expect(formatJOD(1.2346, 'en')).toBe('JOD 1.23');
  });

  // Review of PRs #103 and #104, item 5: the spend still needed for the next
  // rung rounds UP, and a wallet balance rounds DOWN, the same functions the
  // app uses (packages/shared/src/lib/format.ts). RewardsView and WalletView
  // call them; almond-app/test/moneyRounding.test.ts MR2 checks both files.
  it('the spend still needed rounds up, and a balance held rounds down', () => {
    expect(formatJODNeeded(tierProgress(1.488).remaining, 'ar')).toBe('18.52 د.أ');
    expect(formatJODNeeded(tierProgress(19.998).remaining, 'en')).toBe('JOD 0.01');
    expect(formatJODHeld(1.005, 'en')).toBe('JOD 1.00');
    expect(formatJODHeld(7.448, 'ar')).toBe('7.44 د.أ');
  });
});
