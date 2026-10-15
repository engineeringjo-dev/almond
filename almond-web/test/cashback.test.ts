import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { earnRangeCopy } from '@almond/shared/loyalty/earn';
import ar from '../src/messages/ar.json';
import en from '../src/messages/en.json';

/**
 * «كاش باك لغاية 9%» ON THE WEBSITE'S HOME, WITH ITS NUMBER.
 *
 * Owner, 2026-10-15: «لا نستخدم نقاطك نقود. ممكن نحكي كاش باك لغاية ٩%». The
 * title carries {max}, read off the dials (bff/test/profile.test.ts T34h). If
 * LoyaltySection stops passing it, next-intl throws FORMATTING_ERROR in the
 * browser instead of a headline.
 */
describe('the loyalty section title', () => {
  it('reads whole in both languages with the computed ceiling', () => {
    const tAr = createTranslator({ locale: 'ar', messages: ar, namespace: 'Home.loyalty' });
    const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'Home.loyalty' });
    expect(tAr('title', earnRangeCopy('ar'))).toBe('كاش باك لغاية 9%');
    expect(tEn('title', earnRangeCopy('en'))).toBe('Up to 9% cashback');
  });

  it('LoyaltySection passes the ceiling to it', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/components/home/LoyaltySection.tsx'), 'utf8');
    expect(src).toMatch(/const range = earnRangeCopy\(lang\);/);
    expect(src).toMatch(/\{t\('title', range\)\}/);
  });
});
