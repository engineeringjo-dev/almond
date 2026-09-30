import { describe, it, expect, beforeAll } from 'vitest';
import { createInstance, type i18n as I18n } from 'i18next';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { I18N_OPTIONS } from '@/lib/i18nOptions';

/**
 * N1 — ARABIC NUMBER AGREEMENT IN THE CHECKOUT COPY (audit P2).
 *
 * The review printed «جاهز خلال 7 دقيقة» and «ستكسب 7 نقطة»: Arabic counts
 * take a different noun form at 1, 2, 3–10 and 11+. These render the real
 * locale files through the app's own i18next options, so a string that loses
 * its plural forms — or a caller that stops passing `count` — reads wrong here
 * before it reads wrong at the till.
 */
let ar: I18n;
let en: I18n;
beforeAll(async () => {
  ar = createInstance();
  en = createInstance();
  await ar.init({ ...I18N_OPTIONS, lng: 'ar' });
  await en.init({ ...I18N_OPTIONS, lng: 'en' });
});

describe('N1 minutes until ready', () => {
  const ready = (n: number) => ar.t('cart.readyIn', { count: n });
  it('agrees with the number in Arabic', () => {
    expect(ready(1)).toBe('جاهز خلال دقيقة واحدة');
    expect(ready(2)).toBe('جاهز خلال دقيقتين');
    expect(ready(7)).toBe('جاهز خلال 7 دقائق');
    expect(ready(10)).toBe('جاهز خلال 10 دقائق');
    expect(ready(11)).toBe('جاهز خلال 11 دقيقة');
    expect(ready(25)).toBe('جاهز خلال 25 دقيقة');
    expect(ready(103)).toBe('جاهز خلال 103 دقائق');
  });
  it('English is unchanged', () => {
    expect(en.t('cart.readyIn', { count: 1 })).toBe('Ready in 1 min');
    expect(en.t('cart.readyIn', { count: 7 })).toBe('Ready in 7 min');
  });
});

describe('N2 points to earn', () => {
  const earn = (n: number) => ar.t('cart.earnEstimate', { count: n, points: String(n) });
  it('agrees with the number in Arabic', () => {
    expect(earn(1)).toBe('ستكسب نقطة واحدة على هذا الطلب');
    expect(earn(2)).toBe('ستكسب نقطتين على هذا الطلب');
    expect(earn(7)).toBe('ستكسب 7 نقاط على هذا الطلب');
    expect(earn(25)).toBe('ستكسب 25 نقطة على هذا الطلب');
  });
  it('English says the number it was given', () => {
    expect(en.t('cart.earnEstimate', { count: 7, points: '7' })).toBe('Points on this order: 7');
  });
});

describe('N3 the combo and brunch offers', () => {
  it('3–10 points take «نقاط», 11+ take «نقطة»', () => {
    expect(ar.t('cart.comboAddFood', { count: 5, points: 5 })).toBe('أضف طعاماً إلى مشروبك واكسب 5 نقاط');
    expect(ar.t('cart.comboAddFood', { count: 25, points: 25 })).toBe('أضف طعاماً إلى مشروبك واكسب 25 نقطة');
    expect(ar.t('cart.comboAddDrink', { count: 8, points: 8 })).toBe('أضف مشروباً إلى طعامك واكسب 8 نقاط');
    expect(ar.t('menu.brunchOffer', { count: 5, points: 5 })).toBe('البرانش: أضف مشروباً إلى طعامك واكسب 5 نقاط');
    expect(ar.t('menu.brunchOffer', { count: 50, points: 50 })).toBe('البرانش: أضف مشروباً إلى طعامك واكسب 50 نقطة');
    expect(
      ar.t('cart.comboAddItem', { count: 3, points: 3, name: 'كرواسون', price: '2.500 د.أ' }),
    ).toBe('أضف كرواسون بسعر 2.500 د.أ واكسب 3 نقاط');
  });
});

describe('N4 calories', () => {
  it('agrees with the number in Arabic', () => {
    expect(ar.t('menu.calories', { count: 1 })).toBe('سعرة واحدة');
    expect(ar.t('menu.calories', { count: 2 })).toBe('سعرتان');
    expect(ar.t('menu.calories', { count: 5 })).toBe('5 سعرات');
    expect(ar.t('menu.calories', { count: 180 })).toBe('180 سعرة');
    expect(en.t('menu.calories', { count: 180 })).toBe('180 cal');
  });
});

describe('N5 the cart button names itself and its count', () => {
  it('agrees with the number in Arabic', () => {
    const b = (n: number) => ar.t('order.cartButton', { count: n, total: '3.500 د.أ' });
    expect(b(1)).toBe('عرض السلة: صنف واحد، 3.500 د.أ');
    expect(b(2)).toBe('عرض السلة: صنفان، 3.500 د.أ');
    expect(b(4)).toBe('عرض السلة: 4 أصناف، 3.500 د.أ');
    expect(b(12)).toBe('عرض السلة: 12 صنفاً، 3.500 د.أ');
    expect(b(0)).toBe('عرض السلة');
  });
});

describe('N6 every caller of a counted string passes `count`', () => {
  // Without `count` i18next never picks a form and prints the base key's
  // «… 7 دقيقة» again — the exact defect, with every string above still right.
  const COUNTED = [
    'cart.readyIn', 'cart.earnEstimate', 'cart.comboAddFood', 'cart.comboAddDrink',
    'cart.comboAddItem', 'menu.calories', 'menu.brunchOffer', 'order.cartButton',
  ];
  it('holds for every call site in the app', () => {
    const calls: string[] = [];
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const src = readFileSync(full, 'utf8');
        for (const key of COUNTED) {
          const re = new RegExp(String.raw`\bt\(\s*'${key.replace('.', '\\.')}'([^)]*)\)`, 'g');
          for (const m of src.matchAll(re)) {
            calls.push(`${full}: ${key}`);
            if (!/\bcount\s*[:,}]/.test(m[1])) offenders.push(`${full}: ${key}`);
          }
        }
      }
    };
    for (const root of ['app', 'components']) walk(join(__dirname, '..', root));
    expect(calls.length, 'the scan must find the call sites').toBeGreaterThanOrEqual(COUNTED.length);
    expect(offenders).toEqual([]);
  });
});
