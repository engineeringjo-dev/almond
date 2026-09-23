import { describe, expect, it } from 'vitest';
import type { Branch } from '@almond/shared/types';
import { branches } from '@almond/shared/menu';
import { resolvePromo } from '@/lib/promo';
import { haversineKm, withDistances } from '@/lib/distance';
import { asLang } from '@/lib/format';
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
